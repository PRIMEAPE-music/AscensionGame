import Phaser from 'phaser';
import { EventBus } from './EventBus';

export class RisingDarkness {
    private scene: Phaser.Scene;
    private darknessY: number = 0; // World Y coordinate of the darkness line (Y decreases going up)
    private enabled: boolean = false;
    private darknessGraphics: Phaser.GameObjects.Graphics;
    private edgeGlow: Phaser.GameObjects.Graphics;
    private damageTimer: number = 0;
    private enemyDamageTimer: number = 0;
    private glowPhase: number = 0;

    private readonly RISE_SPEED = 5; // pixels per second (matching game meters)
    private readonly DAMAGE_INTERVAL = 2000; // ms between damage ticks
    private readonly DAMAGE_AMOUNT = 1;
    private readonly EDGE_GLOW_WIDTH = 4;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;

        // Create graphics objects for the darkness overlay — fixed to camera (screen space)
        this.darknessGraphics = scene.add.graphics();
        this.darknessGraphics.setScrollFactor(0);
        this.darknessGraphics.setDepth(150); // Above most game objects but below UI

        this.edgeGlow = scene.add.graphics();
        this.edgeGlow.setScrollFactor(0);
        this.edgeGlow.setDepth(151);
    }

    enable(startY: number): void {
        // Start darkness well below the player's initial position
        this.darknessY = startY + 400;
        this.enabled = true;
        this.damageTimer = this.DAMAGE_INTERVAL; // Grace period before first damage
        this.enemyDamageTimer = this.DAMAGE_INTERVAL;
    }

    update(delta: number, playerY: number, playerTakeDamage: (amount: number) => void, enemies: Phaser.Physics.Arcade.Group): void {
        if (!this.enabled) return;

        // Rise the darkness line (Y decreases = going up in Phaser's coordinate system)
        this.darknessY -= this.RISE_SPEED * (delta / 1000);

        // Update glow animation phase
        this.glowPhase += delta * 0.003;

        // Draw the darkness visual
        this.drawDarkness();

        // Check if player is below the darkness line (larger Y = lower position)
        this.damageTimer -= delta;
        if (playerY > this.darknessY && this.damageTimer <= 0) {
            playerTakeDamage(this.DAMAGE_AMOUNT);
            this.damageTimer = this.DAMAGE_INTERVAL;
        }

        // Damage enemies below darkness too
        this.enemyDamageTimer -= delta;
        if (this.enemyDamageTimer <= 0) {
            this.enemyDamageTimer = this.DAMAGE_INTERVAL;
            enemies.getChildren().forEach((child) => {
                const enemy = child as any;
                if (enemy.y > this.darknessY && typeof enemy.takeDamage === 'function') {
                    enemy.takeDamage(this.DAMAGE_AMOUNT);
                }
            });
        }
    }

    private drawDarkness(): void {
        const cam = this.scene.cameras.main;
        // Convert world Y to screen Y
        const screenY = this.darknessY - cam.scrollY;

        this.darknessGraphics.clear();
        this.edgeGlow.clear();

        // Only draw if the darkness line is visible on screen
        if (screenY > cam.height + 50) {
            // Darkness is fully below the screen — nothing to draw
            return;
        }

        if (screenY < -50) {
            // Darkness covers the entire screen
            this.darknessGraphics.fillStyle(0x1a0033, 0.8);
            this.darknessGraphics.fillRect(0, 0, cam.width, cam.height);
            return;
        }

        // Draw gradient-like effect: multiple bands of increasing opacity
        const bands = 5;
        const bandHeight = 30;
        for (let i = 0; i < bands; i++) {
            const alpha = 0.1 + (i * 0.12);
            const bandY = screenY - (bands - i) * bandHeight;
            this.darknessGraphics.fillStyle(0x1a0033, alpha);
            this.darknessGraphics.fillRect(0, bandY, cam.width, bandHeight);
        }

        // Main darkness fill below the line
        this.darknessGraphics.fillStyle(0x1a0033, 0.8);
        this.darknessGraphics.fillRect(0, screenY, cam.width, cam.height - screenY + 100);

        // Pulsing edge glow at the darkness boundary
        const glowAlpha = 0.5 + 0.3 * Math.sin(this.glowPhase);
        this.edgeGlow.lineStyle(this.EDGE_GLOW_WIDTH, 0x6600cc, glowAlpha);
        this.edgeGlow.lineBetween(0, screenY, cam.width, screenY);

        // Secondary thinner bright glow
        const innerGlowAlpha = 0.3 + 0.2 * Math.sin(this.glowPhase + 1.5);
        this.edgeGlow.lineStyle(1, 0xaa44ff, innerGlowAlpha);
        this.edgeGlow.lineBetween(0, screenY - 2, cam.width, screenY - 2);
    }

    getY(): number {
        return this.darknessY;
    }

    isEnabled(): boolean {
        return this.enabled;
    }

    destroy(): void {
        this.darknessGraphics.destroy();
        this.edgeGlow.destroy();
    }
}
