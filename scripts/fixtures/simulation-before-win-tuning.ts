export const WORLD = {
  width: 1000,
  height: 680,
  playerY: 578,
  lanes: [140, 320, 500, 680, 860],
};
const PLAYER_SPEED = 720;
const HITBOX = { halfWidth: 29, halfHeight: 18 };
// World units per second; shot intervals are seconds. Shared with radar prediction.
const ENEMY_PACE = [
  { approach: 20, bullet: 156, interval: 1.4, openingDelay: 0.8 },
  { approach: 28, bullet: 180, interval: 1.1, openingDelay: 0.7 },
  { approach: 36, bullet: 204, interval: 0.8, openingDelay: 0.6 },
] as const;
export type MissionStatus = "ready" | "running" | "paused" | "won" | "lost";
export type Enemy = {
  id: number;
  x: number;
  y: number;
  hp: number;
  speed: number;
};
export type Bullet = { id: number; x: number; y: number; enemy: boolean };
export type Burst = {
  id: number;
  x: number;
  y: number;
  age: number;
  player: boolean;
};
export type Command = { lane: number; fire: boolean };
export type GameState = {
  status: MissionStatus;
  elapsed: number;
  score: number;
  wave: number;
  hull: number;
  x: number;
  targetLane: number;
  fire: boolean;
  invulnerable: number;
  dodgeLane: number | null;
  dodgeUntil: number;
  dodges: number;
  enemies: Enemy[];
  bullets: Bullet[];
  bursts: Burst[];
  shotTimer: number;
  enemyTimer: number;
  waveTimer: number;
  nextId: number;
  rng: number;
};

