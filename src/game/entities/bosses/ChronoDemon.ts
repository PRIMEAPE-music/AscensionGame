import Phaser from 'phaser';
import { Boss } from '../Boss';
import { Player } from '../Player';
import { EnemyStateMachine } from '../../systems/EnemyStateMachine';
import { WORLD } from '../../config/GameConfig';

interface PositionRecord {
  x: number;
  y: number;
  time: number;
}

export class ChronoDemon extends Boss {
  private stateMachine: EnemyStateMachine<ChronoDemon>;
  private stateTimer: number = 0;

  // Position history for rewind
  private positionHistory: PositionRecord[] = [];
  private historyInterval: number = 100; // Record every 100ms
  private historyTimer: number = 0;
  private readonly REWIND_LOOKBACK = 3000; // 3 seconds

  // Phase-specific settings
  private bombCount: number = 3;
  private strikeOrder: number[] = [0, 1, 2, 3]; // Position indices
  private rewindCount: number = 1;

  // Strike positions relative to arena center
  private strikePositions: { x: number; y: number }[] = [];

  // Tracked objects for cleanup
  private bombs: Phaser.GameObjects.Rectangle[] = [];
  private strikeIndicators: Phaser.GameObjects.Rectangle[] = [];
  private dashHitboxes: Phaser.GameObjects.Rectangle[] = [];

