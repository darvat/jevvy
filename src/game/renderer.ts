import * as Phaser from "phaser";
import { WORLD } from "./simulation";
import type { FlightController } from "./controller";

const ASSETS = { fighter: "/game/fighter.png", space: "/game/space.png" };

export function mountGame(
  parent: HTMLElement,
  controller: FlightController,
  onReady: () => void,
  onError: (message: string) => void,
) {
  class FlightScene extends Phaser.Scene {
    private player!: Phaser.GameObjects.Image;
    private effects!: Phaser.GameObjects.Graphics;
    private ships = new Map<number, Phaser.GameObjects.Image>();
    private trails: { x: number; y: number; size: number; speed: number }[] =
      [];
    preload() {
      this.load.image("fighter", ASSETS.fighter);
      this.load.image("space", ASSETS.space);
      this.load.on("loaderror", () =>
        onError("A flight asset failed to load. Reload the page to try again."),
      );
    }
    create() {
      if (!this.textures.exists("fighter") || !this.textures.exists("space"))
        return;
      this.add
        .image(500, 340, "space")
        .setDisplaySize(1000, 750)
        .setAlpha(0.75);
      const grid = this.add.graphics();
      grid.lineStyle(1, 0x65939e, 0.12);
      for (const x of [230, 410, 590, 770]) {
        for (let y = 20; y < 635; y += 16) grid.lineBetween(x, y, x, y + 4);
      }
      for (let i = 0; i < 55; i++)
        this.trails.push({
          x: (i * 193 + 47) % 1000,
          y: (i * 89) % 680,
          size: i % 4 === 0 ? 1.4 : 0.7,
          speed: 5 + (i % 14),
        });
      this.effects = this.add.graphics();
      this.player = this.add
        .image(500, WORLD.playerY, "fighter")
        .setDisplaySize(104, 104)
        .setDepth(4);
      for (let i = 0; i < 5; i++)
        this.add
          .text(WORLD.lanes[i], 650, String(i + 1), {
            fontFamily: "monospace",
            fontSize: "13px",
            color: "#7f99ad",
          })
          .setOrigin(0.5);
      this.game.canvas.setAttribute(
        "aria-label",
        "Space battlefield: Jev pilots the cyan ship against descending enemy ships.",
      );
      this.game.canvas.setAttribute("role", "img");
      onReady();
    }
    update(_time: number, delta: number) {
      if (!this.player) return;
      controller.step(delta);
      const state = controller.state;
      this.effects.clear();
      for (const star of this.trails) {
        if (state.status === "running")
          star.y = (star.y + (star.speed * Math.min(delta, 100)) / 1000) % 680;
        this.effects.fillStyle(0x94c3cf, 0.3);
        this.effects.fillCircle(star.x, star.y, star.size);
      }
      if (state.status === "running") {
        const targetX = state.dodgeX ?? WORLD.lanes[state.targetLane - 1];
        const color = state.dodgeX === null ? 0x7de7ec : 0xffc47d;
        this.effects.fillStyle(color, 0.025);
        this.effects.fillRect(targetX - 75, 20, 150, 610);
        this.effects.lineStyle(1, color, 0.4);
        this.effects.lineBetween(targetX - 25, 629, targetX + 25, 629);
        if (state.dodgeX !== null) {
          this.effects.lineStyle(1, color, 0.65);
          this.effects.strokeCircle(state.x, WORLD.playerY, 43);
        }
      }
      this.player
        .setPosition(state.x, WORLD.playerY)
        .setAlpha(
          state.hull === 0
            ? 0.2
            : state.invulnerable > 0
              ? 0.35 + 0.65 * Math.abs(Math.sin(state.elapsed * 15))
              : 1,
        );
      const visibleIds = new Set(state.enemies.map((e) => e.id));
      for (const [id, ship] of this.ships)
        if (!visibleIds.has(id)) {
          ship.destroy();
          this.ships.delete(id);
        }
      for (const enemy of state.enemies) {
        let ship = this.ships.get(enemy.id);
        if (!ship) {
          ship = this.add
            .image(enemy.x, enemy.y, "fighter")
            .setDisplaySize(65, 65)
            .setAngle(180)
            .setTint(0xff7777)
            .setDepth(3);
          this.ships.set(enemy.id, ship);
        }
        ship.setPosition(enemy.x, enemy.y);
        if (enemy.hp > 1) {
          this.effects.lineStyle(1, 0xff8b79, 0.6);
          this.effects.strokeCircle(enemy.x, enemy.y, 30);
        }
      }
      for (const bullet of state.bullets) {
        const color = bullet.enemy ? 0xff736a : 0x81f6f5;
        this.effects.fillStyle(color, 0.12);
        this.effects.fillRoundedRect(bullet.x - 7, bullet.y - 13, 14, 26, 7);
        this.effects.fillStyle(color, 1);
        this.effects.fillRoundedRect(bullet.x - 2, bullet.y - 8, 4, 16, 2);
      }
      for (const burst of state.bursts) {
        const alpha = 1 - burst.age / 0.6;
        const color = burst.player ? 0x8ef5f3 : 0xff9779;
        this.effects.lineStyle(2, color, alpha);
        this.effects.strokeCircle(burst.x, burst.y, 8 + burst.age * 70);
        for (let i = 0; i < 8; i++) {
          const angle = (i * Math.PI) / 4;
          this.effects.fillStyle(color, alpha);
          this.effects.fillCircle(
            burst.x + Math.cos(angle) * burst.age * 95,
            burst.y + Math.sin(angle) * burst.age * 95,
            2,
          );
        }
      }
    }
  }
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: WORLD.width,
    height: WORLD.height,
    backgroundColor: "#050b13",
    scene: FlightScene,
    banner: false,
    audio: { noAudio: true },
    render: { antialias: true },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    fps: { target: 60 },
  });
  return () => game.destroy(true);
}
