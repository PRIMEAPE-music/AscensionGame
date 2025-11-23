import Phaser from 'phaser';
import { Player } from './Player';

export class Enemy extends Phaser.Physics.Arcade.Sprite {
    protected player: Player;
    protected health: number;
    protected damage: number;
    protected speed: number;
    protected isDead: boolean = false;

    constructor(scene: Phaser.Scene, x: number, y: number, texture: string, player: Player, health: number, damage: number, speed: number) {
        super(scene, x, y, texture);
        this.player = player;
        this.health = health;
        this.damage = damage;
        this.speed = speed;

        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setCollideWorldBounds(false); // Enemies can fall off world
    }

    public takeDamage(amount: number) {
        if (this.isDead) return;

        this.health -= amount;
        this.setTint(0xff0000);
        this.scene.time.delayedCall(100, () => {
            if (!this.isDead) this.clearTint();
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
