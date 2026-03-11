import Phaser from 'phaser';
import { Boss } from '../Boss';
import { Player } from '../Player';
import { EnemyStateMachine } from '../../systems/EnemyStateMachine';
import { WORLD } from '../../config/GameConfig';
import type { BossArena } from '../../systems/BossArenaManager';

export class PlatformDevourer extends Boss {
  private stateMachine: EnemyStateMachine<PlatformDevourer>;
  private stateTimer: number = 0;

  // Arena reference for platform manipulation
  private arena: BossArena | null = null;

  // Phase settings
  private bitePlatformCount: number = 1;
  private emergeFromBothSides: boolean = false;
  private spikeCloseness: number = 0;

  // Disabled platforms tracking
  private disabledPlatforms: Map<Phaser.GameObjects.GameObject, Phaser.Time.TimerEvent> = new Map();

  // Tracked objects for cleanup
  private spikes: Phaser.GameObjects.Rectangle[] = [];

  // Emerge direction tracking
  private emergeFromLeft: boolean = true;

  constructor(scene: Phaser.Scene, x: number, y: number, player: Player, bossNumber: number) {
    super(scene, x, y, player, bossNumber, 'Platform Devourer');

    this.setTint(0x664422);
    this.setScale(1.7);
    this.speed = 150;

    // No gravity (worm-like, burrows through walls)
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);

