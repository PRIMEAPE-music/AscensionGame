import Phaser from 'phaser';
import { Boss } from '../Boss';
import { Player } from '../Player';
import { ImpCrawler } from '../ImpCrawler';
import { ShadowBat } from '../ShadowBat';
import { EnemyStateMachine } from '../../systems/EnemyStateMachine';
import { WORLD, COMBAT } from '../../config/GameConfig';
import { EventBus } from '../../systems/EventBus';

export class LegionMaster extends Boss {
  private stateMachine: EnemyStateMachine<LegionMaster>;
  private stateTimer: number = 0;

  // Summoning
  private summonedMinions: Phaser.Physics.Arcade.Sprite[] = [];
  private maxMinions: number = 5;
  private summonType: 'crawler' | 'bat' = 'crawler';

  // Projectiles
  private projectiles: Phaser.GameObjects.Rectangle[] = [];
  private boltCount: number = 1;
  private readonly PROJECTILE_SPEED = 250;

  // Scene enemies group reference (set via setter after spawn)
  private enemiesGroup: Phaser.Physics.Arcade.Group | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, player: Player | Player[], bossNumber: number) {
    super(scene, x, y, player, bossNumber, 'Legion Master');

    this.setTint(0x440066);
    this.setScale(1.4);
    this.speed = 80;

    // Has gravity
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(true);

    this.stateMachine = new EnemyStateMachine<LegionMaster>('COMMAND', this);
    this.stateMachine
      .addState('COMMAND', {
        onEnter: (ctx) => {
          ctx.stateTimer = 0;
        },
        onUpdate: (ctx, _time, delta) => {
          ctx.stateTimer += delta;

          // Stay back from player, pace back and forth
          const dx = ctx.player.x - ctx.x;
          const preferredDistance = 300;

          if (Math.abs(dx) < preferredDistance) {
            // Move away from player
            const dir = dx > 0 ? -1 : 1;
            ctx.setVelocityX(ctx.speed * dir);
            ctx.setFlipX(dir < 0);
          } else {
            // Pace
            const dir = dx > 0 ? 1 : -1;
            ctx.setVelocityX(ctx.speed * 0.3 * dir);
            ctx.setFlipX(dir < 0);
          }

          if (ctx.stateTimer >= 2500) {
            ctx.pickRandomAttack();
          }
        },
      })
      .addState('SUMMON', {
        onEnter: (ctx) => {
          ctx.stateTimer = 0;
          ctx.setVelocityX(0);
          ctx.performSummon();
        },
        onUpdate: (ctx, _time, delta) => {
          ctx.stateTimer += delta;
          if (ctx.stateTimer >= 1000) {
            ctx.stateMachine.transition('RECOVERY');
          }
        },
      })
      .addState('DARK_BOLT', {
        onEnter: (ctx) => {
          ctx.stateTimer = 0;
          ctx.setVelocityX(0);
          ctx.fireDarkBolts();
        },
        onUpdate: (ctx, _time, delta) => {
          ctx.stateTimer += delta;
          if (ctx.stateTimer >= 800) {
            ctx.stateMachine.transition('RECOVERY');
          }
        },
      })
      .addState('BUFF_CIRCLE', {
        onEnter: (ctx) => {
          ctx.stateTimer = 0;
          ctx.setVelocityX(0);
          ctx.performBuff();
        },
        onUpdate: (ctx, _time, delta) => {
          ctx.stateTimer += delta;
          if (ctx.stateTimer >= 1000) {
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
      .addState('SLAM', {
        onEnter: (ctx) => {
          ctx.stateTimer = 0;
          ctx.performSlamAttack(() => {
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
        },
        onUpdate: (ctx, _time, delta) => {
          ctx.stateTimer += delta;
          if (ctx.stateTimer >= 2000) {
            ctx.stateMachine.transition('COMMAND');
          }
        },
      })
      .start();
  }

  /** Set the enemies group so summoned minions can be added to it */
  public setEnemiesGroup(group: Phaser.Physics.Arcade.Group) {
    this.enemiesGroup = group;
  }

  private pickRandomAttack() {
    // Clean up dead minions from tracking
    this.summonedMinions = this.summonedMinions.filter((m) => m.active);

    const attacks: string[] = [];

    // Always allow dark bolt and charge
    attacks.push('DARK_BOLT', 'CHARGE');

    // Summon if under cap
    if (this.summonedMinions.length < this.maxMinions) {
      attacks.push('SUMMON');
    }

    // Buff if minions exist
    if (this.summonedMinions.length > 0) {
      attacks.push('BUFF_CIRCLE');
    }

    // Slam and barrage from phase 2+
    if (this.phase >= 2) {
      attacks.push('SLAM', 'BARRAGE');
    }

    const choice = attacks[Math.floor(Math.random() * attacks.length)];
    this.stateMachine.transition(choice);
  }

  private performSummon() {
    const count = 3;
    for (let i = 0; i < count; i++) {
      if (this.summonedMinions.length >= this.maxMinions) break;

      const sx = this.x + Phaser.Math.Between(-150, 150);
      const sy = this.y - Phaser.Math.Between(0, 50);
      const clampedX = Phaser.Math.Clamp(sx, 50, WORLD.WIDTH - 50);

      let minion: Phaser.Physics.Arcade.Sprite;
      if (this.summonType === 'bat') {
        minion = new ShadowBat(this.scene, clampedX, sy, this._players);
      } else {
        minion = new ImpCrawler(this.scene, clampedX, sy, this._players);
      }

      this.summonedMinions.push(minion);

      if (this.enemiesGroup) {
        this.enemiesGroup.add(minion);
      }
    }
  }

  private fireDarkBolts() {
    const spreadAngle = this.boltCount > 1 ? 30 : 0;

    for (let i = 0; i < this.boltCount; i++) {
      const bolt = this.scene.add.rectangle(this.x, this.y, 10, 6, 0x8800ff);
      this.scene.physics.add.existing(bolt);
      const boltBody = bolt.body as Phaser.Physics.Arcade.Body;
      boltBody.setAllowGravity(false);

      // Calculate spread
      let angle = Phaser.Math.Angle.Between(this.x, this.y, this.player.x, this.player.y);
      if (this.boltCount > 1) {
        const spreadRad = Phaser.Math.DegToRad(spreadAngle);
        const step = spreadRad / (this.boltCount - 1);
        angle += -spreadRad / 2 + step * i;
      }

      boltBody.setVelocity(
        Math.cos(angle) * this.PROJECTILE_SPEED,
        Math.sin(angle) * this.PROJECTILE_SPEED,
      );

      this.projectiles.push(bolt);

      // Overlap with all players
      this.scene.physics.add.overlap(this._players, bolt, (p: any) => {
        if (!p.isInvincible && bolt.active) {
          p.takeDamage(1);

          EventBus.emit('health-change', {
            health: p.health,
            maxHealth: p.maxHealth,
          });

          // Knockback
          const direction = p.x > bolt.x ? 1 : -1;
          p.setVelocityX(COMBAT.KNOCKBACK_PLAYER.x * direction);
          p.setVelocityY(COMBAT.KNOCKBACK_PLAYER.y);

          const idx = this.projectiles.indexOf(bolt);
          if (idx !== -1) this.projectiles.splice(idx, 1);
          bolt.destroy();
        }
      });

      // Destroy after 3s
      this.scene.time.delayedCall(3000, () => {
        const idx = this.projectiles.indexOf(bolt);
        if (idx !== -1) this.projectiles.splice(idx, 1);
        if (bolt.active) bolt.destroy();
      });
    }
  }

  private performBuff() {
    // Buff all active minions: increase speed, golden tint
    for (const minion of this.summonedMinions) {
      if (!minion.active) continue;

      minion.setTint(0xffd700);

      // Temporarily increase speed
      const body = minion.body as Phaser.Physics.Arcade.Body;
      if (body) {
        const currentVx = body.velocity.x;
        body.setVelocityX(currentVx * 1.5);
      }

      // Revert tint after 4 seconds
      this.scene.time.delayedCall(4000, () => {
        if (minion.active) {
          minion.clearTint();
        }
      });
    }

    // Visual: show a buff circle around boss
    const circle = this.scene.add.circle(this.x, this.y, 100, 0xffd700, 0.2);
    this.scene.tweens.add({
      targets: circle,
      scale: 2,
      alpha: 0,
      duration: 800,
      onComplete: () => circle.destroy(),
    });
  }

  protected onPhaseChange(phase: number): void {
    if (phase === 2) {
      this.summonType = 'bat';
      this.boltCount = 3;
      this.maxMinions = 7;
    } else if (phase === 3) {
      this.summonType = 'bat';
      this.boltCount = 5;
      this.maxMinions = 10;
    }
  }

  protected getBossTint(): number {
    return 0x440066;
  }

  update(time: number, delta: number) {
    if (this.isDead) return;
    this.updateBoss(delta);
    this.stateMachine.update(time, delta);
  }

  protected die() {
    // Kill all summoned minions
    for (const minion of this.summonedMinions) {
      if (minion.active) {
        minion.destroy();
      }
    }
    this.summonedMinions.length = 0;

    // Clean up projectiles
    for (const proj of this.projectiles) {
      if (proj.active) proj.destroy();
    }
    this.projectiles.length = 0;

    this.cleanupSharedAttacks();
    super.die();
  }
}
