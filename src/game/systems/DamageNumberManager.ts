import Phaser from 'phaser';

export class DamageNumberManager {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Show a floating damage number at the given position.
   * @param x world X
   * @param y world Y
   * @param damage the number to display
   * @param isHeavy if true, show larger yellow text
   */
  show(x: number, y: number, damage: number, isHeavy: boolean = false): void {
    const fontSize = isHeavy ? '24px' : '18px';
    const color = isHeavy ? '#ffcc00' : '#ffffff';

    const text = this.scene.add.text(x, y - 20, `${damage}`, {
      fontSize,
      fontFamily: 'monospace',
      color,
      stroke: '#000000',
      strokeThickness: 3,
      fontStyle: 'bold',
    });
    text.setOrigin(0.5);
    text.setDepth(100);

    // Random horizontal offset for variety
    const offsetX = Phaser.Math.Between(-20, 20);

    this.scene.tweens.add({
      targets: text,
      x: x + offsetX,
      y: y - 80,
      alpha: 0,
      scale: isHeavy ? 1.5 : 1.2,
      duration: 800,
      ease: 'Power2',
      onComplete: () => text.destroy(),
    });
  }
}
