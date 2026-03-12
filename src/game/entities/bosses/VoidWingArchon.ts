import Phaser from 'phaser';
import { Boss } from '../Boss';
import { Player } from '../Player';
import { EnemyStateMachine } from '../../systems/EnemyStateMachine';
import { WORLD } from '../../config/GameConfig';

export class VoidWingArchon extends Boss {
  private stateMachine: EnemyStateMachine<VoidWingArchon>;
  private stateTimer: number = 0;
  private hoverY: number;
  private hoverDirection: number = 1;
  private diveCount: number = 1;
  private currentDive: number = 0;
  private featherCount: number = 5;
  private moveSpeedMult: number = 1;

  // Tracked objects for cleanup
  private feathers: Phaser.GameObjects.Rectangle[] = [];

  constructor(scene: Phaser.Scene, x: number, y: number, player: Player, bossNumber: number) {
    super(scene, x, y, player, bossNumber, 'Void Wing Archon');

    this.setTint(0x6600ff);
    this.setScale(1.4);
    this.speed = 200;
    this.hoverY = y - 150;

    // Flying boss: no gravity
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);

    this.stateMachine = new EnemyStateMachine<VoidWingArchon>('HOVER', this);
    this.stateMachine
      .addState('HOVER', {
        onEnter: (ctx) => {
          ctx.stateTimer = 0;
          ctx.setVelocityY(0);
        },
        onUpdate: (ctx, _time, delta) => {
          ctx.stateTimer += delta;

          // Float at upper portion, sway left/right
          const targetY = ctx.hoverY;
          const dy = targetY - ctx.y;
          ctx.setVelocityY(dy * 2);

          ctx.setVelocityX(ctx.speed * ctx.moveSpeedMult * ctx.hoverDirection * 0.3);
          if (ctx.x <= 100 || ctx.x >= WORLD.WIDTH - 100) {
            ctx.hoverDirection *= -1;
          }
          ctx.setFlipX(ctx.hoverDirection < 0);

          // Choose attack after hovering for a bit
          if (ctx.stateTimer >= 2000) {
            const attacks = ['DIVE_BOMB', 'FEATHER_STORM', 'CHARGE'];
            if (ctx.phase >= 2) {
              attacks.push('BARRAGE');
            }
            const choice = attacks[Math.floor(Math.random() * attacks.length)];
            if (choice === 'DIVE_BOMB') {
              ctx.currentDive = 0;
            }
            ctx.stateMachine.transition(choice);
          }
        },
      })
      .addState('DIVE_BOMB', {
        onEnter: (ctx) => {
          ctx.stateTimer = 0;
          ctx.setVelocity(0, 0);
          // Telegraph: flash
          ctx.setTint(0xffffff);
        },
        onUpdate: (ctx, _time, delta) => {
          ctx.stateTimer += delta;

          if (ctx.stateTimer < 600) {
            // Telegraph phase - flash
            return;
          }

          if (ctx.stateTimer >= 600 && ctx.stateTimer < 600 + delta + 1) {
            // Start dive
            ctx.setTint(ctx.getBossTint());
            const angle = Phaser.Math.Angle.Between(ctx.x, ctx.y, ctx.player.x, ctx.player.y);
            ctx.setVelocity(Math.cos(angle) * 500, Math.sin(angle) * 500);
          }

          // Check if we've gone past the player's Y or hit a low point
          if (ctx.stateTimer >= 1200) {
            ctx.currentDive++;
            if (ctx.currentDive < ctx.diveCount) {
              // Reset for another dive
              ctx.stateTimer = 0;
              ctx.setVelocity(0, 0);
              ctx.setTint(0xffffff);
              // Move back up
              ctx.setVelocityY(-300);
            } else {
              ctx.stateMachine.transition('RECOVERY');
            }
          }
        },
      })
      .addState('FEATHER_STORM', {
        onEnter: (ctx) => {
          ctx.stateTimer = 0;
          ctx.setVelocityX(0);
          ctx.spawnFeathers();
        },
        onUpdate: (ctx, _time, delta) => {
          ctx.stateTimer += delta;
          if (ctx.stateTimer >= 1500) {
            ctx.stateMachine.transition('RECOVERY');
          }
        },
      })
      .addState('CHARGE', {
        onEnter: (ctx) => {
          ctx.stateTimer = 0;
          ctx.performChargeAttack(() => {
            if (!ctx.isDead && ctx.active) {
              ctx.stateMachine.transition('RECOVERY');
            }
          });
        },
        onUpdate: (ctx, _time, delta) => {
          ctx.stateTimer += delta;
          if (ctx.stateTimer >= 3000) {
            ctx.stateMachine.transition('RECOVERY');
          }
        },
      })
      .addState('BARRAGE', {
        onEnter: (ctx) => {
          ctx.stateTimer = 0;
          ctx.performProjectileBarrage(() => {
            if (!ctx.isDead && ctx.active) {
              ctx.stateMachine.transition('RECOVERY');
            }
          });
        },
        onUpdate: (ctx, _time, delta) => {
          ctx.stateTimer += delta;
          if (ctx.stateTimer >= 3000) {
            ctx.stateMachine.transition('RECOVERY');
          }
        },
      })
      .addState('RECOVERY', {
        onEnter: (ctx) => {
          ctx.stateTimer = 0;
          // Return to hover height
          const dy = ctx.hoverY - ctx.y;
          ctx.setVelocityY(dy > 0 ? 200 : -200);
          ctx.setVelocityX(0);
        },
        onUpdate: (ctx, _time, delta) => {
          ctx.stateTimer += delta;
          // Ease back to hover Y
          const dy = ctx.hoverY - ctx.y;
          ctx.setVelocityY(dy * 2);

          if (ctx.stateTimer >= 1500) {
            ctx.stateMachine.transition('HOVER');
          }
        },
      })
      .start();
  }

  private spawnFeathers() {
    const spacing = WORLD.WIDTH / (this.featherCount + 1);
    for (let i = 0; i < this.featherCount; i++) {
      const fx = spacing * (i + 1) + Phaser.Math.Between(-30, 30);
      const fy = this.y - 20;

      const feather = this.scene.add.rectangle(fx, fy, 10, 10, 0x8800ff);
      this.scene.physics.add.existing(feather);
      const featherBody = feather.body as Phaser.Physics.Arcade.Body;
      featherBody.setAllowGravity(true);

      this.feathers.push(feather);

      // Overlap with player
      this.scene.physics.add.overlap(this.player, feather, () => {
        if (!(this.player as any).isInvincible && feather.active) {
          (this.player as any).takeDamage(1);
          const idx = this.feathers.indexOf(feather);
          if (idx !== -1) this.feathers.splice(idx, 1);
          feather.destroy();
        }
      });

      // Destroy after 4s or on platform collision
      this.scene.time.delayedCall(4000, () => {
        const idx = this.feathers.indexOf(feather);
        if (idx !== -1) this.feathers.splice(idx, 1);
        if (feather.active) feather.destroy();
      });
    }
  }

  protected onPhaseChange(phase: number): void {
    if (phase === 2) {
      this.diveCount = 2;
      this.featherCount = 8;
    } else if (phase === 3) {
      this.diveCount = 3;
      this.featherCount = 10;
      this.moveSpeedMult = 1.5;
    }
  }

  protected getBossTint(): number {
    return 0x6600ff;
  }

  update(time: number, delta: number) {
    if (this.isDead) return;
    this.updateBoss(delta);
    this.stateMachine.update(time, delta);
  }

  protected die() {
    for (const feather of this.feathers) {
      if (feather.active) feather.destroy();
    }
    this.feathers.length = 0;

    this.cleanupSharedAttacks();
    super.die();
  }
}
