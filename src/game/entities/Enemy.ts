import Phaser from 'phaser';
import { Player } from './Player';
import type { EnemyTier } from '../config/EnemyConfig';
import { GameSettings } from '../systems/GameSettings';

export type EnemyAIState = 'PATROL' | 'ALERT' | 'ATTACK' | 'FLEE' | 'STUN' | 'IDLE';

export class Enemy extends Phaser.Physics.Arcade.Sprite {
    protected _players: Player[];

    /** Returns the nearest alive player. Backward-compatible alias for subclasses. */
    protected get player(): Player {
        return this.getNearestPlayer();
    }

    protected getNearestPlayer(): Player {
        if (this._players.length === 1) return this._players[0];

        let nearest = this._players[0];
        let nearestDist = Infinity;
        for (const p of this._players) {
            // Skip dead players when possible
            if ((p as any).isDead && this._players.some(pp => !(pp as any).isDead)) continue;
            const dist = Phaser.Math.Distance.Between(this.x, this.y, p.x, p.y);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearest = p;
            }
        }
        return nearest;
    }

    protected getPlayers(): Player[] {
        return this._players;
    }

    public health: number;
    public maxHealth: number;
    protected damage: number;
    protected speed: number;
    protected isDead: boolean = false;

    /** Identifier matching the key in ENEMY_REGISTRY (e.g. 'crawler', 'bat'). */
    public enemyType: string = 'unknown';

    /** Spawn tier for this enemy. */
    public tier: EnemyTier = 'basic';

    /** Whether this is an elite variant (3x HP, 1.5x dmg, 1.2x speed, silver aura). */
    public isElite: boolean = false;

    /** When true, frontal attacks are blocked (used by shielded enemies like Cursed Knight). */
    public isBlocking: boolean = false;

    /** Direction the enemy is facing (1 = right, -1 = left). Used for block direction checks. */
    public facingDirection: number = 1;

    // ── AI State Machine ────────────────────────────────────────────────
    /** Current high-level AI state. Subclasses that use their own FSM can ignore this. */
    protected aiState: EnemyAIState = 'PATROL';

    /** General-purpose timer for current state. */
    protected stateTimer: number = 0;

    /** Distance (px) at which the enemy detects the player. */
    protected detectionRange: number = 300;

    /** Distance (px) at which the enemy starts attacking. */
    protected attackRange: number = 80;

    /** Time remaining in stun (ms). */
    protected stunTimer: number = 0;

    /** Damage multiplier while stunned. */
    protected stunDamageMultiplier: number = 1.5;

    /** Health fraction at which the enemy considers fleeing. */
    protected fleeThreshold: number = 0.2;

    /** If true, enemy gets faster/more aggressive instead of fleeing when low HP. */
    protected desperateMode: boolean = false;

    /** True while the enemy is in the startup frames of an attack (vulnerable to stun). */
    protected isInAttackStartup: boolean = false;

    /** The tint colour this enemy should return to after temporary flashes. */
    protected defaultTint: number = 0xffffff;

    /** Whether this enemy uses the base-class AI state machine (updateAI). */
    protected useBaseAI: boolean = false;

    /** Tween reference for flee blink effect, so we can clean it up. */
    private _fleeBlinkTween: Phaser.Tweens.Tween | null = null;

    /** Outline sprite rendered behind this enemy for accessibility. */
    private _outlineSprite: Phaser.GameObjects.Sprite | null = null;

    constructor(scene: Phaser.Scene, x: number, y: number, texture: string, player: Player | Player[], health: number, damage: number, speed: number) {
        super(scene, x, y, texture);
        this._players = Array.isArray(player) ? player : [player];
        this.health = health;
        this.maxHealth = health;
        this.damage = damage;
        this.speed = speed;

        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setCollideWorldBounds(false); // Enemies can fall off world

        // Accessibility: enemy outlines
        if (GameSettings.get().enemyOutlines) {
            this._outlineSprite = scene.add.sprite(x, y, texture);
            this._outlineSprite.setTint(0xffffff);
            this._outlineSprite.setScale(this.scaleX * 1.12, this.scaleY * 1.12);
            this._outlineSprite.setAlpha(0.7);
            this._outlineSprite.setDepth((this.depth || 0) - 1);
        }
    }

    /** Apply altitude-based stat scaling per the design doc. */
    public applyAltitudeScaling(altitude: number): void {
        let healthMult: number;
        let damageMult: number;
        if (altitude < 1000) {
            healthMult = 1.0;
            damageMult = 1.0;
        } else if (altitude < 3000) {
            healthMult = 1.5;
            damageMult = 1.0;
        } else if (altitude < 6000) {
            healthMult = 2.5;
            damageMult = 1.5;
        } else if (altitude < 10000) {
            healthMult = 4.0;
            damageMult = 2.0;
        } else {
            // 10000m+: scales infinitely beyond 6x
            healthMult = 6.0 + (altitude - 10000) / 5000;
            damageMult = 2.5;
        }
        this.health = Math.ceil(this.health * healthMult);
        this.maxHealth = this.health;
        this.damage = Math.ceil(this.damage * damageMult);
    }

    /** Apply elite modifiers: 3x health, 1.5x damage, 1.2x speed, silver aura + shimmer. */
    public applyElite(): void {
        this.isElite = true;
        this.health *= 3;
        this.maxHealth *= 3;
        this.damage = Math.ceil(this.damage * 1.5);
        this.speed *= 1.2;
        this.defaultTint = 0xccccff;
        this.setTint(0xccccff); // Silver aura

        // Pulsing shimmer effect: oscillate alpha to create a glowing look
        this.scene.tweens.add({
            targets: this,
            alpha: { from: 1.0, to: 0.7 },
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });
    }

    public takeDamage(amount: number) {
        if (this.isDead) return;

        // Apply stun damage multiplier
        if (this.aiState === 'STUN') {
            amount = Math.ceil(amount * this.stunDamageMultiplier);
        }

        // Check if hit during attack startup — triggers stun
        if (this.isInAttackStartup) {
            this.enterStun(500 + amount * 100);
        }

        this.health -= amount;

        // Flash red on hit then restore appropriate tint
        this.setTint(0xff0000);
        this.scene.time.delayedCall(100, () => {
            if (this.active && !this.isDead) {
                this.restoreTint();
            }
        });

        if (this.health <= 0) {
            this.die();
        }
    }

    /** Enter the STUN state for the given duration (ms). */
    public enterStun(duration: number): void {
        this.aiState = 'STUN';
        this.stunTimer = duration;
        this.isInAttackStartup = false;
        this.setTint(0xffff00); // Yellow tint for stun
        this.setVelocity(0, 0);
    }

    /** Restore the appropriate tint based on current AI state. */
    protected restoreTint(): void {
        if (this.aiState === 'STUN') {
            this.setTint(0xffff00);
        } else if (this.aiState === 'FLEE' && !this.desperateMode) {
            // Flee blink is handled by tween; just keep current
        } else if (this.desperateMode && this.health <= this.maxHealth * this.fleeThreshold) {
            this.setTint(0xff4444); // Desperate red glow
        } else if (this.aiState === 'ALERT') {
            this.setTint(0xffcccc); // Slight red tint for alert
        } else {
            this.setTint(this.defaultTint);
        }
    }

    /** Start the flee blink (alpha oscillation) tween. */
    protected startFleeBlink(): void {
        this.stopFleeBlink();
        this._fleeBlinkTween = this.scene.tweens.add({
            targets: this,
            alpha: { from: 1.0, to: 0.3 },
            duration: 200,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
        });
    }

    /** Stop the flee blink tween and restore alpha. */
    protected stopFleeBlink(): void {
        if (this._fleeBlinkTween) {
            this._fleeBlinkTween.destroy();
            this._fleeBlinkTween = null;
        }
        this.setAlpha(1);
    }

    // ── Base AI state machine ───────────────────────────────────────────
    /**
     * Standard AI state machine update. Called from update() for enemies
     * that set `useBaseAI = true`. Subclasses with their own FSM should
     * NOT call this — they handle stun/flee inside their own FSM instead.
     */
    protected updateAI(delta: number): void {
        // Handle stun state first (overrides everything)
        if (this.aiState === 'STUN') {
            this.stunTimer -= delta;
            if (this.stunTimer <= 0) {
                this.aiState = 'PATROL';
                this.stopFleeBlink();
                this.restoreTint();
            }
            return; // No actions while stunned
        }

        // Check flee condition (non-elite, health below threshold)
        if (!this.isElite && this.health <= this.maxHealth * this.fleeThreshold && this.health > 0) {
            if (this.desperateMode) {
                // Get faster/more aggressive instead of fleeing
                if (this.aiState !== 'ATTACK') {
                    this.aiState = 'ATTACK';
                    this.setTint(0xff4444);
                }
            } else {
                if (this.aiState !== 'FLEE') {
                    this.aiState = 'FLEE';
                    this.startFleeBlink();
                }
            }
        }

        const distToPlayer = Phaser.Math.Distance.Between(this.x, this.y, this.player.x, this.player.y);

        switch (this.aiState) {
            case 'IDLE':
                this.onPatrol(delta);
                if (distToPlayer <= this.detectionRange) {
                    this.aiState = 'ALERT';
                    this.restoreTint();
                }
                break;
            case 'PATROL':
                this.onPatrol(delta);
                if (distToPlayer <= this.detectionRange) {
                    this.aiState = 'ALERT';
                    this.restoreTint();
                }
                break;
            case 'ALERT':
                this.onAlert(delta, this.player);
                if (distToPlayer <= this.attackRange) {
                    this.aiState = 'ATTACK';
                    this.restoreTint();
                } else if (distToPlayer > this.detectionRange * 1.5) {
                    this.aiState = 'PATROL'; // Lost sight
                    this.restoreTint();
                }
                break;
            case 'ATTACK':
                this.onAttack(delta, this.player);
                if (distToPlayer > this.attackRange * 1.5 && !(this.desperateMode && this.health <= this.maxHealth * this.fleeThreshold)) {
                    this.aiState = 'ALERT'; // Out of range
                    this.restoreTint();
                }
                break;
            case 'FLEE':
                this.onFlee(delta, this.player);
                break;
        }
    }

    // ── Virtual methods for subclasses to override ──────────────────────
    protected onPatrol(_delta: number): void {
        // Default: stand still. Subclasses override for walking patterns.
    }

    protected onAlert(_delta: number, player: Phaser.GameObjects.Sprite): void {
        // Default: move toward player
        const dx = player.x - this.x;
        const dir = dx > 0 ? 1 : -1;
        this.setVelocityX(this.speed * dir);
        this.setFlipX(dir < 0);
        this.facingDirection = dir;
    }

    protected onAttack(_delta: number, _player: Phaser.GameObjects.Sprite): void {
        // Default: stop and face player. Subclasses override for attacks.
        this.setVelocityX(0);
    }

    protected onFlee(_delta: number, player: Phaser.GameObjects.Sprite): void {
        // Default: move away from player at 1.5x speed
        const dx = player.x - this.x;
        const dir = dx > 0 ? -1 : 1; // Move AWAY from player
        this.setVelocityX(this.speed * 1.5 * dir);
        this.setFlipX(dir < 0);
        this.facingDirection = dir;
    }

    protected die() {
        this.isDead = true;
        this.stopFleeBlink();
        if (this._outlineSprite) {
            this._outlineSprite.destroy();
            this._outlineSprite = null;
        }
        this.disableBody(true, true);
        this.destroy();
    }

    update(_time: number, _delta: number) {
        if (this.isDead) return;
        // Basic AI behavior — subclasses using useBaseAI get the state machine
        if (this.useBaseAI && _delta > 0) {
            this.updateAI(_delta);
        }
        // Sync accessibility outline sprite
        if (this._outlineSprite && this._outlineSprite.active) {
            this._outlineSprite.setPosition(this.x, this.y);
            this._outlineSprite.setFlipX(this.flipX);
            this._outlineSprite.setScale(this.scaleX * 1.12, this.scaleY * 1.12);
            this._outlineSprite.setVisible(this.visible);
        }
    }
}
