import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  spawnWave,
  advance,
  applyCommand,
  radar,
  WORLD,
} from "../src/game/simulation";
import { FlightController, type FlightView } from "../src/game/controller";
import { pilotRequest, type Decision } from "../src/game/pilot";
import { requestSchema } from "../src/lib/jev";

const command: Omit<Decision, "number"> = {
  lane: 1,
  confidence: 0.9,
  threat: 0,
  durationMs: 30,
  model: "test-only",
  inputTokens: 10,
  probabilities: { lane_1: 1 },
};
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

test("ship crosses a lane in a quarter second and reverses immediately without overshooting", () => {
  const game = createGame(42);
  game.status = "running";
  applyCommand(game, { lane: 4 });
  assert.equal(radar(game).lanes[3].travel_seconds, 0.25);
  for (let i = 0; i < 15; i++) advance(game, 1 / 60);
  assert.equal(game.x, 680);
  applyCommand(game, { lane: 3 });
  advance(game, 1 / 60);
  assert.equal(game.x, 668);
  for (let i = 0; i < 20; i++) advance(game, 1 / 60);
  assert.equal(game.x, 500);
});

test("seeded missions replay exactly while different seeds vary formations and volleys", () => {
  const a = createGame(42);
  const b = createGame(42);
  const c = createGame(99);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.enemies, c.enemies);
  a.status = b.status = "running";
  for (let i = 0; i < 600; i++) {
    advance(a, 1 / 60);
    advance(b, 1 / 60);
  }
  assert.deepEqual(a, b);
});

test("random formations and volleys stay bounded across seeds and waves", () => {
  const shotCounts = new Set<number>();
  const delays = new Set<number>();
  for (let seed = 1; seed <= 60; seed++) {
    const game = createGame(seed);
    for (let wave = 1; wave <= 3; wave++) {
      game.wave = wave;
      spawnWave(game);
      game.status = "running";
      assert.equal(game.enemies.length, [5, 8, 10][wave - 1]);
      for (const enemy of game.enemies) {
        assert.ok(WORLD.lanes.includes(enemy.x));
        assert.ok(enemy.y >= 48 && enemy.y <= 162);
        assert.ok(
          enemy.speed >= [20, 28, 36][wave - 1] * 0.8 &&
            enemy.speed <= [20, 28, 36][wave - 1] * 1.25,
        );
      }
      const enemyBefore = game.enemies[0];
      const initialY = enemyBefore.y;
      game.enemyTimer = 0;
      advance(game, 1 / 60);
      assert.ok(
        Math.abs(enemyBefore.y - initialY - enemyBefore.speed / 60) < 1e-10,
      );
      const bullets = game.bullets.filter((b) => b.enemy);
      assert.ok(bullets.length >= 1 && bullets.length <= 2);
      assert.equal(new Set(bullets.map((b) => b.x)).size, bullets.length);
      shotCounts.add(bullets.length);
      delays.add(game.enemyTimer);
      const interval = [1.4, 1.1, 0.8][wave - 1];
      assert.ok(
        game.enemyTimer >= interval * 0.65 &&
          game.enemyTimer <= interval * 1.35,
      );
      assert.equal(
        radar(game).enemies[0].velocity_y,
        +enemyBefore.speed.toFixed(2),
      );
    }
  }
  assert.deepEqual([...shotCounts].sort(), [1, 2]);
  assert.ok(delays.size > 100);
});