  private currentStrikeIndex: number = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, player: Player, bossNumber: number) {
    super(scene, x, y, player, bossNumber, 'Chrono Demon');

    this.setTint(0x00ffaa);
    this.setScale(1.3);
    this.speed = 150;

    // Has gravity
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(true);

    // Define strike positions (left, right, top-left, top-right of arena)
    this.strikePositions = [
      { x: WORLD.WIDTH * 0.2, y: y },           // left
      { x: WORLD.WIDTH * 0.8, y: y },           // right
      { x: WORLD.WIDTH * 0.25, y: y - 150 },    // top-left
      { x: WORLD.WIDTH * 0.75, y: y - 150 },    // top-right
    ];

    this.stateMachine = new EnemyStateMachine<ChronoDemon>('IDLE', this);
    this.stateMachine
      .addState('IDLE', {
        onEnter: (ctx) => {
          ctx.stateTimer = 0;
        },
        onUpdate: (ctx, _time, delta) => {
          ctx.stateTimer += delta;

          // Pace toward player
          const dir = ctx.player.x > ctx.x ? 1 : -1;
          ctx.setVelocityX(ctx.speed * 0.5 * dir);
          ctx.setFlipX(dir < 0);

          if (ctx.stateTimer >= 2000) {
            ctx.pickRandomAttack();
          }
        },
      })
      .addState('SEQUENTIAL_STRIKE', {
        onEnter: (ctx) => {
          ctx.stateTimer = 0;
          ctx.currentStrikeIndex = 0;
          ctx.setVelocityX(0);
          ctx.performStrike();
        },
        onUpdate: (ctx, _time, delta) => {
          ctx.stateTimer += delta;
        },
      })
      .addState('TIME_BOMB', {
        onEnter: (ctx) => {
          ctx.stateTimer = 0;
          ctx.setVelocityX(0);
          ctx.spawnTimeBombs();
        },
        onUpdate: (ctx, _time, delta) => {
          ctx.stateTimer += delta;
          if (ctx.stateTimer >= 3000) {
            ctx.stateMachine.transition('RECOVERY');
          }
        },
      })
      .addState('REWIND', {
        onEnter: (ctx) => {
          ctx.stateTimer = 0;
          ctx.setVelocityX(0);
          ctx.performRewind(0);
        },
        onUpdate: (ctx, _time, delta) => {
          ctx.stateTimer += delta;
        },
      })
      .addState('RECOVERY', {
        onEnter: (ctx) => {
          ctx.stateTimer = 0;
        },
        onUpdate: (ctx, _time, delta) => {
          ctx.stateTimer += delta;
          if (ctx.stateTimer >= 1500) {
            ctx.stateMachine.transition('IDLE');
          }
        },
      })
      .start();
  }

  private pickRandomAttack() {
    const attacks = ['SEQUENTIAL_STRIKE', 'TIME_BOMB', 'REWIND'];
    const choice = attacks[Math.floor(Math.random() * attacks.length)];
    this.stateMachine.transition(choice);
  }

  private performStrike() {
    if (this.currentStrikeIndex >= this.strikeOrder.length) {
      this.stateMachine.transition('RECOVERY');
      return;
    }

    const posIndex = this.strikeOrder[this.currentStrikeIndex];
    const target = this.strikePositions[posIndex];
    if (!target) {
      this.stateMachine.transition('RECOVERY');
      return;
    }

    // Show telegraph indicator at destination
    const indicator = this.scene.add.rectangle(target.x, target.y, 40, 40, 0x00ffaa, 0.4);
    this.strikeIndicators.push(indicator);

    // After telegraph, teleport and create damage hitbox
    this.scene.time.delayedCall(300, () => {
      if (this.isDead || !this.active) return;

      // Remove indicator
      const idx = this.strikeIndicators.indexOf(indicator);
      if (idx !== -1) this.strikeIndicators.splice(idx, 1);
      indicator.destroy();

      // Teleport to position
      this.setPosition(target.x, target.y);
      this.setVelocity(0, 0);

      // Create brief damage hitbox at the dash destination
      const hitbox = this.scene.add.rectangle(target.x, target.y, 60, 60, 0x00ffaa, 0.3);
      this.scene.physics.add.existing(hitbox);
      (hitbox.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
      this.dashHitboxes.push(hitbox);

      this.scene.physics.add.overlap(this.player, hitbox, () => {
        if (!(this.player as any).isInvincible && hitbox.active) {
          (this.player as any).takeDamage(1);
        }
      });

      // Destroy hitbox after brief time
      this.scene.time.delayedCall(200, () => {
        const hIdx = this.dashHitboxes.indexOf(hitbox);
        if (hIdx !== -1) this.dashHitboxes.splice(hIdx, 1);
        if (hitbox.active) hitbox.destroy();
      });

      // Next strike
      this.currentStrikeIndex++;
      this.scene.time.delayedCall(400, () => {
        if (this.isDead || !this.active) return;
        this.performStrike();
      });
    });
  }

  private spawnTimeBombs() {
    const timers = [1000, 1500, 2000, 1200, 1800, 2500, 800];

    for (let i = 0; i < this.bombCount; i++) {
      const bx = Phaser.Math.Between(100, WORLD.WIDTH - 100);
      const by = this.y + Phaser.Math.Between(-100, 50);
      const fuseTime = timers[i % timers.length];

      const bomb = this.scene.add.rectangle(bx, by, 20, 20, 0x00ff88);
      this.scene.physics.add.existing(bomb);
      (bomb.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
      this.bombs.push(bomb);

      // Flash as timer counts down
      const flashEvent = this.scene.time.addEvent({
        delay: 200,
        callback: () => {
          if (bomb.active) {
            bomb.setAlpha(bomb.alpha < 1 ? 1 : 0.4);
          }
        },
        repeat: Math.floor(fuseTime / 200),
      });

      // Explode after fuse time
      this.scene.time.delayedCall(fuseTime, () => {
        if (!bomb.active) return;
        flashEvent.destroy();

        // Create explosion zone
        const explosion = this.scene.add.rectangle(bx, by, 80, 80, 0x00ffaa, 0.5);
        this.scene.physics.add.existing(explosion);
        (explosion.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);

        this.scene.physics.add.overlap(this.player, explosion, () => {
          if (!(this.player as any).isInvincible && explosion.active) {
            (this.player as any).takeDamage(1);
          }
        });

        // Remove explosion after 200ms
        this.scene.time.delayedCall(200, () => {
          if (explosion.active) explosion.destroy();
        });

        // Remove bomb
        const idx = this.bombs.indexOf(bomb);
        if (idx !== -1) this.bombs.splice(idx, 1);
        bomb.destroy();
      });
    }
  }

  private performRewind(rewindIndex: number) {
    if (rewindIndex >= this.rewindCount) {
      this.stateMachine.transition('RECOVERY');
      return;
    }

    // Find position from ~3 seconds ago
    const now = this.scene.time.now;
    const targetTime = now - this.REWIND_LOOKBACK;
    let rewindPos: PositionRecord | null = null;

    for (let i = this.positionHistory.length - 1; i >= 0; i--) {
      if (this.positionHistory[i].time <= targetTime) {
        rewindPos = this.positionHistory[i];
        break;
      }
    }

    if (!rewindPos) {
      // Fallback: teleport to random position
      rewindPos = {
        x: Phaser.Math.Between(200, WORLD.WIDTH - 200),
        y: this.y - 50,
        time: now,
      };
    }

    // Flash effect before teleport
    this.setTint(0xffffff);
    this.scene.time.delayedCall(200, () => {
      if (this.isDead || !this.active) return;

      // Teleport to rewind position
      this.setPosition(rewindPos.x, rewindPos.y);
      this.setTint(this.getBossTint());

      // Create damage hitbox at rewind destination
      const hitbox = this.scene.add.rectangle(rewindPos.x, rewindPos.y, 60, 60, 0x00ffaa, 0.3);
      this.scene.physics.add.existing(hitbox);
      (hitbox.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
      this.dashHitboxes.push(hitbox);

      this.scene.physics.add.overlap(this.player, hitbox, () => {
        if (!(this.player as any).isInvincible && hitbox.active) {
          (this.player as any).takeDamage(1);
        }
      });

      this.scene.time.delayedCall(200, () => {
        const hIdx = this.dashHitboxes.indexOf(hitbox);
        if (hIdx !== -1) this.dashHitboxes.splice(hIdx, 1);
        if (hitbox.active) hitbox.destroy();
      });

      // Next rewind
      this.scene.time.delayedCall(500, () => {
        if (this.isDead || !this.active) return;
        this.performRewind(rewindIndex + 1);
      });
    });
  }

  protected onPhaseChange(phase: number): void {
    if (phase === 2) {
      // Mixed strike order
      this.strikeOrder = [0, 2, 1, 3];
      this.bombCount = 5;
    } else if (phase === 3) {
      // Random strike order
      this.strikeOrder = Phaser.Utils.Array.Shuffle([0, 1, 2, 3]);
      this.bombCount = 7;
      this.rewindCount = 3;
    }
  }

  protected getBossTint(): number {
    return 0x00ffaa;
  }

  update(time: number, delta: number) {
    if (this.isDead) return;

    // Record position history
    this.historyTimer += delta;
    if (this.historyTimer >= this.historyInterval) {
      this.historyTimer = 0;
      this.positionHistory.push({
        x: this.x,
        y: this.y,
        time: this.scene.time.now,
      });

      // Keep only last 5 seconds of history
      const cutoff = this.scene.time.now - 5000;
      while (this.positionHistory.length > 0 && this.positionHistory[0].time < cutoff) {
        this.positionHistory.shift();
      }
    }

    this.stateMachine.update(time, delta);
  }

  protected die() {
    for (const bomb of this.bombs) {
      if (bomb.active) bomb.destroy();
    }
    this.bombs.length = 0;

    for (const indicator of this.strikeIndicators) {
      if (indicator.active) indicator.destroy();
    }
    this.strikeIndicators.length = 0;

    for (const hitbox of this.dashHitboxes) {
      if (hitbox.active) hitbox.destroy();
    }
    this.dashHitboxes.length = 0;

    this.positionHistory.length = 0;

    super.die();
  }
}
