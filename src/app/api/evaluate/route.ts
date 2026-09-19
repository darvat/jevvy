import { requestSchema, responseSchema } from "@/lib/jev";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== request.headers.get("host"))
        return Response.json(
          { error: "Cross-origin requests are not allowed." },
          { status: 403 },
        );
    } catch {
      return Response.json(
        { error: "Invalid request origin." },
        { status: 403 },
      );
    }
  }
  const apiKey = process.env.JEV_API_KEY?.trim();
  if (!apiKey)
    return Response.json(
      { error: "Add JEV_API_KEY to .env and restart the server." },
      { status: 503 },
    );
  let body;
  try {
    const text = await request.text();
    if (text.length > 250_000)
      return Response.json(
        { error: "Request is too large. Keep it under 250 KB." },
        { status: 413 },
      );
    body = JSON.parse(text);
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success)
    return Response.json(
      {
        error: parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      },
      { status: 400 },
    );
  const started = performance.now();
  try {
    const upstream = await fetch("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(parsed.data),
      cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(45_000)]),
    });
    if (!upstream.ok) {
      const messages: Record<number, string> = {
        401: "TypeSafe rejected JEV_API_KEY. Check the key in .env.",
        403: "This API key does not have access to the requested model.",
        402: "TypeSafe reports insufficient credits. Check your account balance.",
        422: "TypeSafe could not validate this request. Check the model, state, and question criteria.",
        429: "TypeSafe rate limit reached. Wait a moment before running again.",
        529: "TypeSafe is temporarily overloaded. Try again shortly.",
      };
      return Response.json(
        {
          error:
            messages[upstream.status] ??
            `TypeSafe returned HTTP ${upstream.status}. Try again shortly.`,
          upstreamStatus: upstream.status,
        },
        { status: upstream.status >= 500 ? 502 : upstream.status },
      );
    }
    const data = responseSchema.safeParse(await upstream.json());
    if (
      !data.success ||
      Object.entries(parsed.data.questions).some(
        ([id, q]) => data.data?.answers[id]?.type !== q.type,
      )
    )
      return Response.json(
        {
          error:
            "TypeSafe returned an unexpected response format. Please try again.",
        },
        { status: 502 },
      );
    return Response.json(
      {
        response: data.data,
        durationMs: Math.round(performance.now() - started),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");
    return Response.json(
      {
        error: timedOut
          ? "Evaluation timed out after 45 seconds. Try a shorter state or retry."
          : "Could not reach TypeSafe. Check your connection and try again.",
      },
      { status: timedOut ? 504 : 502 },
    );
  }
}
