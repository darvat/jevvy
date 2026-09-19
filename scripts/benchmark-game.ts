import { writeFileSync } from "node:fs";
import * as before from "./fixtures/simulation-before-win-tuning";
import * as after from "../src/game/simulation";

// No API calls: repeatable policy proxies test the controller, not Jev's win rate.
type State = {
  status: string;
  hull: number;
  elapsed: number;
  score: number;
  wave: number;
  dodges: number;
};
type Lane = Omit<ReturnType<typeof after.radar>["lanes"][number], "attack"> & {
  attack?: ReturnType<typeof after.radar>["lanes"][number]["attack"];
};
type Snapshot = { lanes: Lane[]; player_lane: number };
type Engine<S> = {
  createGame(seed: number): S;
  advance(s: S, dt: number): void;
  applyCommand(s: S, c: { lane: number; fire: boolean }): void;
  radar(s: S): Snapshot;
};

function choose(snapshot: Snapshot, urgency: boolean) {
  const clear = snapshot.lanes.filter((l) => l.danger.startsWith("clear"));
  const safe = clear.length ? clear : snapshot.lanes;
  const targets = safe.filter((l) => l.enemies > 0);
  if (!targets.length)
    return [...safe].sort(
      (a, b) =>
        a.lanes_away_from_nearest_enemy - b.lanes_away_from_nearest_enemy ||
        a.travel_seconds - b.travel_seconds,
    )[0].lane;
  if (urgency) {
    const interceptable = targets.filter((l) => l.attack?.can_intercept);
    if (interceptable.length)
      return interceptable.sort(
        (a, b) =>
          a.attack!.escape_margin_seconds - b.attack!.escape_margin_seconds ||
          a.travel_seconds - b.travel_seconds,
      )[0].lane;
  }
  return (
    targets.find((l) => l.lane === snapshot.player_lane)?.lane ??
    targets.sort((a, b) => a.travel_seconds - b.travel_seconds)[0].lane
  );
}

function run<S extends State>(
  engine: Engine<S>,
  seed: number,
  latency: number,
  urgency: boolean,
) {
  const s = engine.createGame(seed);
  s.status = "running";
  engine.applyCommand(s, {
    lane: choose(engine.radar(s), urgency),
    fire: true,
  });
  let nextRequest = 1.15;
  let pending: { lane: number; arrival: number } | null = null;
  while (s.status === "running") {
    if (!pending && s.elapsed >= nextRequest)
      pending = {
        lane: choose(engine.radar(s), urgency),
        arrival: s.elapsed + latency,
      };
    if (pending && s.elapsed >= pending.arrival) {
      engine.applyCommand(s, { lane: pending.lane, fire: true });
      pending = null;
      nextRequest = s.elapsed + 1.15;
    }
    engine.advance(s, 1 / 60);
  }
  return {
    seed,
    won: s.status === "won",
    hull: s.hull,
    kills: s.score / 100,
    seconds: s.elapsed,
    dodges: s.dodges,
  };
}

const count = Number(process.argv[2] ?? 500);
if (!Number.isInteger(count) || count < 1 || count > 5000)
  throw new Error("Use 1–5000 seeds per cohort.");
const results = [];
for (const startSeed of [1, 10001]) {
  for (const latency of [0.3, 0.9]) {
    const variants = [
      { name: "before / nearest-safe proxy", urgency: false, baseline: true },
      { name: "after / nearest-safe proxy", urgency: false, baseline: false },
      { name: "after / urgent-target proxy", urgency: true, baseline: false },
    ];
    for (const variant of variants) {
      const missions = Array.from({ length: count }, (_, i) =>
        variant.baseline
          ? run(before, startSeed + i, latency, false)
          : run(after, startSeed + i, latency, variant.urgency),
      );
      const wins = missions.filter((m) => m.won);
      const average = (
        rows: typeof missions,
        key: "hull" | "kills" | "seconds" | "dodges",
      ) =>
        rows.length
          ? +(rows.reduce((n, m) => n + m[key], 0) / rows.length).toFixed(2)
          : null;
      const result = {
        cohort: startSeed === 1 ? "primary" : "holdout",
        firstSeed: startSeed,
        seeds: count,
        latencySeconds: latency,
        variant: variant.name,
        wins: wins.length,
        winRatePercent: +((wins.length / count) * 100).toFixed(1),
        meanHull: average(missions, "hull"),
        meanKills: average(missions, "kills"),
        meanSeconds: average(missions, "seconds"),
        meanWinSeconds: average(wins, "seconds"),
        meanDodges: average(missions, "dodges"),
      };
      results.push(result);
      console.log(result);
    }
  }
}
writeFileSync(
  "docs/game-benchmark.json",
  JSON.stringify(
    {
      methodology:
        "Offline deterministic policy proxies, not live Jev. Same initial seeds and fixed response latency; enemy behavior diverges as kills alter the encounter. Baseline proxy always fires, conservatively giving the old controller perfect firing decisions. Initial command is immediate; subsequent requests start 1.15s after the preceding response. Win means the existing game's three-wave survival condition; kills are reported separately. Holdout seeds are disjoint. No enemy difficulty or hull changes.",
      results,
    },
    null,
    2,
  ) + "\n",
);
