import type { EvaluationRequest } from "@/lib/jev";
import { responseSchema } from "@/lib/jev";
import { radar, type Command, type GameState } from "./simulation";

export type Decision = Command & {
  number: number;
  confidence: number;
  threat: number;
  durationMs: number;
  model: string;
  inputTokens: number;
  probabilities: Record<string, number>;
};
export function pilotRequest(state: GameState): EvaluationRequest {
  const snapshot = radar(state);
  return {
    model: "jev-latest",
    state: snapshot,
    questions: {
      lane: {
        type: "choice",
        instructions:
          "Choose the best attack lane to win all three waves. Weapons fire continuously without your intervention. First avoid dangerous_bullet_ids_on_route and imminent enemy bullets. Among safe lanes with attack.can_intercept=true, prioritize the smallest attack.escape_margin_seconds: these enemies will escape soonest after accounting for travel, cooldown, projectile flight, and HP. Prefer staying to finish a target if urgency is similar; avoid unnecessary lane switching. Do not chase an impossible interception while a reachable enemy remains. If no enemy lane is safe, choose a clear lane near the most urgent target. The local reflex checks live geometry when this command arrives and makes brief evasive offsets, then resumes your attack. Ignore player-owned bullets",
        criteria: Object.fromEntries(
          snapshot.lanes.map((lane) => [
            `lane_${lane.lane}`,
            {
              action: `Fly to lane ${lane.lane} and shoot upward from there.`,
              ...lane,
            },
          ]),
        ),
      },
      threat: {
        type: "score",
        instructions:
          "How immediate is the danger from enemy bullets to the ship at player_x, player_y and along its current movement? Use bullet positions and velocity, time_to_player_height_seconds, and threatens_current_motion. Ignore player-owned bullets and enemy bullets already below the ship.",
        criteria: [
          "No threatening enemy bullet will arrive within 4 seconds",
          "A threatening enemy bullet will arrive between 2 and 4 seconds from now",
          "A threatening enemy bullet will arrive in less than 2 seconds",
        ],
      },
    },
  };
}
export async function askPilot(
  state: GameState,
  signal: AbortSignal,
): Promise<Omit<Decision, "number">> {
  const response = await fetch("/api/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pilotRequest(state)),
    signal,
  });
  const payload = await response.json();
  if (!response.ok)
    throw new Error(payload.error ?? "The pilot could not connect to Jev.");
  const data = responseSchema.parse(payload.response);
  const { lane, threat } = data.answers;
  if (
    lane?.type !== "choice" ||
    threat?.type !== "score" ||
    !/^lane_[1-5]$/.test(lane.choice)
  )
    throw new Error("Jev returned an invalid flight command.");
  return {
    lane: Number(lane.choice.slice(-1)),
    threat: threat.score,
    confidence: lane.confidence,
    probabilities: lane.probabilities,
    model: data.model,
    durationMs: payload.durationMs,
    inputTokens: data.usage.input_tokens,
  };
}
