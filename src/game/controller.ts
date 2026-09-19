import {
  advance,
  applyCommand,
  createGame,
  type GameState,
} from "./simulation";
import { askPilot, type Decision } from "./pilot";

export type FlightView = {
  status: GameState["status"];
  score: number;
  wave: number;
  hull: number;
  elapsed: number;
  dodgeX: number | null;
  dodges: number;
  firing: boolean;
  thinking: boolean;
  holding: boolean;
  error: string;
  decisions: Decision[];
  calls: number;
  tokens: number;
};
export const initialFlightView: FlightView = {
  status: "ready",
  score: 0,
  wave: 1,
  hull: 3,
  elapsed: 0,
  dodgeX: null,
  dodges: 0,
  firing: false,
  thinking: false,
  holding: false,
  error: "",
  decisions: [],
  calls: 0,
  tokens: 0,
};

export class FlightController {
  state = createGame();
  private decisions: Decision[] = [];
  private generation = 0;
  private request: AbortController | null = null;
  private thinking = false;
  private error = "";
  private calls = 0;
  private tokens = 0;
  private sinceDecision = 0;
  private accumulator = 0;
  private notificationTimer = 0;
  private alive = true;
  constructor(
    private notify: (view: FlightView) => void,
    private pilot = askPilot,
  ) {}

  private publish() {
    if (!this.alive) return;
    this.notify({
      status: this.state.status,
      score: this.state.score,
      wave: this.state.wave,
      hull: this.state.hull,
      elapsed: this.state.elapsed,
      dodgeX: this.state.dodgeX,
      dodges: this.state.dodges,
      firing: this.state.status === "running" && this.state.fire,
      thinking: this.thinking,
      holding:
        this.state.status === "running" &&
        (!this.decisions.length || this.sinceDecision > 2.5),
      error: this.error,
      decisions: [...this.decisions],
      calls: this.calls,
      tokens: this.tokens,
    });
  }
  start() {
    if (!this.alive || this.state.status === "running") return;
    if (this.state.status === "won" || this.state.status === "lost")
      this.reset();
    this.state.status = "running";
    this.error = "";
    this.sinceDecision = 3;
    void this.think();
    this.publish();
  }
  pause(message = "") {
    if (this.state.status !== "running") return;
    this.state.status = "paused";
    this.error = message;
    this.cancel();
    this.publish();
  }
  private cancel() {
    this.generation++;
    this.request?.abort();
    this.request = null;
    this.thinking = false;
  }
  reset() {
    this.cancel();
    this.state = createGame();
    this.decisions = [];
    this.calls = 0;
    this.tokens = 0;
    this.error = "";
    this.sinceDecision = 0;
    this.accumulator = 0;
    this.publish();
  }
  dispose() {
    this.alive = false;
    this.cancel();
  }
  step(delta: number) {
    if (!this.alive || this.state.status !== "running") return;
    const seconds = Math.min(delta / 1000, 0.1);
    this.sinceDecision += seconds;
    // A delayed network response holds the battlefield instead of inventing a local pilot.
    if (this.decisions.length && this.sinceDecision <= 2.5) {
      this.accumulator += seconds;
      while (this.accumulator >= 1 / 60) {
        advance(this.state, 1 / 60);
        this.accumulator -= 1 / 60;
      }
    }
    if (this.state.status !== "running") {
      this.cancel();
      this.publish();
      return;
    }
    if (!this.thinking && this.sinceDecision >= 1.15) void this.think();
    this.notificationTimer += seconds;
    if (this.notificationTimer > 0.1) {
      this.notificationTimer = 0;
      this.publish();
    }
  }
  private async think() {
    if (!this.alive || this.thinking || this.state.status !== "running") return;
    if (this.calls >= 90) {
      this.pause(
        "This mission reached its 90-call limit. Restart for a new mission.",
      );
      return;
    }
    const generation = this.generation;
    const controller = new AbortController();
    this.request = controller;
    this.thinking = true;
    this.calls++;
    this.publish();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const result = await this.pilot(this.state, controller.signal);
      if (
        !this.alive ||
        generation !== this.generation ||
        this.state.status !== "running"
      )
        return;
      const decision = { ...result, number: this.calls };
      applyCommand(this.state, decision);
      this.decisions = [decision, ...this.decisions].slice(0, 8);
      this.tokens += decision.inputTokens;
      this.sinceDecision = 0;
    } catch (error) {
      if (generation !== this.generation || !this.alive) return;
      this.pause(
        controller.signal.aborted
          ? "Pilot connection timed out. Resume to reconnect."
          : error instanceof Error
            ? error.message
            : "Pilot disconnected. Resume to reconnect.",
      );
    } finally {
      clearTimeout(timeout);
      if (generation === this.generation) {
        this.thinking = false;
        this.request = null;
        this.publish();
      }
    }
  }
}