test("ready and paused missions never advance or fire", () => {
  const game = createGame(42);
  applyCommand(game, { lane: 1 });
  advance(game, 1);
  assert.equal(game.elapsed, 0);
  assert.equal(game.x, 500);
  assert.equal(game.bullets.length, 0);
  game.status = "paused";
  advance(game, 1);
  assert.equal(game.x, 500);
});
test("weapons fire continuously without a Jev firing decision, including during dodges", () => {
  const game = createGame(42);
  game.status = "running";
  game.enemyTimer = 100;
  game.bullets = [{ id: 99, x: 500, y: 478, enemy: true }];
  for (let i = 0; i < 31; i++) advance(game, 1 / 60);
  assert.equal(game.fire, true);
  assert.ok(game.dodges > 0);
  assert.ok(game.bullets.filter((b) => !b.enemy).length >= 2);
  assert.deepEqual(Object.keys(pilotRequest(game).questions).sort(), [
    "lane",
    "threat",
  ]);
  game.enemies = [];
  advance(game, 1 / 60);
  assert.equal(game.fire, false);
});
test("attack radar accounts for escape speed, travel, cooldown and armor", () => {
  const game = createGame(42);
  game.shotTimer = 0.2;
  game.enemies = [
    { id: 91, x: 320, y: 430, hp: 2, speed: 30 },
    { id: 92, x: 680, y: 200, hp: 1, speed: 20 },
  ];
  const snapshot = radar(game);
  const urgent = snapshot.lanes[1].attack!;
  assert.equal(urgent.seconds_to_escape, 3.77);
  assert.equal(urgent.estimated_seconds_to_destroy, 0.83);
  assert.equal(urgent.escape_margin_seconds, 2.93);
  assert.equal(urgent.can_intercept, true);
  assert.ok(
    urgent.escape_margin_seconds <
      snapshot.lanes[3].attack!.escape_margin_seconds,
  );
  assert.equal(snapshot.lanes[2].attack, null);
  game.enemies[0].y = 542;
  assert.equal(radar(game).lanes[1].attack!.can_intercept, false);
});
test("arriving commands are checked against current bullets before any movement", () => {
  const game = createGame(42);
  game.status = "running";
  assert.equal(radar(game).lanes[3].dangerous_bullet_ids_on_route.length, 0);
  // A shot moves into the requested lane while the network response is pending.
  game.bullets = [{ id: 99, x: 680, y: 490, enemy: true }];
  applyCommand(game, { lane: 4 });
  assert.equal(game.targetLane, 4);
  assert.equal(game.dodgeX, 500);
  assert.equal(game.x, 500);
  game.bullets = [];
  advance(game, 1 / 60);
  assert.equal(game.dodgeX, null);
  assert.ok(game.x > 500);
});
test("commands move the ship and firing destroys targets", () => {
  const game = createGame(42);
  game.status = "running";
  applyCommand(game, { lane: 3 });
  for (let i = 0; i < 60; i++) advance(game, 1 / 60);
  assert.equal(game.score, 100);
  assert.equal(game.enemies.length, 4);
  applyCommand(game, { lane: 1 });
  for (let i = 0; i < 60; i++) advance(game, 1 / 60);
  assert.equal(game.x, WORLD.lanes[0]);
  assert.throws(() => applyCommand(game, { lane: 6 }));
});
test("enemy collision removes hull once and causes loss at zero", () => {
  const game = createGame(42);
  game.status = "running";
  game.hull = 1;
  game.bullets = [{ id: 999, x: game.x, y: WORLD.playerY - 18, enemy: true }];
  advance(game, 1 / 60);
  assert.equal(game.hull, 0);
  assert.equal(game.status, "lost");
});
test("waves progress to a definite victory and the mission has a time limit", () => {
  const game = createGame(42);
  game.status = "running";
  for (let wave = 1; wave <= 3; wave++) {
    game.enemies = [];
    for (let i = 0; i < 85; i++) advance(game, 1 / 60);
  }
  assert.equal(game.status, "won");
  assert.equal(game.wave, 3);
  const timed = createGame(42);
  timed.status = "running";
  timed.elapsed = 119.999;
  advance(timed, 1 / 60);
  assert.equal(timed.status, "lost");
});
test("radar and pilot request use textual JSON with correctly identified danger", () => {
  const game = createGame(42);
  game.bullets = [{ id: 9, x: 500, y: WORLD.playerY - 114, enemy: true }];
  const snapshot = radar(game);
  assert.deepEqual(
    snapshot.lanes[2].incoming_bullets_seconds_to_impact,
    [0.73],
  );
  assert.match(snapshot.lanes[2].danger, /INCOMING/);
  assert.match(snapshot.lanes[0].danger, /clear/);
  assert.equal(requestSchema.safeParse(pilotRequest(game)).success, true);
  assert.equal(
    JSON.stringify(pilotRequest(game)).includes("data:image"),
    false,
  );
});
test("radar sends individual projectile positions, ownership, velocity and route threats", () => {
  const game = createGame(42);
  game.bullets = [
    { id: 91, x: 500, y: 478, enemy: true },
    { id: 92, x: 500, y: 450, enemy: false },
    { id: 93, x: 500, y: 630, enemy: true },
  ];
  const snapshot = radar(game);
  assert.deepEqual(snapshot.bullets[0], {
    id: 91,
    owner: "enemy",
    x: 500,
    y: 478,
    velocity_x: 0,
    velocity_y: 156,
    distance_to_ship: 100,
    time_to_player_height_seconds: 0.64,
    threatens_current_motion: true,
  });
  assert.equal(snapshot.bullets[1].owner, "player");
  assert.equal(snapshot.bullets[1].velocity_y, -760);
  assert.equal(snapshot.bullets[1].threatens_current_motion, false);
  assert.equal(snapshot.bullets[2].time_to_player_height_seconds, null);
  assert.equal(snapshot.bullets[2].threatens_current_motion, false);
  assert.deepEqual(snapshot.lanes[2].dangerous_bullet_ids_on_route, [91]);
  assert.deepEqual(pilotRequest(game).state, snapshot);
});