function random(s: GameState) {
  s.rng = (Math.imul(s.rng, 1664525) + 1013904223) >>> 0;
  return s.rng / 4294967296;
}
export function spawnWave(s: GameState) {
  const count = s.wave === 1 ? 5 : s.wave === 2 ? 8 : 10;
  const pace = ENEMY_PACE[s.wave - 1];
  const lanes = [...WORLD.lanes];
  for (let i = lanes.length - 1; i > 0; i--) {
    const j = Math.floor(random(s) * (i + 1));
    [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
  }
  s.enemies = Array.from({ length: count }, (_, i) => ({
    id: s.nextId++,
    x: lanes[i % 5],
    y: 70 + Math.floor(i / 5) * 70 + (random(s) - 0.5) * 44,
    hp: s.wave === 3 ? 2 : 1,
    speed: pace.approach * (0.8 + random(s) * 0.45),
  }));
  s.enemyTimer = pace.openingDelay * (0.7 + random(s) * 0.6);
  s.bullets = [];
  s.waveTimer = 0;
  s.dodgeLane = null;
}
// Fresh missions vary; explicit seeds keep simulations reproducible for debugging.
export function createGame(
  seed = Math.floor(Math.random() * 0x100000000),
): GameState {
  const state: GameState = {
    status: "ready",
    elapsed: 0,
    score: 0,
    wave: 1,
    hull: 3,
    x: 500,
    targetLane: 3,
    fire: false,
    invulnerable: 0,
    dodgeLane: null,
    dodgeUntil: 0,
    dodges: 0,
    enemies: [],
    bullets: [],
    bursts: [],
    shotTimer: 0,
    enemyTimer: 1.5,
    waveTimer: 0,
    nextId: 1,
    rng: seed,
  };
  spawnWave(state);
  return state;
}
export function applyCommand(s: GameState, command: Command) {
  if (!Number.isInteger(command.lane) || command.lane < 1 || command.lane > 5)
    throw new Error("Invalid flight lane.");
  s.targetLane = command.lane;
  s.fire = command.fire;
}
function damage(s: GameState) {
  if (s.invulnerable > 0) return;
  s.hull--;
  s.invulnerable = 1.4;
  s.bursts.push({
    id: s.nextId++,
    x: s.x,
    y: WORLD.playerY,
    age: 0,
    player: true,
  });
  if (s.hull <= 0) {
    s.status = "lost";
    s.fire = false;
  }
}

function positionAlongPath(x: number, target: number, seconds: number) {
  return (
    x +
    Math.sign(target - x) *
      Math.min(Math.abs(target - x), PLAYER_SPEED * seconds)
  );
}

/** Check the entire horizontal route during each bullet's collision window. */
function trajectoryThreats(s: GameState, targetX: number, horizon: number) {
  const speed = ENEMY_PACE[s.wave - 1].bullet;
  return s.bullets.filter((b) => {
    if (!b.enemy) return false;
    const entry = Math.max(
      0,
      (WORLD.playerY - HITBOX.halfHeight - b.y) / speed,
    );
    const exit = Math.min(
      horizon,
      (WORLD.playerY + HITBOX.halfHeight - b.y) / speed,
    );
    if (exit < 0 || entry > exit) return false;
    const startX = positionAlongPath(s.x, targetX, entry);
    const endX = positionAlongPath(s.x, targetX, exit);
    return (
      b.x >= Math.min(startX, endX) - HITBOX.halfWidth - 12 &&
      b.x <= Math.max(startX, endX) + HITBOX.halfWidth + 12
    );
  });
}

function emergencyDodge(s: GameState) {
  if (s.dodgeLane !== null && s.elapsed >= s.dodgeUntil) s.dodgeLane = null;
  const targetX = WORLD.lanes[(s.dodgeLane ?? s.targetLane) - 1];
  if (!trajectoryThreats(s, targetX, 0.85).length) return;
  const currentRisk = trajectoryThreats(s, targetX, 1.25).length;
  const candidates = WORLD.lanes.map((x, index) => ({
    lane: index + 1,
    risk: trajectoryThreats(s, x, 1.25).length,
    distance: Math.abs(x - s.x),
  }));
  candidates.sort((a, b) => a.risk - b.risk || a.distance - b.distance);
  const best = candidates[0];
  if (best.risk >= currentRisk) return;
  s.dodgeLane = best.lane;
  // Commit through the bullet's passage; a delayed Jev command must not cancel a dodge.
  s.dodgeUntil =
    s.elapsed + Math.max(1.05, best.distance / PLAYER_SPEED + 0.25);
  s.dodges++;
}

/** Fixed-step simulation. All gameplay rules live here, independently of Phaser. */
export function advance(s: GameState, dt: number) {
  if (s.status !== "running") return;
  const pace = ENEMY_PACE[s.wave - 1];
  s.elapsed += dt;
  s.invulnerable = Math.max(0, s.invulnerable - dt);
  s.bursts = s.bursts.filter((b) => (b.age += dt) < 0.6);
  emergencyDodge(s);
  const target = WORLD.lanes[(s.dodgeLane ?? s.targetLane) - 1];
  s.x = positionAlongPath(s.x, target, dt);
  s.shotTimer -= dt;
  if (s.fire && s.shotTimer <= 0) {
    s.bullets.push({
      id: s.nextId++,
      x: s.x,
      y: WORLD.playerY - 28,
      enemy: false,
    });
    s.shotTimer = 0.24;
  }
  for (const enemy of s.enemies) enemy.y += enemy.speed * dt;
  s.enemyTimer -= dt;
  if (s.enemyTimer <= 0 && s.enemies.length) {
    const enemy = s.enemies[Math.floor(random(s) * s.enemies.length)];
    s.bullets.push({
      id: s.nextId++,
      x: enemy.x,
      y: enemy.y + 22,
      enemy: true,
    });
    // Occasional two-lane volleys break up the rhythm without filling every lane.
    const partners = s.enemies.filter((candidate) => candidate.x !== enemy.x);
    if (partners.length && random(s) < 0.2 + (s.wave - 1) * 0.1) {
      const partner = partners[Math.floor(random(s) * partners.length)];
      s.bullets.push({
        id: s.nextId++,
        x: partner.x,
        y: partner.y + 22,
        enemy: true,
      });
    }
    s.enemyTimer = pace.interval * (0.65 + random(s) * 0.7);
  }
  for (const bullet of s.bullets) {
    const previousY = bullet.y;
    bullet.y += (bullet.enemy ? pace.bullet : -760) * dt;
    if (bullet.enemy) {
      if (
        Math.abs(bullet.x - s.x) < HITBOX.halfWidth &&
        previousY <= WORLD.playerY + HITBOX.halfHeight &&
        bullet.y >= WORLD.playerY - HITBOX.halfHeight
      ) {
        damage(s);
        bullet.y = 9999;
      }
    } else {
      const hit = s.enemies.find(
        (e) =>
          e.hp > 0 &&
          Math.abs(e.x - bullet.x) < 30 &&
          previousY >= e.y - 23 &&
          bullet.y <= e.y + 23,
      );
      if (hit) {
        hit.hp--;
        bullet.y = -9999;
        if (hit.hp === 0) {
          s.score += 100;
          s.bursts.push({
            id: s.nextId++,
            x: hit.x,
            y: hit.y,
            age: 0,
            player: false,
          });
        }
      }
    }
  }
  const escaped = s.enemies.filter((e) => e.y > WORLD.playerY - 35 && e.hp > 0);
  if (escaped.length) damage(s);
  s.enemies = s.enemies.filter((e) => e.hp > 0 && e.y <= WORLD.playerY - 35);
  s.bullets = s.bullets.filter((b) => b.y > -25 && b.y < WORLD.height + 25);
  if (s.enemies.length === 0 && s.status === "running") {
    s.waveTimer += dt;
    if (s.waveTimer > 1.3) {
      if (s.wave === 3) {
        s.status = "won";
        s.fire = false;
      } else {
        s.wave++;
        spawnWave(s);
      }
    }
  }
  if (s.elapsed >= 120 && s.status === "running") {
    s.status = "lost";
    s.fire = false;
  }
}

export function radar(s: GameState) {
  const effectiveLane = s.dodgeLane ?? s.targetLane;
  const imminent = new Set(
    trajectoryThreats(s, WORLD.lanes[effectiveLane - 1], 0.85).map((b) => b.id),
  );
  return {
    mission:
      "Destroy all enemy ships in 3 waves. Stay alive. Bullets travel vertically. You can move horizontally between 5 lanes and fire upward with unlimited ammunition. A local emergency reflex can temporarily override your lane to avoid an imminent collision; you still choose the strategic lane and firing.",
    coordinates: {
      origin: "top left",
      x_direction: "right",
      y_direction: "down",
      width: WORLD.width,
      height: WORLD.height,
      position_units: "world pixels",
      velocity_units: "world pixels per second",
    },
    snapshot_time_seconds: +s.elapsed.toFixed(2),
    wave: s.wave,
    hull: s.hull,
    player_lane: Math.round((s.x - 140) / 180) + 1,
    target_lane: s.targetLane,
    player_x: Math.round(s.x),
    player_y: WORLD.playerY,
    player_speed: PLAYER_SPEED,
    enemies: s.enemies.map((e) => ({
      id: e.id,
      x: e.x,
      y: +e.y.toFixed(2),
      velocity_y: +e.speed.toFixed(2),
      hp: e.hp,
    })),
    emergency_reflex: {
      active: s.dodgeLane !== null,
      effective_target_lane: effectiveLane,
      dodges: s.dodges,
    },
    bullets: s.bullets.map((b) => ({
      id: b.id,
      owner: b.enemy ? "enemy" : "player",
      x: +b.x.toFixed(2),
      y: +b.y.toFixed(2),
      velocity_x: 0,
      velocity_y: b.enemy ? ENEMY_PACE[s.wave - 1].bullet : -760,
      distance_to_ship: +Math.hypot(b.x - s.x, b.y - WORLD.playerY).toFixed(2),
      time_to_player_height_seconds:
        b.enemy && b.y <= WORLD.playerY
          ? +((WORLD.playerY - b.y) / ENEMY_PACE[s.wave - 1].bullet).toFixed(2)
          : null,
      threatens_current_motion: imminent.has(b.id),
    })),
    lanes: WORLD.lanes.map((x, i) => {
      const incoming = s.bullets.filter(
        (b) => b.enemy && Math.abs(b.x - x) < 40 && b.y < WORLD.playerY + 20,
      );
      const arrivals = incoming.map((b) =>
        Math.max(0, (WORLD.playerY - b.y) / ENEMY_PACE[s.wave - 1].bullet),
      );
      const targets = s.enemies.filter((e) => Math.abs(e.x - x) < 40);
      const travel = Math.abs(s.x - x) / PLAYER_SPEED;
      const crossingBullets = trajectoryThreats(
        s,
        x,
        Math.max(1.5, travel),
      ).map((b) => b.id);
      const threatened = arrivals.some(
        (t) => t >= Math.max(0, travel - 0.3) && t < travel + 1.5,
      );
      const targetDistance = s.enemies.length
        ? Math.min(...s.enemies.map((e) => Math.abs(e.x - x) / 180))
        : 0;
      return {
        lane: i + 1,
        travel_seconds: +travel.toFixed(2),
        enemies: targets.length,
        lanes_away_from_nearest_enemy: targetDistance,
        nearest_enemy_y: targets.length
          ? Math.round(Math.max(...targets.map((e) => e.y)))
          : null,
        dangerous_bullet_ids_on_route: crossingBullets,
        incoming_bullets_seconds_to_impact: arrivals.map((t) => +t.toFixed(2)),
        danger:
          threatened || crossingBullets.length
            ? "INCOMING FIRE: unsafe route or impact soon after arrival"
            : "clear route and arrival window",
      };
    }),
  };
}
