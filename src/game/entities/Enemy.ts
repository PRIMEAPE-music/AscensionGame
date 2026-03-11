import Phaser from 'phaser';
import { Player } from './Player';
import type { EnemyTier } from '../config/EnemyConfig';

export class Enemy extends Phaser.Physics.Arcade.Sprite {
    protected player: Player;
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

    constructor(scene: Phaser.Scene, x: number, y: number, texture: string, player: Player, health: number, damage: number, speed: number) {
        super(scene, x, y, texture);
        this.player = player;
        this.health = health;
        this.maxHealth = health;
        this.damage = damage;
        this.speed = speed;

        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setCollideWorldBounds(false); // Enemies can fall off world
    }

    /** Apply elite modifiers: 3x health, 1.5x damage, 1.2x speed, silver aura. */
    public applyElite(): void {
        this.isElite = true;
        this.health *= 3;
        this.maxHealth *= 3;
        this.damage = Math.ceil(this.damage * 1.5);
        this.speed *= 1.2;
        this.setTint(0xccccff); // Silver aura
    }

    public takeDamage(amount: number) {
        if (this.isDead) return;

        this.health -= amount;

        // Flash red on hit (elite flashes back to silver, normal clears tint)
        this.setTint(0xff0000);
        this.scene.time.delayedCall(100, () => {
            if (this.active && !this.isDead) {
                if (this.isElite) {
                    this.setTint(0xccccff);
                } else {
                    this.clearTint();
                }
            }
        });

        if (this.health <= 0) {
            this.die();
        }
    }

    protected die() {
        this.isDead = true;
        this.disableBody(true, true);
        this.destroy();
    }

    update(_time: number, _delta: number) {
        if (this.isDead) return;
        // Basic AI behavior to be overridden
    }
}
