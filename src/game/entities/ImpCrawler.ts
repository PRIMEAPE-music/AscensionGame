import { Enemy } from './Enemy';
import { Player } from './Player';

export class ImpCrawler extends Enemy {
    private direction: number = 1;
    private moveTimer: number = 0;

    constructor(scene: Phaser.Scene, x: number, y: number, player: Player) {
        super(scene, x, y, 'dude', player, 3, 1, 100); // Reusing 'dude' texture for now, will tint
        this.setTint(0x00ff00); // Greenish tint for Imp
        this.setScale(0.8);
    }

    update(time: number, delta: number) {
        super.update(time, delta);
        if (this.isDead) return;

        // Patrol logic
        this.setVelocityX(this.speed * this.direction);

        // Turn around at edges or randomly
        // Check for platform edges would require raycasting or tile checks, 
        // for now simple timer based turning
        this.moveTimer += delta;
        if (this.moveTimer > 2000) {
            this.direction *= -1;
            this.moveTimer = 0;
            this.setFlipX(this.direction < 0);
        }
    }
}