    this.stateMachine = new EnemyStateMachine<PlatformDevourer>('BURROW', this);
    this.stateMachine
      .addState('BURROW', {
        onEnter: (ctx) => {
          ctx.stateTimer = 0;
          // Move off-screen, become invisible
          ctx.setAlpha(0);
          ctx.setPosition(-100, ctx.y);
          ctx.setVelocity(0, 0);
        },
        onUpdate: (ctx, _time, delta) => {
          ctx.stateTimer += delta;
          if (ctx.stateTimer >= 1500) {
            ctx.pickRandomAttack();
          }
        },
      })
      .addState('EMERGE', {
        onEnter: (ctx) => {
          ctx.stateTimer = 0;

          // Telegraph with screen shake
          ctx.scene.cameras.main.shake(200, 0.01);

          ctx.scene.time.delayedCall(200, () => {
            if (ctx.isDead || !ctx.active) return;

            ctx.setAlpha(1);

            if (ctx.emergeFromBothSides) {
              ctx.performDoubleEmerge();
            } else {
              ctx.performSingleEmerge();
            }
          });
        },
        onUpdate: (ctx, _time, delta) => {
          ctx.stateTimer += delta;
          if (ctx.stateTimer >= 2000) {
            ctx.stateMachine.transition('BURROW');
          }
        },
      })
      .addState('PLATFORM_BITE', {
        onEnter: (ctx) => {
          ctx.stateTimer = 0;
          ctx.setAlpha(1);

          // Position near a platform
          const arenaCenter = ctx.arena
            ? ctx.arena.centerY
            : ctx.y;
          ctx.setPosition(WORLD.WIDTH / 2, arenaCenter);

          ctx.performPlatformBite();
        },
        onUpdate: (ctx, _time, delta) => {
          ctx.stateTimer += delta;
          if (ctx.stateTimer >= 1500) {
            ctx.stateMachine.transition('BURROW');
          }
        },
      })
      .addState('SPIKE_WALL', {
        onEnter: (ctx) => {
          ctx.stateTimer = 0;
          ctx.setAlpha(1);
          ctx.setPosition(WORLD.WIDTH / 2, ctx.arena ? ctx.arena.centerY : ctx.y);
          ctx.spawnSpikeWalls();
        },
        onUpdate: (ctx, _time, delta) => {
          ctx.stateTimer += delta;
          if (ctx.stateTimer >= 1000) {
            ctx.stateMachine.transition('BURROW');
          }
        },
      })
      .addState('RECOVERY', {
        onEnter: (ctx) => {
          ctx.stateTimer = 0;
        },
        onUpdate: (ctx, _time, delta) => {
          ctx.stateTimer += delta;
          if (ctx.stateTimer >= 1500) {
            ctx.stateMachine.transition('BURROW');
          }
        },
      })
      .start();
  }

  /** Set the arena reference for platform manipulation */
  public setArena(arena: BossArena) {
    this.arena = arena;
  }

  private pickRandomAttack() {
    const attacks = ['EMERGE', 'PLATFORM_BITE', 'SPIKE_WALL'];
    const choice = attacks[Math.floor(Math.random() * attacks.length)];
    this.stateMachine.transition(choice);
  }

  private performSingleEmerge() {
    const startX = this.emergeFromLeft ? -50 : WORLD.WIDTH + 50;
    const sweepY = this.arena
      ? this.arena.centerY + Phaser.Math.Between(-80, 80)
      : this.y;

    this.setPosition(startX, sweepY);
    const direction = this.emergeFromLeft ? 1 : -1;
    this.setVelocityX(400 * direction);
    this.setVelocityY(0);
    this.setFlipX(!this.emergeFromLeft);

    this.emergeFromLeft = !this.emergeFromLeft;
  }

  private performDoubleEmerge() {
    // First sweep
    this.performSingleEmerge();

    // Second sweep from opposite side after delay
    this.scene.time.delayedCall(800, () => {
      if (this.isDead || !this.active) return;
      const startX = this.emergeFromLeft ? -50 : WORLD.WIDTH + 50;
      const sweepY = this.arena
        ? this.arena.centerY + Phaser.Math.Between(-80, 80)
        : this.y;

      this.setPosition(startX, sweepY);
      const direction = this.emergeFromLeft ? 1 : -1;
      this.setVelocityX(400 * direction);
      this.setVelocityY(0);
      this.setFlipX(!this.emergeFromLeft);

      this.emergeFromLeft = !this.emergeFromLeft;
    });
  }

  private performPlatformBite() {
    if (!this.arena) return;

    // Get arena platforms
    const arenaPlatforms: Phaser.GameObjects.GameObject[] = [];
    this.arena.platforms.children.each((child: Phaser.GameObjects.GameObject) => {
      if ((child as any).getData?.('arenaPlat') && (child as any).active) {
        // Don't bite already disabled platforms
        if (!this.disabledPlatforms.has(child)) {
          arenaPlatforms.push(child);
        }
      }
      return true;
    });

    // Bite up to bitePlatformCount platforms
    const platformsToBite = Phaser.Utils.Array.Shuffle(arenaPlatforms).slice(
      0,
      this.bitePlatformCount,
    );

    for (const plat of platformsToBite) {
      const sprite = plat as Phaser.Physics.Arcade.Sprite;

      // Move boss to platform position briefly
      this.setPosition(sprite.x, sprite.y - 30);

      // Disable the platform
      sprite.setAlpha(0.2);
      const platBody = sprite.body as Phaser.Physics.Arcade.StaticBody;
      if (platBody) {
        platBody.enable = false;
      }

      // Re-enable after 10 seconds
      const timer = this.scene.time.delayedCall(10000, () => {
        if (sprite.active) {
          sprite.setAlpha(1);
          if (platBody) {
            platBody.enable = true;
          }
        }
        this.disabledPlatforms.delete(plat);
      });

      this.disabledPlatforms.set(plat, timer);
    }
  }

  private spawnSpikeWalls() {
    const arenaHeight = this.arena ? this.arena.height : 384;
    const centerY = this.arena ? this.arena.centerY : this.y;

    // Left spike
    const leftSpikeX = 10 + this.spikeCloseness * 50;
    const leftSpike = this.scene.add.rectangle(
      leftSpikeX,
      centerY,
      20,
      arenaHeight,
      0x664422,
      0.8,
    );
    this.scene.physics.add.existing(leftSpike);
    (leftSpike.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    (leftSpike.body as Phaser.Physics.Arcade.Body).setImmovable(true);
    this.spikes.push(leftSpike);

    // Right spike
    const rightSpikeX = WORLD.WIDTH - 10 - this.spikeCloseness * 50;
    const rightSpike = this.scene.add.rectangle(
      rightSpikeX,
      centerY,
      20,
      arenaHeight,
      0x664422,
      0.8,
    );
    this.scene.physics.add.existing(rightSpike);
    (rightSpike.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    (rightSpike.body as Phaser.Physics.Arcade.Body).setImmovable(true);
    this.spikes.push(rightSpike);

    // Overlap with player for damage
    for (const spike of [leftSpike, rightSpike]) {
      this.scene.physics.add.overlap(this.player, spike, () => {
        if (!(this.player as any).isInvincible && spike.active) {
          (this.player as any).takeDamage(1);
        }
      });
    }

    // Destroy spikes after 500ms
    this.scene.time.delayedCall(500, () => {
      for (const spike of [leftSpike, rightSpike]) {
        const idx = this.spikes.indexOf(spike);
        if (idx !== -1) this.spikes.splice(idx, 1);
        if (spike.active) spike.destroy();
      }
    });
  }

  protected onPhaseChange(phase: number): void {
    if (phase === 2) {
      this.bitePlatformCount = 2;
      this.emergeFromBothSides = true;
      this.spikeCloseness = 1;
    } else if (phase === 3) {
      this.bitePlatformCount = 3;
      this.emergeFromBothSides = true;
      this.spikeCloseness = 2;
    }
  }

  protected getBossTint(): number {
    return 0x664422;
  }

  update(time: number, delta: number) {
    if (this.isDead) return;
    this.stateMachine.update(time, delta);
  }

  protected die() {
    // Re-enable all disabled platforms
    for (const [plat, timer] of this.disabledPlatforms.entries()) {
      timer.destroy();
      const sprite = plat as Phaser.Physics.Arcade.Sprite;
      if (sprite.active) {
        sprite.setAlpha(1);
        const platBody = sprite.body as Phaser.Physics.Arcade.StaticBody;
        if (platBody) {
          platBody.enable = true;
        }
      }
    }
    this.disabledPlatforms.clear();

    // Clean up spikes
    for (const spike of this.spikes) {
      if (spike.active) spike.destroy();
    }
    this.spikes.length = 0;

    super.die();
  }
}
