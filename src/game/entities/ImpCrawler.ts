import Phaser from 'phaser';
import { Enemy } from './Enemy';
import { Player } from './Player';

export class ImpCrawler extends Enemy {
    private direction: number = 1;
    private moveTimer: number = 0;
    private attackCooldown: number = 0;
    private readonly ATTACK_COOLDOWN_DURATION = 800;

    constructor(scene: Phaser.Scene, x: number, y: number, player: Player) {
        super(scene, x, y, 'dude', player, 3, 1, 100); // Reusing 'dude' texture for now, will tint
        this.enemyType = 'crawler';
        this.tier = 'basic';
        this.defaultTint = 0x00ff00;
        this.setTint(0x00ff00); // Greenish tint for Imp
        this.setScale(0.8);
        this.setFlipX(this.direction < 0);

        // Use the base AI state machine
        this.useBaseAI = true;
        this.detectionRange = 250;
        this.attackRange = 60;
        this.desperateMode = false; // Flees when low
        this.fleeThreshold = 0.2;
    }

    protected onPatrol(delta: number): void {
        this.setVelocityX(this.speed * this.direction);

        this.moveTimer += delta;
        if (this.moveTimer > 2000) {
            this.direction *= -1;
            this.moveTimer = 0;
            this.setFlipX(this.direction < 0);
        }
        this.facingDirection = this.direction;
    }

    protected onAlert(_delta: number, player: Phaser.GameObjects.Sprite): void {
        // Walk toward player at faster speed
        const dx = player.x - this.x;
        this.direction = dx > 0 ? 1 : -1;
        this.setVelocityX(this.speed * 1.3 * this.direction);
        this.setFlipX(this.direction < 0);
        this.facingDirection = this.direction;
    }

    protected onAttack(delta: number, player: Phaser.GameObjects.Sprite): void {
        // Swipe attack when close
        this.attackCooldown -= delta;
        const dx = player.x - this.x;
        this.direction = dx > 0 ? 1 : -1;
        this.setFlipX(this.direction < 0);
        this.facingDirection = this.direction;

        if (this.attackCooldown <= 0) {
            // Brief attack startup (vulnerable to stun)
            this.isInAttackStartup = true;
            this.setVelocityX(0);

            this.scene.time.delayedCall(200, () => {
                if (this.isDead || this.aiState === 'STUN') return;
                this.isInAttackStartup = false;
                // Lunge forward slightly
                this.setVelocityX(this.speed * 2 * this.direction);
                this.scene.time.delayedCall(150, () => {
                    if (this.active && !this.isDead) {
                        this.setVelocityX(0);
                    }
                });
            });
            this.attackCooldown = this.ATTACK_COOLDOWN_DURATION;
        }
    }

    protected onFlee(_delta: number, player: Phaser.GameObjects.Sprite): void {
        // Turn away from player, move at 1.5x speed
        const dx = player.x - this.x;
        this.direction = dx > 0 ? -1 : 1; // Move AWAY
        this.setVelocityX(this.speed * 1.5 * this.direction);
        this.setFlipX(this.direction < 0);
        this.facingDirection = this.direction;
    }

    update(time: number, delta: number) {
        super.update(time, delta);
    }
}
