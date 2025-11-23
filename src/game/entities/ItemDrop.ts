import Phaser from 'phaser';
import type { ItemData } from '../config/ItemConfig';

export class ItemDrop extends Phaser.Physics.Arcade.Sprite {
    public itemData: ItemData;
    // private startY: number;

    constructor(scene: Phaser.Scene, x: number, y: number, itemData: ItemData) {
        super(scene, x, y, 'ground'); // Using 'ground' texture as placeholder, tinted

        this.itemData = itemData;
        // this.startY = y;

        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setScale(0.5);
        this.setTint(itemData.iconColor);

        // Physics properties
        (this.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
        (this.body as Phaser.Physics.Arcade.Body).setImmovable(true);

        // Bobbing animation
        scene.tweens.add({
            targets: this,
            y: y - 10,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }
}
