import Phaser from 'phaser';
import { Enemy } from './Enemy';
import { Player } from './Player';
import { EventBus } from '../systems/EventBus';
import { GameSettings } from '../systems/GameSettings';
import { WORLD } from '../config/GameConfig';

export abstract class Boss extends Enemy {
  public bossNumber: number;
  public bossName: string;
  public phase: number = 1;
  public totalPhases: number = 3;
  protected phaseThresholds: number[] = [0.60, 0.30]; // Phase 2 at 60%, Phase 3 at 30%
  private isTransitioning: boolean = false;

  // ── Enhanced Boss Systems ──────────────────────────────────────────
  /** Base damage before scaling */
  protected baseDamage: number = 1;

  /** Speed multiplier for current phase */
  protected phaseSpeedMult: number = 1;

  /** Whether the phase 3 enrage burst has already fired */
  private enrageBurstFired: boolean = false;

  /** Falling debris system (phase 2+) */
  private debrisTimer: number = 0;
  private readonly DEBRIS_INTERVAL = 2500; // ms between debris drops
  private activeDebris: Phaser.GameObjects.Rectangle[] = [];
  private activeShadows: Phaser.GameObjects.Ellipse[] = [];

  /** Red tint pulse tween for phase 2 enraged visual */
  private enragePulseTween: Phaser.Tweens.Tween | null = null;

