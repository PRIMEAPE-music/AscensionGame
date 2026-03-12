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

    /** Whether this is an elite variant (3x HP, 1.5x dmg, 1.25x speed, reddish-purple aura). */
    public isElite: boolean = false;

    /** Elite affixes assigned to this enemy (empty if not elite). */
    public eliteAffixes: string[] = [];

    /** When true, frontal attacks are blocked (used by shielded enemies like Cursed Knight). */
    public isBlocking: boolean = false;

    /** Direction the enemy is facing (1 = right, -1 = left). Used for block direction checks. */
    public facingDirection: number = 1;

    // ── Elite Affix State ────────────────────────────────────────────────
    /** Timers for affix-specific behavior (e.g. teleport cooldown). */
    private _affixTimers: Map<string, number> = new Map();

    /** Damage multiplier from elite status (applied to contact damage). */
    private _eliteDamageMult: number = 1;

    /** Speed multiplier from elite status. */
    private _eliteSpeedMult: number = 1;

    /** Whether BERSERKER rage mode has been activated. */
    private _berserkerActivated: boolean = false;

    /** Nameplate text object shown above elite enemies. */
    private _eliteNameplate: Phaser.GameObjects.Text | null = null;

    /** Whether this is a split copy (should NOT be elite to prevent infinite recursion). */
    public isSplitCopy: boolean = false;

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

    // ── Elite Affix Setters (called by EliteManager) ─────────────────────

    /** Set the elite damage multiplier (applied to getDamage()). */
    public setEliteDamageMultiplier(mult: number): void {
        this._eliteDamageMult = mult;
        this.damage = Math.ceil(this.damage * mult);
    }

    /** Set the elite speed multiplier. */
    public setEliteSpeedMultiplier(mult: number): void {
        this._eliteSpeedMult = mult;
        this.speed *= mult;
    }

    /** Set the default tint for elite enemies. */
    public setEliteDefaultTint(tint: number): void {
        this.defaultTint = tint;
    }

    /** Set an affix-specific timer. */
    public setAffixTimer(key: string, value: number): void {
        this._affixTimers.set(key, value);
    }

    /** Get an affix-specific timer. */
    public getAffixTimer(key: string): number {
        return this._affixTimers.get(key) ?? 0;
    }

    /** Set the elite nameplate text object. */
    public setEliteNameplate(text: Phaser.GameObjects.Text): void {
        this._eliteNameplate = text;
    }

    /** Get the effective contact damage (includes elite multiplier). */
    public getContactDamage(): number {
        return this.damage;
    }

    /** Whether this enemy has a specific elite affix. */
    public hasAffix(affix: string): boolean {
        return this.eliteAffixes.includes(affix);
    }

    public takeDamage(amount: number, attackerX?: number) {
        if (this.isDead) return;

        // Apply stun damage multiplier
        if (this.aiState === 'STUN') {
            amount = Math.ceil(amount * this.stunDamageMultiplier);
        }

        // Check if hit during attack startup — triggers stun
        if (this.isInAttackStartup) {
            this.enterStun(500 + amount * 100);
        }

        // ── Elite Affix: SHIELDED ──────────────────────────────────────
        // 50% damage reduction when hit from the front
        if (this.hasAffix('SHIELDED') && attackerX !== undefined) {
            const hitFromRight = attackerX > this.x;
            const facingRight = this.facingDirection > 0;
            // Hit is "from the front" if it comes from the direction the enemy faces
            if ((hitFromRight && facingRight) || (!hitFromRight && !facingRight)) {
                amount = Math.ceil(amount * 0.5);
            }
        }

        // ── Elite Affix: REFLECTIVE ────────────────────────────────────
        // 25% chance to reflect projectile damage back to nearest player
        if (this.hasAffix('REFLECTIVE') && Math.random() < 0.25) {
            const nearest = this.getNearestPlayer();
            if (nearest && nearest.active) {
                nearest.takeDamage(Math.ceil(amount * 0.5));
            }
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

    /**
     * Called when this enemy deals damage to a player. Processes reactive elite affixes.
     * @param damageDealt The amount of damage dealt to the player.
     * @param targetPlayer The player that was hit.
     */
    public onDealtDamageToPlayer(damageDealt: number, _targetPlayer: Player): void {
        // ── Elite Affix: VAMPIRIC ──────────────────────────────────────
        // Heal 20% of damage dealt
        if (this.hasAffix('VAMPIRIC') && this.active && !this.isDead) {
            const healAmount = Math.max(1, Math.ceil(damageDealt * 0.20));
            this.health = Math.min(this.maxHealth, this.health + healAmount);
        }

        // ── Elite Affix: FREEZING ──────────────────────────────────────
        // Apply 1.5s slow to the player
        if (this.hasAffix('FREEZING') && _targetPlayer && _targetPlayer.active) {
            this.applyFreezingSlow(_targetPlayer);
        }
    }

    /** Apply the FREEZING slow effect to a player (1.5 second duration). */
    private applyFreezingSlow(targetPlayer: Player): void {
        // Use a custom property on the player to track the slow
        const p = targetPlayer as any;
        if (p._freezeSlowActive) return; // Don't stack

        p._freezeSlowActive = true;
        p._originalMoveSpeedMult = p._originalMoveSpeedMult ?? 1;

        // Apply visual indicator — blue tint flash
        targetPlayer.setTint(0x6666ff);

        // Temporarily reduce player move speed via stat modifier
        const currentMod = targetPlayer.statModifiers.get('moveSpeed') ?? 0;
        targetPlayer.statModifiers.set('moveSpeed', currentMod - 0.4); // -40% speed

        // Clear after 1.5 seconds
        this.scene.time.delayedCall(1500, () => {
            if (targetPlayer.active) {
                p._freezeSlowActive = false;
                const mod = targetPlayer.statModifiers.get('moveSpeed') ?? 0;
                targetPlayer.statModifiers.set('moveSpeed', mod + 0.4);
                targetPlayer.clearTint();
            }
        });
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

        // Shadow Dancer invisibility: enemies lose sight of the player
        const playerInvisible = (this.player as any).isShadowDancerInvisible === true;

        switch (this.aiState) {
            case 'IDLE':
                this.onPatrol(delta);
                if (!playerInvisible && distToPlayer <= this.detectionRange) {
                    this.aiState = 'ALERT';
                    this.restoreTint();
                }
                break;
            case 'PATROL':
                this.onPatrol(delta);
                if (!playerInvisible && distToPlayer <= this.detectionRange) {
                    this.aiState = 'ALERT';
                    this.restoreTint();
                }
                break;
            case 'ALERT':
                if (playerInvisible) {
                    this.aiState = 'PATROL'; // Lost sight due to invisibility
                    this.restoreTint();
                    break;
                }
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
                if (playerInvisible) {
                    this.aiState = 'PATROL'; // Lost sight due to invisibility
                    this.restoreTint();
                    break;
                }
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

    // ── Elite Affix Update Logic ─────────────────────────────────────────

    /** Process elite affix behaviors that run every frame. */
    private updateEliteAffixes(delta: number): void {
        if (!this.isElite || this.eliteAffixes.length === 0) return;

        // ── TELEPORTING: blink to random nearby position every 4 seconds ──
        if (this.hasAffix('TELEPORTING')) {
            const timer = this.getAffixTimer('teleport') - delta;
            if (timer <= 0) {
                this.teleportNearby();
                this.setAffixTimer('teleport', 4000);
            } else {
                this.setAffixTimer('teleport', timer);
            }
        }

        // ── BERSERKER: +50% speed and damage below 30% HP ──
        if (this.hasAffix('BERSERKER') && !this._berserkerActivated) {
            if (this.health <= this.maxHealth * 0.3 && this.health > 0) {
                this._berserkerActivated = true;
                this.speed *= 1.5;
                this.damage = Math.ceil(this.damage * 1.5);

                // Visual feedback: red pulsing
                this.setTint(0xff2200);
                if (this.scene) {
                    this.scene.tweens.add({
                        targets: this,
                        scaleX: this.scaleX * 1.1,
                        scaleY: this.scaleY * 1.1,
                        duration: 300,
                        yoyo: true,
                        repeat: 2,
                        ease: 'Power2',
                    });
                }
            }
        }

        // ── Sync nameplate position ──
        if (this._eliteNameplate && this._eliteNameplate.active) {
            this._eliteNameplate.setPosition(this.x, this.y - (this.displayHeight / 2) - 12);
        }
    }

    /** TELEPORTING affix: blink to a random position within 200px. */
    private teleportNearby(): void {
        if (!this.active || !this.scene) return;

        const offsetX = Phaser.Math.Between(-200, 200);
        const offsetY = Phaser.Math.Between(-100, 100);
        const newX = Phaser.Math.Clamp(this.x + offsetX, 50, 1870); // Keep in world bounds
        const newY = this.y + offsetY;

        // Brief flash before teleport
        this.setAlpha(0.3);
        this.setPosition(newX, newY);

        // Fade back in
        if (this.scene) {
            this.scene.tweens.add({
                targets: this,
                alpha: 1,
                duration: 200,
                ease: 'Power2',
            });
        }
    }

    protected die() {
        // Process death-triggered elite affixes before cleanup
        if (this.isElite && !this.isSplitCopy) {
            this.processDeathAffixes();
        }

        this.isDead = true;
        this.stopFleeBlink();

        // Clean up elite nameplate
        if (this._eliteNameplate) {
            this._eliteNameplate.destroy();
            this._eliteNameplate = null;
        }

        if (this._outlineSprite) {
            this._outlineSprite.destroy();
            this._outlineSprite = null;
        }
        this.disableBody(true, true);
        this.destroy();
    }

    /** Process elite affixes that trigger on death (SPLITTING, EXPLOSIVE). */
    private processDeathAffixes(): void {
        // ── EXPLOSIVE: detonate on death dealing 2 damage in 150px AOE ──
        if (this.hasAffix('EXPLOSIVE')) {
            this.detonateExplosive();
        }

        // ── SPLITTING: spawn 2 smaller copies at 30% HP ──
        if (this.hasAffix('SPLITTING')) {
            this.spawnSplitCopies();
        }
    }

    /** EXPLOSIVE affix: deal 2 damage to all players within 150px. */
    private detonateExplosive(): void {
        if (!this.scene) return;

        const explosionRadius = 150;
        const explosionDamage = 2;

        // Visual: expanding red circle
        const gfx = this.scene.add.graphics();
        gfx.setDepth(150);
        const cx = this.x;
        const cy = this.y;

        // Animate explosion
        const pulseObj = { radius: 10, alpha: 1.0 };
        this.scene.tweens.add({
            targets: pulseObj,
            radius: explosionRadius,
            alpha: 0,
            duration: 400,
            ease: 'Power2',
            onUpdate: () => {
                gfx.clear();
                gfx.fillStyle(0xff4400, pulseObj.alpha * 0.4);
                gfx.fillCircle(cx, cy, pulseObj.radius);
                gfx.lineStyle(2, 0xff6600, pulseObj.alpha);
                gfx.strokeCircle(cx, cy, pulseObj.radius);
            },
            onComplete: () => gfx.destroy(),
        });

        // Damage players in range
        for (const p of this._players) {
            if (!p.active || (p as any).isDead) continue;
            const dist = Phaser.Math.Distance.Between(this.x, this.y, p.x, p.y);
            if (dist <= explosionRadius) {
                p.takeDamage(explosionDamage);
            }
        }
    }

    /** SPLITTING affix: spawn 2 non-elite copies at 30% HP of the original. */
    private spawnSplitCopies(): void {
        if (!this.scene) return;

        // Find the enemies group and registry stored on the scene by SpawnManager
        const enemiesGroup = (this.scene as any)._eliteEnemiesGroup as Phaser.Physics.Arcade.Group | undefined;
        if (!enemiesGroup) return;

        const registry = (this.scene as any)._enemyRegistry as Record<string, any> | undefined;
        if (!registry) return;

        const def = registry[this.enemyType];
        if (!def) return;

        for (let i = 0; i < 2; i++) {
            const offsetX = i === 0 ? -40 : 40;
            const copy = def.factory(this.scene, this.x + offsetX, this.y, this._players);

            // Set to 30% of the original's max HP
            const copyHealth = Math.max(1, Math.ceil(this.maxHealth * 0.3 / 3)); // Divide by 3 to undo elite HP boost
            copy.health = copyHealth;
            copy.maxHealth = copyHealth;

            // Make smaller (75% of original scale before elite boost)
            copy.setScale(this.scaleX * 0.5, this.scaleY * 0.5);

            // Mark as split copy so it won't trigger further splits or elite affixes
            copy.isSplitCopy = true;
            copy.isElite = false;

            // Light tint to distinguish from regular enemies
            copy.setTint(0xffaaaa);

            enemiesGroup.add(copy);
        }
    }

    update(_time: number, _delta: number) {
        if (this.isDead) return;
        // Basic AI behavior — subclasses using useBaseAI get the state machine
        if (this.useBaseAI && _delta > 0) {
            this.updateAI(_delta);
        }

        // Update elite affix behaviors
        if (_delta > 0) {
            this.updateEliteAffixes(_delta);
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
