import { Enemy } from './Enemy';
import { Player } from './Player';

export class ShadowBat extends Enemy {
    private startY: number;
    private timeOffset: number;
    private isDiving: boolean = false;
    private isRecovering: boolean = false;
    // private diveTimer: number = 0;
    private readonly SINE_AMPLITUDE = 50;
    private readonly SINE_SPEED = 0.003;
    private readonly DIVE_SPEED = 400;
    // private readonly RECOVERY_TIME = 1500;

    constructor(scene: Phaser.Scene, x: number, y: number, player: Player) {
        super(scene, x, y, 'dude', player, 2, 1, 100); // 2 HP, 1 Dmg, 100 Speed
        this.setTint(0x550055); // Purple/Shadow tint
        this.setScale(0.7);
        this.startY = y;
        this.timeOffset = Math.random() * 1000;

        // Flying enemy - no gravity
        (this.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    }

    update(time: number, delta: number) {
        super.update(time, delta);
        if (this.isDead) return;

        if (this.isRecovering) {
            this.handleRecovery(delta);
        } else if (this.isDiving) {
            this.handleDive();
        } else {
            this.handleFlight(time);
            this.checkForTarget();
        }
    }

    private handleFlight(time: number) {
        // Sine wave movement
        const wave = Math.sin((time + this.timeOffset) * this.SINE_SPEED);
        this.y = this.startY + wave * this.SINE_AMPLITUDE;

        // Face player
        if (this.player.x < this.x) {
            this.setFlipX(true);
        } else {
            this.setFlipX(false);
        }
    }

    private checkForTarget() {
        // Check if player is below
        const dx = Math.abs(this.x - this.player.x);
        const dy = this.player.y - this.y;

        // If player is roughly below (within 100px horizontal) and below us (positive dy)
        if (dx < 100 && dy > 0 && dy < 400) {
            this.startDive();
        }
    }

    private startDive() {
        this.isDiving = true;
        this.setVelocityY(0);

        // Telegraph: Pause briefly then dive
        this.setTint(0xff00ff); // Flash brighter warning

        this.scene.time.delayedCall(500, () => {
            if (this.isDead) return;
            // Dive towards player's current position
            this.scene.physics.moveToObject(this, this.player, this.DIVE_SPEED);
        });
    }

    private handleDive() {
        // Stop diving if we hit something or go too far
        if (this.body!.blocked.down || this.y > this.startY + 500) {
            this.startRecovery();
        }
    }

    private startRecovery() {
        this.isDiving = false;
        this.isRecovering = true;
        this.setVelocity(0, 0);
        this.setTint(0x550055); // Reset tint

        // Return to start height slowly
        this.scene.physics.moveTo(this, this.x, this.startY, 100);
    }

    private handleRecovery(_delta: number) {
        // Check if back at start height
        if (Math.abs(this.y - this.startY) < 10) {
            this.isRecovering = false;
            this.setVelocity(0, 0);
            this.y = this.startY; // Snap to grid
        }
    }
}