  /** Vignette overlay for boss fight atmosphere */
  private vignetteOverlay: Phaser.GameObjects.Graphics | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    player: Player,
    bossNumber: number,
    bossName: string,
  ) {
    // Health scales: base 200 + 150 per boss, then +30% per successive boss
    const baseHealth = 200 + (bossNumber - 1) * 150;
    const scaledHealth = Math.ceil(baseHealth * Math.pow(1.30, bossNumber - 1));
    // Damage scales: base 1, +15% per successive boss
    const scaledDamage = Math.max(1, Math.ceil(1 * Math.pow(1.15, bossNumber - 1)));

    super(scene, x, y, 'dude', player, scaledHealth, scaledDamage, 100);

    this.bossNumber = bossNumber;
    this.bossName = bossName;
    this.baseDamage = scaledDamage;
    this.enemyType = 'boss';
    this.tier = 'elite';

    // Bosses are bigger
    this.setScale(1.5);

    // Create vignette effect for boss atmosphere
    this.createVignette();

    // Emit spawn event
    EventBus.emit('boss-spawn', {
      name: bossName,
      maxHealth: scaledHealth,
      bossNumber,
    });

    // Emit arena start
    EventBus.emit('boss-arena-start', { bossNumber });
  }

  // ── Vignette Effect ────────────────────────────────────────────────
  private createVignette(): void {
    const cam = this.scene.cameras.main;
    const w = cam.width;
    const h = cam.height;

    this.vignetteOverlay = this.scene.add.graphics();
    this.vignetteOverlay.setScrollFactor(0);
    this.vignetteOverlay.setDepth(150);

    // Draw dark gradient borders (vignette)
    this.vignetteOverlay.fillStyle(0x000000, 0.4);
    // Top strip
    this.vignetteOverlay.fillRect(0, 0, w, 60);
    // Bottom strip
    this.vignetteOverlay.fillRect(0, h - 60, w, 60);
    // Left strip
    this.vignetteOverlay.fillRect(0, 0, 60, h);
    // Right strip
    this.vignetteOverlay.fillRect(w - 60, 0, 60, h);

    // Semi-transparent corner darkening
    this.vignetteOverlay.fillStyle(0x000000, 0.2);
    this.vignetteOverlay.fillRect(60, 0, w - 120, 30);
    this.vignetteOverlay.fillRect(60, h - 30, w - 120, 30);
    this.vignetteOverlay.fillRect(0, 60, 30, h - 120);
    this.vignetteOverlay.fillRect(w - 30, 60, 30, h - 120);

    // Fade in the vignette
    this.vignetteOverlay.setAlpha(0);
    this.scene.tweens.add({
      targets: this.vignetteOverlay,
      alpha: 1,
      duration: 1000,
      ease: 'Sine.easeIn',
    });
  }

  private destroyVignette(): void {
    if (this.vignetteOverlay) {
      this.scene.tweens.add({
        targets: this.vignetteOverlay,
        alpha: 0,
        duration: 500,
        onComplete: () => {
          this.vignetteOverlay?.destroy();
          this.vignetteOverlay = null;
        },
      });
    }
  }

  // ── Damage & Phase Tracking ────────────────────────────────────────
  public takeDamage(amount: number) {
    if (this.isDead || this.isTransitioning) return;

    super.takeDamage(amount);

    // Emit health change with phase-based color info
    EventBus.emit('boss-health-change', {
      health: this.health,
      maxHealth: this.maxHealth,
      phase: this.phase,
    });

    // Check phase transitions
    this.checkPhaseTransition();
  }

  private checkPhaseTransition() {
    const healthPercent = this.health / this.maxHealth;
    const nextPhase = this.phase + 1;

    if (nextPhase <= this.totalPhases) {
      const threshold = this.phaseThresholds[this.phase - 1];
      if (healthPercent <= threshold) {
        this.transitionToPhase(nextPhase);
      }
    }
  }

  private transitionToPhase(newPhase: number) {
    this.isTransitioning = true;
    this.phase = newPhase;

    // Phase transition: brief pause + flash + camera effects
    const flashReduction = GameSettings.get().flashReduction;

    // Camera shake for impact
    if (!flashReduction) {
      this.scene.cameras.main.shake(300, 0.02);
    }

    // Screen flash
    if (!flashReduction) {
      this.scene.cameras.main.flash(200, 255, 255, 255);
    }

    // Brief invulnerability during transition (1.5s)
    // Visual: flash white rapidly
    const bossTint = this.getBossTint();
    this.scene.time.addEvent({
      delay: 100,
      callback: () => {
        if (!this.active) return;
        this.setTint(this.tintTopLeft === 0xffffff ? bossTint : 0xffffff);
      },
      repeat: 14, // 1.5 seconds of flashing
    });

    this.scene.time.delayedCall(1500, () => {
      if (!this.active) return;
      this.isTransitioning = false;
      this.setTint(this.getBossTint());
    });

    // Update phase speed
    if (newPhase === 2) {
      this.phaseSpeedMult = 1.3;
      this.speed = Math.ceil(this.speed * 1.3);
      this.startEnragePulse();
    } else if (newPhase === 3) {
      this.phaseSpeedMult = 1.6;
      this.speed = Math.ceil(this.speed * 1.23); // additional on top of phase 2 boost
      // Fire enrage burst (one-time transition attack)
      if (!this.enrageBurstFired) {
        this.enrageBurstFired = true;
        this.performEnrageBurst();
      }
    }

    EventBus.emit('boss-phase-change', {
      phase: newPhase,
      totalPhases: this.totalPhases,
    });

    // Emit sound/roar event for phase transition
    if (newPhase === 3) {
      EventBus.emit('boss-enrage', {});
    }

    this.onPhaseChange(newPhase);
  }

  // ── Enrage Pulse (Phase 2+ Red Tint Pulse) ────────────────────────
  private startEnragePulse(): void {
    this.stopEnragePulse();

    // Pulsing red tint overlay: oscillate tint between boss color and reddish
    this.enragePulseTween = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      onUpdate: (tween) => {
        if (!this.active || this.isTransitioning) return;
        const t = tween.getValue();
        const bossTint = this.getBossTint();

        // Blend boss tint toward red based on t
        const r1 = (bossTint >> 16) & 0xff;
        const g1 = (bossTint >> 8) & 0xff;
        const b1 = bossTint & 0xff;

        const r2 = 0xff;
        const g2 = 0x20;
        const b2 = 0x20;

        const r = Math.round(r1 + (r2 - r1) * t * 0.5);
        const g = Math.round(g1 + (g2 - g1) * t * 0.5);
        const b = Math.round(b1 + (b2 - b1) * t * 0.5);

        this.setTint((r << 16) | (g << 8) | b);
      },
    });
  }

  private stopEnragePulse(): void {
    if (this.enragePulseTween) {
      this.enragePulseTween.destroy();
      this.enragePulseTween = null;
    }
  }

  // ── Enrage Burst (Phase 3 Transition Attack) ──────────────────────
  private performEnrageBurst(): void {
    const flashReduction = GameSettings.get().flashReduction;

    // Brief invincibility is already provided by isTransitioning flag

    // Expanding damage ring
    const ring = this.scene.add.circle(this.x, this.y, 30, 0xff0000, 0.5);
    ring.setStrokeStyle(4, 0xff4444, 0.8);
    this.scene.physics.add.existing(ring);
    const ringBody = ring.body as Phaser.Physics.Arcade.Body;
    ringBody.setAllowGravity(false);
    ringBody.setCircle(30);

    let hasHitPlayer = false;

    // Overlap with player for damage (only hits once)
    const overlap = this.scene.physics.add.overlap(this.player, ring, () => {
      if (hasHitPlayer) return;
      if (!(this.player as any).isInvincible && ring.active) {
        hasHitPlayer = true;
        (this.player as any).takeDamage(this.baseDamage);
      }
    });

    // Expand the ring outward
    this.scene.tweens.add({
      targets: ring,
      scaleX: 8,
      scaleY: 8,
      alpha: 0,
      duration: 1200,
      ease: 'Quad.easeOut',
      onUpdate: () => {
        // Update the physics body to match the visual scale
        if (ring.active && ringBody) {
          ringBody.setCircle(30 * ring.scaleX);
          ringBody.setOffset(
            ring.width / 2 - 30 * ring.scaleX,
            ring.height / 2 - 30 * ring.scaleX,
          );
        }
      },
      onComplete: () => {
        if (overlap) {
          this.scene.physics.world.removeCollider(overlap);
        }
        ring.destroy();
      },
    });

    // Screen effect for enrage
    if (!flashReduction) {
      this.scene.cameras.main.shake(500, 0.03);
      this.scene.cameras.main.flash(300, 255, 50, 50);
    }
  }

  // ── Falling Debris System (Phase 2+) ──────────────────────────────
  protected updateDebris(delta: number): void {
    if (this.phase < 2 || this.isDead) return;

    this.debrisTimer += delta;

    // More frequent debris in phase 3
    const interval = this.phase === 3
      ? this.DEBRIS_INTERVAL * 0.6
      : this.DEBRIS_INTERVAL;

    if (this.debrisTimer >= interval) {
      this.debrisTimer = 0;
      this.spawnDebris();
    }
  }

  private spawnDebris(): void {
    const cam = this.scene.cameras.main;
    const viewLeft = cam.scrollX;
    const viewTop = cam.scrollY;
    const viewWidth = cam.width;

    // Number of debris: 1-2 in phase 2, 2-3 in phase 3
    const count = this.phase === 3
      ? Phaser.Math.Between(2, 3)
      : Phaser.Math.Between(1, 2);

    for (let i = 0; i < count; i++) {
      const targetX = viewLeft + Phaser.Math.Between(100, viewWidth - 100);
      const targetY = this.player.y + Phaser.Math.Between(-50, 100);
      const startY = viewTop - 50;

      // Telegraph: shadow on the ground
      const shadow = this.scene.add.ellipse(targetX, targetY, 50, 20, 0x000000, 0.3);
      shadow.setDepth(5);
      this.activeShadows.push(shadow);

      // Grow the shadow as debris approaches
      shadow.setScale(0.3);
      this.scene.tweens.add({
        targets: shadow,
        scaleX: 1,
        scaleY: 1,
        alpha: 0.6,
        duration: 800,
        ease: 'Quad.easeIn',
      });

      // Spawn falling debris after telegraph
      this.scene.time.delayedCall(400, () => {
        if (this.isDead || !this.active) {
          const sIdx = this.activeShadows.indexOf(shadow);
          if (sIdx !== -1) this.activeShadows.splice(sIdx, 1);
          shadow.destroy();
          return;
        }

        const debris = this.scene.add.rectangle(
          targetX,
          startY,
          30,
          30,
          0x886655,
          0.9,
        );
        this.scene.physics.add.existing(debris);
        const debrisBody = debris.body as Phaser.Physics.Arcade.Body;
        debrisBody.setAllowGravity(false);
        debrisBody.setVelocityY(400);
        debrisBody.setImmovable(true);

        this.activeDebris.push(debris);

        // Overlap with player for damage
        const debrisOverlap = this.scene.physics.add.overlap(this.player, debris, () => {
          if (!(this.player as any).isInvincible && debris.active) {
            (this.player as any).takeDamage(1);
          }
        });

        // Destroy debris after it has fallen well past
        this.scene.time.delayedCall(2000, () => {
          if (debrisOverlap) {
            this.scene.physics.world.removeCollider(debrisOverlap);
          }
          const dIdx = this.activeDebris.indexOf(debris);
          if (dIdx !== -1) this.activeDebris.splice(dIdx, 1);
          if (debris.active) debris.destroy();

          const sIdx = this.activeShadows.indexOf(shadow);
          if (sIdx !== -1) this.activeShadows.splice(sIdx, 1);
          if (shadow.active) shadow.destroy();
        });
      });
    }
  }

  // ── Shared Boss Attack Patterns ─────────────────────────────────────
  /** Tracked shared attack projectiles for cleanup */
  private sharedProjectiles: Phaser.GameObjects.Rectangle[] = [];
  private sharedShockwaves: Phaser.GameObjects.Rectangle[] = [];

  /**
   * Charge Attack: Boss dashes toward player at high speed.
   * Telegraph: 0.5s wind-up with flash. Used in all phases.
   * @param onComplete Callback when charge finishes.
   */
  protected performChargeAttack(onComplete: () => void): void {
    const flashReduction = GameSettings.get().flashReduction;

    // Telegraph: 0.5s wind-up, flash white
    this.setVelocityX(0);
    this.setVelocityY(0);
    if (!flashReduction) {
      this.setTint(0xffffff);
    }

    this.scene.time.delayedCall(500, () => {
      if (this.isDead || !this.active) return;

      this.setTint(this.getBossTint());

      // Dash toward player at high speed
      const angle = Phaser.Math.Angle.Between(this.x, this.y, this.player.x, this.player.y);
      const chargeSpeed = 600 * this.phaseSpeedMult;
      this.setVelocity(
        Math.cos(angle) * chargeSpeed,
        Math.sin(angle) * chargeSpeed,
      );

      // End charge after 0.6s
      this.scene.time.delayedCall(600, () => {
        if (this.isDead || !this.active) return;
        this.setVelocity(0, 0);
        onComplete();
      });
    });
  }

  /**
   * Slam Attack: Boss jumps up and slams down, creating a shockwave.
   * Telegraph: boss rises slowly. Phase 2+.
   * @param onComplete Callback when slam finishes.
   */
  protected performSlamAttack(onComplete: () => void): void {
    // Telegraph: rise up slowly
    this.setVelocityX(0);
    this.setVelocityY(-200);

    this.scene.time.delayedCall(600, () => {
      if (this.isDead || !this.active) return;

      // Slam down fast
      this.setVelocityY(800);

      this.scene.time.delayedCall(400, () => {
        if (this.isDead || !this.active) return;
        this.setVelocityY(0);

        // Camera shake on impact
        this.scene.cameras.main.shake(200, 0.02);

        // Create expanding shockwave on the ground
        const shockwaveY = this.y + 20;
        const shockLeft = this.scene.add.rectangle(
          this.x,
          shockwaveY,
          60,
          20,
          0xff8800,
          0.7,
        );
        const shockRight = this.scene.add.rectangle(
          this.x,
          shockwaveY,
          60,
          20,
          0xff8800,
          0.7,
        );

        this.scene.physics.add.existing(shockLeft);
        this.scene.physics.add.existing(shockRight);
        (shockLeft.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
        (shockRight.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);

        this.sharedShockwaves.push(shockLeft, shockRight);

        // Overlap with player
        const waveOverlaps: Phaser.Physics.Arcade.Collider[] = [];
        for (const wave of [shockLeft, shockRight]) {
          const waveOverlap = this.scene.physics.add.overlap(this.player, wave, () => {
            if (!(this.player as any).isInvincible && wave.active) {
              (this.player as any).takeDamage(this.baseDamage);
            }
          });
          waveOverlaps.push(waveOverlap);
        }

        // Expand outward
        this.scene.tweens.add({
          targets: shockLeft,
          x: this.x - 300,
          scaleX: 3,
          alpha: 0,
          duration: 800,
          ease: 'Quad.easeOut',
          onComplete: () => {
            if (waveOverlaps[0]) {
              this.scene.physics.world.removeCollider(waveOverlaps[0]);
            }
            const idx = this.sharedShockwaves.indexOf(shockLeft);
            if (idx !== -1) this.sharedShockwaves.splice(idx, 1);
            shockLeft.destroy();
          },
        });

        this.scene.tweens.add({
          targets: shockRight,
          x: this.x + 300,
          scaleX: 3,
          alpha: 0,
          duration: 800,
          ease: 'Quad.easeOut',
          onComplete: () => {
            if (waveOverlaps[1]) {
              this.scene.physics.world.removeCollider(waveOverlaps[1]);
            }
            const idx = this.sharedShockwaves.indexOf(shockRight);
            if (idx !== -1) this.sharedShockwaves.splice(idx, 1);
            shockRight.destroy();
          },
        });

        // Callback after shockwave
        this.scene.time.delayedCall(900, () => {
          onComplete();
        });
      });
    });
  }

  /**
   * Projectile Barrage: Boss fires projectiles in a spread pattern toward player.
   * Telegraph: glow buildup. Phase 2+ (5 projectiles in phase 3).
   * @param onComplete Callback when barrage finishes.
   */
  protected performProjectileBarrage(onComplete: () => void): void {
    const flashReduction = GameSettings.get().flashReduction;

    // Number of projectiles: 3 in phase 2, 5 in phase 3
    const projectileCount = this.phase >= 3 ? 5 : 3;
    const spreadAngle = 40; // degrees total spread

    // Telegraph: glow buildup (0.6s)
    this.setVelocityX(0);
    if (!flashReduction) {
      this.setTint(0xffffaa);
    }

    this.scene.time.delayedCall(600, () => {
      if (this.isDead || !this.active) return;

      this.setTint(this.getBossTint());

      const baseAngle = Phaser.Math.Angle.Between(
        this.x, this.y,
        this.player.x, this.player.y,
      );

      for (let i = 0; i < projectileCount; i++) {
        const spreadRad = Phaser.Math.DegToRad(spreadAngle);
        const step = projectileCount > 1
          ? spreadRad / (projectileCount - 1)
          : 0;
        const angle = baseAngle + (projectileCount > 1
          ? -spreadRad / 2 + step * i
          : 0);

        const proj = this.scene.add.rectangle(
          this.x,
          this.y - 10,
          12,
          8,
          this.getBossTint(),
          0.9,
        );
        this.scene.physics.add.existing(proj);
        const projBody = proj.body as Phaser.Physics.Arcade.Body;
        projBody.setAllowGravity(false);

        const speed = 300 * this.phaseSpeedMult;
        projBody.setVelocity(
          Math.cos(angle) * speed,
          Math.sin(angle) * speed,
        );

        this.sharedProjectiles.push(proj);

        // Overlap with player
        const projOverlap = this.scene.physics.add.overlap(this.player, proj, () => {
          if (!(this.player as any).isInvincible && proj.active) {
            (this.player as any).takeDamage(this.baseDamage);
            if (projOverlap) {
              this.scene.physics.world.removeCollider(projOverlap);
            }
            const idx = this.sharedProjectiles.indexOf(proj);
            if (idx !== -1) this.sharedProjectiles.splice(idx, 1);
            proj.destroy();
          }
        });

        // Destroy after 3s
        this.scene.time.delayedCall(3000, () => {
          if (projOverlap) {
            this.scene.physics.world.removeCollider(projOverlap);
          }
          const idx = this.sharedProjectiles.indexOf(proj);
          if (idx !== -1) this.sharedProjectiles.splice(idx, 1);
          if (proj.active) proj.destroy();
        });
      }

      onComplete();
    });
  }

  /** Clean up shared attack objects. Subclasses should call in their die(). */
  protected cleanupSharedAttacks(): void {
    for (const p of this.sharedProjectiles) {
      if (p.active) p.destroy();
    }
    this.sharedProjectiles.length = 0;

    for (const s of this.sharedShockwaves) {
      if (s.active) s.destroy();
    }
    this.sharedShockwaves.length = 0;
  }

  // ── Override in subclasses ─────────────────────────────────────────
  protected abstract onPhaseChange(phase: number): void;
  protected abstract getBossTint(): number;

  // ── Death Sequence ─────────────────────────────────────────────────
  protected die() {
    // Stop enrage pulse
    this.stopEnragePulse();

    // Clean up debris
    this.cleanupDebris();

    // Destroy vignette
    this.destroyVignette();

    // Dramatic death sequence: slow-mo + particle explosion + screen flash
    this.performDeathSequence();

    // Spawn rewards before destroying
    this.spawnRewards();

    // Emit arena end
    EventBus.emit('boss-arena-end', {});

    super.die();
  }

  private performDeathSequence(): void {
    const flashReduction = GameSettings.get().flashReduction;

    // Slow-mo effect: reduce time scale to 0.2 for 1 second
    this.scene.time.timeScale = 0.2;
    this.scene.physics.world.timeScale = 5; // Physics inverse of time scale

    // Restore normal speed after 1 real second (which is 200ms of game time at 0.2x)
    // Use a real-time setTimeout since scene timers are also slowed
    const restoreTimeout = setTimeout(() => {
      if (this.scene && this.scene.time) {
        this.scene.time.timeScale = 1;
        this.scene.physics.world.timeScale = 1;
      }
    }, 1000);

    // Store timeout ref so it can be cleaned up if scene is destroyed
    this.scene.events.once('shutdown', () => clearTimeout(restoreTimeout));

    // Screen flash on death
    if (!flashReduction) {
      this.scene.cameras.main.flash(500, 255, 255, 200);
      this.scene.cameras.main.shake(300, 0.04);
    }

    // Particle explosion at death position
    this.createDeathParticles();
  }

  private createDeathParticles(): void {
    const particleCount = 20;
    const colors = [0xff4444, 0xffaa00, 0xffffff, 0xff0000];

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount;
      const speed = Phaser.Math.Between(100, 400);
      const color = colors[i % colors.length];
      const size = Phaser.Math.Between(4, 12);

      const particle = this.scene.add.rectangle(
        this.x,
        this.y,
        size,
        size,
        color,
        0.9,
      );
      particle.setDepth(100);

      this.scene.tweens.add({
        targets: particle,
        x: this.x + Math.cos(angle) * speed,
        y: this.y + Math.sin(angle) * speed,
        alpha: 0,
        scaleX: 0,
        scaleY: 0,
        duration: Phaser.Math.Between(600, 1200),
        ease: 'Quad.easeOut',
        onComplete: () => particle.destroy(),
      });
    }
  }

  private cleanupDebris(): void {
    for (const debris of this.activeDebris) {
      if (debris.active) debris.destroy();
    }
    this.activeDebris.length = 0;

    for (const shadow of this.activeShadows) {
      if (shadow.active) shadow.destroy();
    }
    this.activeShadows.length = 0;
  }

  private spawnRewards() {
    const rewards: string[] = ['silver_item'];
    if (this.bossNumber % 3 === 0) {
      rewards.push('gold_item');
    }
    EventBus.emit('boss-defeated', {
      bossNumber: this.bossNumber,
      altitude: 0, // filled by listener
      rewards,
    });
  }

  // ── Boss Base Update (call from subclass update) ───────────────────
  /** Subclasses should call super.updateBoss(delta) in their update() to run debris. */
  protected updateBoss(delta: number): void {
    this.updateDebris(delta);
  }
}