test("short dodges clear shots and resume attacking without a fixed hold", () => {
  const game = createGame(42);
  game.status = "running";
  game.enemyTimer = 100;
  game.bullets = [{ id: 99, x: 500, y: 478, enemy: true }];
  advance(game, 1 / 60);
  assert.ok(game.dodgeX !== null && Math.abs(game.dodgeX - 500) < 60);
  assert.equal(game.dodges, 1);
  applyCommand(game, { lane: 3 });
  for (let i = 0; i < 20; i++) advance(game, 1 / 60);
  assert.ok(Math.abs(game.x - 500) < 60);
  assert.equal(game.targetLane, 3);
  for (let i = 0; i < 40; i++) advance(game, 1 / 60);
  assert.equal(game.hull, 3);
  assert.equal(game.dodgeX, null);
  assert.equal(game.x, 500);
  assert.equal(game.dodges, 1);
  assert.ok(game.elapsed < 1.05);
});

test("dodge avoids an occupied escape lane and stays inside the battlefield", () => {
  const game = createGame(42);
  game.status = "running";
  game.bullets = [
    { id: 91, x: 500, y: 478, enemy: true },
    { id: 92, x: 453, y: 478, enemy: true },
  ];
  advance(game, 1 / 60);
  assert.ok(game.dodgeX! > 500);
  assert.ok(game.x > 500);
  const edge = createGame(42);
  edge.status = "running";
  edge.x = 140;
  edge.targetLane = 1;
  edge.bullets = [{ id: 99, x: 140, y: 478, enemy: true }];
  advance(edge, 1 / 60);
  assert.ok(edge.dodgeX! > 140);
  assert.ok(edge.x >= 140);
});

test("friendly, distant and already-passed bullets do not trigger a dodge", () => {
  const game = createGame(42);
  game.status = "running";
  game.bullets = [
    { id: 91, x: 500, y: 478, enemy: false },
    { id: 92, x: 500, y: 650, enemy: true },
    { id: 93, x: 500, y: 100, enemy: true },
  ];
  advance(game, 1 / 60);
  assert.equal(game.dodgeX, null);
  assert.equal(game.x, 500);
});

test("reflex stops a route that crosses a projectile despite a clear destination", () => {
  const game = createGame(42);
  game.status = "running";
  game.x = 320;
  applyCommand(game, { lane: 5 });
  game.bullets = [
    { id: 99, x: 500, y: WORLD.playerY - 156 * 0.25, enemy: true },
  ];
  assert.deepEqual(radar(game).lanes[4].dangerous_bullet_ids_on_route, [99]);
  advance(game, 1 / 60);
  assert.equal(game.dodgeX, 320);
  assert.equal(game.x, 320);
});

test("pilot has one outstanding request and ignores results after pause or reset", async () => {
  const pending: ((d: typeof command) => void)[] = [];
  let requests = 0;
  let last: FlightView | undefined;
  const controller = new FlightController(
    (v) => {
      last = v;
    },
    async () => {
      requests++;
      return new Promise((resolve) => pending.push(resolve));
    },
  );
  controller.start();
  for (let i = 0; i < 100; i++) controller.step(100);
  assert.equal(requests, 1);
  assert.equal(controller.state.elapsed, 0);
  controller.pause();
  pending[0](command);
  await settle();
  assert.equal(controller.state.status, "paused");
  assert.equal(last?.decisions.length, 0);
  controller.start();
  pending[1](command);
  await settle();
  controller.step(100);
  assert.equal(controller.state.targetLane, 1);
  assert.ok(controller.state.elapsed > 0);
  controller.reset();
  assert.equal(controller.state.status, "ready");
  assert.equal(last?.calls, 0);
  controller.dispose();
});
test("an API failure pauses the game rather than substituting local decisions", async () => {
  let last: FlightView | undefined;
  const controller = new FlightController(
    (v) => {
      last = v;
    },
    async () => {
      throw new Error("Rate limit reached");
    },
  );
  controller.start();
  await settle();
  assert.equal(controller.state.status, "paused");
  assert.equal(last?.error, "Rate limit reached");
  assert.equal(last?.decisions.length, 0);
  controller.dispose();
});
