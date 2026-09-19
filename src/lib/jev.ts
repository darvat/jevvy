import { z } from "zod";

const description = z.union([
  z.string().min(1),
  z.record(z.string(), z.json()),
  z.array(z.json()),
]);
const question = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("choice"),
    instructions: description,
    criteria: z
      .record(z.string().min(1), description.nullable())
      .refine(
        (v) => Object.keys(v).length >= 2 && Object.keys(v).length <= 255,
        "Choice needs 2–255 options.",
      ),
  }),
  z.object({
    type: z.literal("score"),
    instructions: description,
    criteria: z.array(description).min(2).max(10),
  }),
  z.object({
    type: z.literal("noul"),
    instructions: description,
    criteria: z.object({ true: description, false: description }).optional(),
  }),
]);
export const requestSchema = z.object({
  model: z.string().trim().min(1).max(100),
  state: z.union([
    z.string().trim().min(1),
    z.record(z.string(), z.json()),
    z.array(z.json()),
  ]),
  questions: z
    .record(z.string().min(1).max(100), question)
    .refine(
      (v) => Object.keys(v).length >= 1 && Object.keys(v).length <= 50,
      "Use 1–50 questions in this playground.",
    ),
});
export type EvaluationRequest = z.infer<typeof requestSchema>;
export type QuestionType = "choice" | "score" | "noul";
export type DraftQuestion = {
  key: string;
  id: string;
  type: QuestionType;
  instructions: string;
  criteria: string;
};
const probability = z.number().min(0).max(1);
export const responseSchema = z.object({
  model: z.string(),
  answers: z.record(
    z.string(),
    z.discriminatedUnion("type", [
      z.object({
        type: z.literal("choice"),
        choice: z.string(),
        confidence: probability,
        probabilities: z.record(z.string(), probability),
      }),
      z.object({
        type: z.literal("score"),
        score: z.number(),
        confidence: probability,
        probabilities: z.record(z.string(), probability),
        legend: z.record(z.string(), z.json()),
      }),
      z.object({ type: z.literal("noul"), noul: probability }),
    ]),
  ),
  usage: z.object({ input_tokens: z.number(), output_tokens: z.number() }),
});
export type EvaluationResponse = z.infer<typeof responseSchema>;
export type Run = {
  id: string;
  date: string;
  request: EvaluationRequest;
  response: EvaluationResponse;
  durationMs: number;
};

export function buildRequest(
  state: string,
  stateMode: "text" | "json",
  model: string,
  drafts: DraftQuestion[],
): EvaluationRequest {
  const entries = drafts.map((d) => {
    let criteria;
    if (d.type !== "noul" || d.criteria.trim()) {
      try {
        criteria = JSON.parse(d.criteria);
      } catch {
        throw new Error(
          `Invalid criteria JSON in “${d.id || "unnamed question"}”.`,
        );
      }
    }
    return [
      d.id.trim(),
      {
        type: d.type,
        instructions: d.instructions.trim(),
        ...(criteria === undefined ? {} : { criteria }),
      },
    ] as const;
  });
  if (new Set(entries.map(([id]) => id)).size !== entries.length)
    throw new Error("Every question needs a unique ID.");
  let parsedState = state;
  if (stateMode === "json") {
    try {
      parsedState = JSON.parse(state);
    } catch {
      throw new Error("State must be valid JSON in JSON mode.");
    }
  }
  const parsed = requestSchema.safeParse({
    state: parsedState,
    model,
    questions: Object.fromEntries(entries),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`${issue.path.join(" → ")}: ${issue.message}`);
  }
  return parsed.data;
}

export function toDrafts(request: EvaluationRequest): DraftQuestion[] {
  return Object.entries(request.questions).map(([id, q]) => ({
    key: id,
    id,
    type: q.type,
    instructions:
      typeof q.instructions === "string"
        ? q.instructions
        : JSON.stringify(q.instructions),
    criteria: q.criteria ? JSON.stringify(q.criteria, null, 2) : "",
  }));
}
