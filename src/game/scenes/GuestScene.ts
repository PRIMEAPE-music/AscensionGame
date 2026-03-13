import Phaser from "phaser";
import type {
  GameStateSnapshot,
  PlayerSnapshot,
  EnemySnapshot,
  BossSnapshot,
  ProjectileSnapshot,
  PlatformSnapshot,
} from "../systems/NetworkTypes";
import { InputForwarder } from "../systems/InputForwarder";
import { GamepadManager } from "../systems/GamepadManager";

/**
 * GuestScene — Lightweight render-only scene for the guest client in online co-op.
 *
 * Instead of running physics, AI, or level generation, this scene listens for
 * GameStateSnapshot messages dispatched by the networking layer and positions
 * simple colored rectangles to mirror what the host is simulating.
 *
 * V1 uses plain rectangles as stand-in sprites:
 *   Player   = blue/cyan  24×32
 *   Enemy    = red         20×24
 *   Boss     = dark red    40×48
 *   Projectile = yellow     8×8
 *   Platform = green       (width derived from scaleX)
 */
export class GuestScene extends Phaser.Scene {
  // ── Sprite pools ──────────────────────────────────────────────────────
  private _playerSprites: Map<number, Phaser.GameObjects.Rectangle> = new Map();
  private _enemySprites: Map<number, Phaser.GameObjects.Rectangle> = new Map();
  private _platformSprites: Phaser.GameObjects.Rectangle[] = [];
  private _projectileSprites: Map<number, Phaser.GameObjects.Rectangle> = new Map();
  private _bossSprite: Phaser.GameObjects.Rectangle | null = null;

  // ── State ─────────────────────────────────────────────────────────────
  private _latestSnapshot: GameStateSnapshot | null = null;
  private _hudGroup!: Phaser.GameObjects.Group;

  // ── Event listener ref (so we can remove it on shutdown) ──────────────
  private _onStateUpdate: ((e: Event) => void) | null = null;

  constructor() {
    super({ key: "GuestScene" });
  }

  // =====================================================================
  //  Lifecycle
  // =====================================================================

  create(): void {
    // Reset collections
    this._playerSprites = new Map();
    this._enemySprites = new Map();
    this._platformSprites = [];
    this._projectileSprites = new Map();
    this._bossSprite = null;
    this._latestSnapshot = null;
    this._hudGroup = this.add.group();

    // Dark background
    this.cameras.main.setBackgroundColor("#0a0a12");

    // Large world bounds (vertical scrolling game)
    this.physics.world.setBounds(0, -100000, 800, 200000);

    // Camera follows nothing initially — we manually set scrollY from snapshot
    this.cameras.main.stopFollow();

    // Initialize input forwarding so our inputs get sent to the host
    InputForwarder.init(this);

    // Listen for snapshots dispatched by the network layer
    this._onStateUpdate = (e: Event) => {
      const ce = e as CustomEvent<GameStateSnapshot>;
      this._latestSnapshot = ce.detail;
    };
    window.addEventListener("online-state-update", this._onStateUpdate);
  }

  update(): void {
    // Poll gamepad and forward input to host each frame
    GamepadManager.update();
    InputForwarder.update();

    if (!this._latestSnapshot) return;
    this.applySnapshot(this._latestSnapshot);
  }

  shutdown(): void {
    // Stop input forwarding
    InputForwarder.reset();

    // Remove window listener
    if (this._onStateUpdate) {
      window.removeEventListener("online-state-update", this._onStateUpdate);
      this._onStateUpdate = null;
    }

    // Destroy player sprites
    this._playerSprites.forEach((s) => s.destroy());
    this._playerSprites.clear();

    // Destroy enemy sprites
    this._enemySprites.forEach((s) => s.destroy());
    this._enemySprites.clear();

    // Destroy projectile sprites
    this._projectileSprites.forEach((s) => s.destroy());
    this._projectileSprites.clear();

    // Destroy platforms
    for (const p of this._platformSprites) {
      p.destroy();
    }
    this._platformSprites = [];

    // Destroy boss
    if (this._bossSprite) {
      this._bossSprite.destroy();
      this._bossSprite = null;
    }

    // Destroy HUD group
    if (this._hudGroup) {
      this._hudGroup.destroy(true);
    }

    this._latestSnapshot = null;
  }

  // =====================================================================
  //  Snapshot application
  // =====================================================================

