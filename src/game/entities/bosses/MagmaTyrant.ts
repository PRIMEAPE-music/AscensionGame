import Phaser from 'phaser';
import { Boss } from '../Boss';
import { Player } from '../Player';
import { EnemyStateMachine } from '../../systems/EnemyStateMachine';
import { WORLD } from '../../config/GameConfig';

export class MagmaTyrant extends Boss {
  private stateMachine: EnemyStateMachine<MagmaTyrant>;
  private stateTimer: number = 0;
  private attackSpeedMult: number = 1;
  private lavaPoolCount: number = 2;
  private boulderCount: number = 1;
  private flameWaveCount: number = 1;

  // Tracked objects for cleanup
  private lavaPools: Phaser.GameObjects.Rectangle[] = [];
  private boulders: Phaser.GameObjects.Rectangle[] = [];
  private flameWaves: Phaser.GameObjects.Rectangle[] = [];

  // Telegraph indicator
  private telegraph: Phaser.GameObjects.Rectangle | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, player: Player, bossNumber: number) {
    super(scene, x, y, player, bossNumber, 'Magma Tyrant');

    this.setTint(0xff4400);
    this.setScale(1.6);
    this.speed = 80;

    // Has gravity (ground-based boss)
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(true);

    this.stateMachine = new EnemyStateMachine<MagmaTyrant>('IDLE', this);
    this.stateMachine
      .addState('IDLE', {
        onEnter: (ctx) => {
          ctx.stateTimer = 0;
        },
        onUpdate: (ctx, _time, delta) => {
          ctx.stateTimer += delta;
          // Pace toward player slowly
          const dir = ctx.player.x > ctx.x ? 1 : -1;
          ctx.setVelocityX(ctx.speed * dir);
          ctx.setFlipX(dir < 0);

          const recoveryTime = 2000 / ctx.attackSpeedMult;
          if (ctx.stateTimer >= recoveryTime) {
            ctx.pickRandomAttack();
          }
        },
      })
      .addState('GROUND_STOMP', {
        onEnter: (ctx) => {
          ctx.stateTimer = 0;
          ctx.setVelocityX(0);
          // Telegraph: rise up slightly
          ctx.setVelocityY(-150);
        },
        onUpdate: (ctx, _time, delta) => {
          ctx.stateTimer += delta;
          if (ctx.stateTimer >= 500) {
            // Slam down
            ctx.performGroundStomp();
            ctx.stateMachine.transition('RECOVERY');
          }
        },
      })
      .addState('FLAME_WAVE', {
        onEnter: (ctx) => {
          ctx.stateTimer = 0;
          ctx.setVelocityX(0);
          ctx.spawnFlameWaves();
        },
        onUpdate: (ctx, _time, delta) => {
          ctx.stateTimer += delta;
          if (ctx.stateTimer >= 1500) {
            ctx.stateMachine.transition('RECOVERY');
          }
        },
      })
      .addState('ROCK_TOSS', {
        onEnter: (ctx) => {
          ctx.stateTimer = 0;
          ctx.setVelocityX(0);
          ctx.spawnBoulders();
        },
        onUpdate: (ctx, _time, delta) => {
          ctx.stateTimer += delta;
          if (ctx.stateTimer >= 800) {
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
          const recoveryTime = 2000 / ctx.attackSpeedMult;
          if (ctx.stateTimer >= recoveryTime) {
            ctx.stateMachine.transition('IDLE');
          }
        },
      })
      .start();
  }

  private pickRandomAttack() {
    const attacks = ['GROUND_STOMP', 'FLAME_WAVE', 'ROCK_TOSS'];
    const choice = attacks[Math.floor(Math.random() * attacks.length)];
    this.stateMachine.transition(choice);
  }

  private performGroundStomp() {
    // Create lava pools on nearby platform positions
    for (let i = 0; i < this.lavaPoolCount; i++) {
      const offsetX = Phaser.Math.Between(-200, 200);
      const poolX = Phaser.Math.Clamp(this.x + offsetX, 80, WORLD.WIDTH - 80);
      const poolY = this.y + 20;

      const pool = this.scene.add.rectangle(poolX, poolY, 80, 20, 0xff2200, 0.7);
      this.scene.physics.add.existing(pool);
      const poolBody = pool.body as Phaser.Physics.Arcade.Body;
      poolBody.setAllowGravity(false);
      poolBody.setImmovable(true);

      this.lavaPools.push(pool);

      // Overlap with player for damage
      this.scene.physics.add.overlap(this.player, pool, () => {
        if (!(this.player as any).isInvincible && pool.active) {
          (this.player as any).takeDamage(1);
        }
      });

      // Fade and destroy after 4s
      this.scene.tweens.add({
        targets: pool,
        alpha: 0,
        duration: 1000,
        delay: 3000,
        onComplete: () => {
          const idx = this.lavaPools.indexOf(pool);
          if (idx !== -1) this.lavaPools.splice(idx, 1);
          pool.destroy();
        },
      });
    }
  }

  private spawnFlameWaves() {
    for (let i = 0; i < this.flameWaveCount; i++) {
      this.scene.time.delayedCall(i * 600, () => {
        if (this.isDead || !this.active) return;

        // Start from below arena, sweep up
        const startY = this.y + 200;
        const wave = this.scene.add.rectangle(
          WORLD.WIDTH / 2,
          startY,
          WORLD.WIDTH,
          30,
          0xff4400,
          0.6,
        );
        this.scene.physics.add.existing(wave);
        const waveBody = wave.body as Phaser.Physics.Arcade.Body;
        waveBody.setAllowGravity(false);
        waveBody.setVelocityY(-300);

        this.flameWaves.push(wave);

        // Overlap with player
        this.scene.physics.add.overlap(this.player, wave, () => {
          if (!(this.player as any).isInvincible && wave.active) {
            (this.player as any).takeDamage(1);
          }
        });

        // Destroy after crossing arena
        this.scene.time.delayedCall(4000, () => {
          const idx = this.flameWaves.indexOf(wave);
          if (idx !== -1) this.flameWaves.splice(idx, 1);
          if (wave.active) wave.destroy();
        });
      });
    }
  }

  private spawnBoulders() {
    for (let i = 0; i < this.boulderCount; i++) {
      const spreadAngle = this.boulderCount > 1
        ? -20 + (40 / (this.boulderCount - 1)) * i
        : 0;

      const boulder = this.scene.add.rectangle(this.x, this.y - 20, 30, 30, 0x886644);
      this.scene.physics.add.existing(boulder);
      const boulderBody = boulder.body as Phaser.Physics.Arcade.Body;
      boulderBody.setAllowGravity(true);

      // Arc toward player
      const angle = Phaser.Math.Angle.Between(this.x, this.y, this.player.x, this.player.y);
      const speed = 250;
      const radSpread = Phaser.Math.DegToRad(spreadAngle);
      boulderBody.setVelocity(
        Math.cos(angle + radSpread) * speed,
        Math.sin(angle + radSpread) * speed - 200,
      );

      this.boulders.push(boulder);

      // Overlap with player
      this.scene.physics.add.overlap(this.player, boulder, () => {
        if (!(this.player as any).isInvincible && boulder.active) {
          (this.player as any).takeDamage(1);
          const idx = this.boulders.indexOf(boulder);
          if (idx !== -1) this.boulders.splice(idx, 1);
          boulder.destroy();
        }
      });

      // Destroy after 4s
      this.scene.time.delayedCall(4000, () => {
        const idx = this.boulders.indexOf(boulder);
        if (idx !== -1) this.boulders.splice(idx, 1);
        if (boulder.active) boulder.destroy();
      });
    }
  }

  protected onPhaseChange(phase: number): void {
    if (phase === 2) {
      this.attackSpeedMult = 1.3;
      this.lavaPoolCount = 3;
      this.boulderCount = 2;
    } else if (phase === 3) {
      this.attackSpeedMult = 1.5;
      this.flameWaveCount = 2;
      this.boulderCount = 3;
    }
  }

  protected getBossTint(): number {
    return 0xff4400;
  }

  update(time: number, delta: number) {
    if (this.isDead) return;
    this.stateMachine.update(time, delta);
  }

  protected die() {
    // Cleanup all active hazards
    for (const pool of this.lavaPools) {
      if (pool.active) pool.destroy();
    }
    this.lavaPools.length = 0;

    for (const boulder of this.boulders) {
      if (boulder.active) boulder.destroy();
    }
    this.boulders.length = 0;

    for (const wave of this.flameWaves) {
      if (wave.active) wave.destroy();
    }
    this.flameWaves.length = 0;

    if (this.telegraph) {
      this.telegraph.destroy();
      this.telegraph = null;
    }

    super.die();
  }
}