  private applySnapshot(snap: GameStateSnapshot): void {
    // ── Camera ──────────────────────────────────────────────────────────
    this.cameras.main.scrollY = snap.cameraY;

    // ── Players ─────────────────────────────────────────────────────────
    for (const ps of snap.players) {
      const rect = this._getOrCreatePlayer(ps.playerIndex);
      rect.setPosition(ps.x, ps.y);
      rect.setFlipX(ps.flipX);
      rect.setVisible(true);
      // Tint: player 0 = blue, player 1 = cyan
      rect.fillColor = ps.playerIndex === 0 ? 0x3388ff : 0x33ffee;
      // Alpha flash when invincible
      rect.setAlpha(ps.invincible ? 0.5 : 1);

      // Dispatch health-change for HUD
      window.dispatchEvent(
        new CustomEvent("health-change", {
          detail: {
            playerIndex: ps.playerIndex,
            health: ps.health,
            maxHealth: ps.maxHealth,
          },
        }),
      );
    }

    // Hide player sprites that are no longer in the snapshot
    const activePlayerIndices = new Set(snap.players.map((p) => p.playerIndex));
    this._playerSprites.forEach((rect, idx) => {
      if (!activePlayerIndices.has(idx)) {
        rect.setVisible(false);
      }
    });

    // ── Enemies ─────────────────────────────────────────────────────────
    const activeEnemyNids = new Set<number>();
    for (const es of snap.enemies) {
      activeEnemyNids.add(es.nid);
      const rect = this._getOrCreateEnemy(es.nid);
      rect.setPosition(es.x, es.y);
      rect.setFlipX(es.flipX);
      rect.setVisible(es.active);
    }

    // Remove sprites for enemies no longer in the snapshot
    this._enemySprites.forEach((rect, nid) => {
      if (!activeEnemyNids.has(nid)) {
        rect.destroy();
        this._enemySprites.delete(nid);
      }
    });

    // ── Boss ────────────────────────────────────────────────────────────
    if (snap.boss) {
      if (!this._bossSprite) {
        this._bossSprite = this.add.rectangle(
          snap.boss.x,
          snap.boss.y,
          40,
          48,
          0x8b0000,
        );
      }
      this._bossSprite.setPosition(snap.boss.x, snap.boss.y);
      this._bossSprite.setFlipX(snap.boss.flipX);
      this._bossSprite.setVisible(snap.boss.active);
    } else if (this._bossSprite) {
      this._bossSprite.setVisible(false);
    }

    // ── Projectiles ─────────────────────────────────────────────────────
    const activeProjNids = new Set<number>();
    for (const pr of snap.projectiles) {
      activeProjNids.add(pr.nid);
      const rect = this._getOrCreateProjectile(pr.nid);
      rect.setPosition(pr.x, pr.y);
      rect.setVisible(true);
    }

    // Remove sprites for projectiles no longer in the snapshot
    this._projectileSprites.forEach((rect, nid) => {
      if (!activeProjNids.has(nid)) {
        rect.destroy();
        this._projectileSprites.delete(nid);
      }
    });

    // ── Platforms ────────────────────────────────────────────────────────
    // Destroy old platform rects and rebuild from snapshot
    for (const p of this._platformSprites) {
      p.destroy();
    }
    this._platformSprites = [];

    for (const pl of snap.platforms) {
      const rect = this.add.rectangle(pl.x, pl.y, 64, 16, 0x22aa44);
      rect.setScale(pl.scaleX, 1);
      if (pl.tint !== undefined) {
        rect.fillColor = pl.tint;
      }
      this._platformSprites.push(rect);
    }

    // ── HUD events ──────────────────────────────────────────────────────
    window.dispatchEvent(
      new CustomEvent("altitude-change", {
        detail: { altitude: snap.altitude },
      }),
    );

    window.dispatchEvent(
      new CustomEvent("essence-change", {
        detail: { essence: snap.essence },
      }),
    );

    window.dispatchEvent(
      new CustomEvent("combo-update", {
        detail: {
          count: snap.comboCount,
          multiplier: snap.comboMultiplier,
        },
      }),
    );
  }

  // =====================================================================
  //  Helpers — sprite pool
  // =====================================================================

  private _getOrCreatePlayer(index: number): Phaser.GameObjects.Rectangle {
    let rect = this._playerSprites.get(index);
    if (rect) return rect;

    // Player 0 = blue (0x3388ff), Player 1 = cyan (0x33ffee)
    const color = index === 0 ? 0x3388ff : 0x33ffee;
    rect = this.add.rectangle(0, 0, 24, 32, color);
    this._playerSprites.set(index, rect);
    return rect;
  }

  private _getOrCreateEnemy(nid: number): Phaser.GameObjects.Rectangle {
    let rect = this._enemySprites.get(nid);
    if (rect) return rect;

    rect = this.add.rectangle(0, 0, 20, 24, 0xff2222);
    this._enemySprites.set(nid, rect);
    return rect;
  }

  private _getOrCreateProjectile(nid: number): Phaser.GameObjects.Rectangle {
    let rect = this._projectileSprites.get(nid);
    if (rect) return rect;

    rect = this.add.rectangle(0, 0, 8, 8, 0xffff00);
    this._projectileSprites.set(nid, rect);
    return rect;
  }
}
