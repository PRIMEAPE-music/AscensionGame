import Phaser from 'phaser';

export class LevelGenerator {
    private scene: Phaser.Scene;
    private staticPlatforms: Phaser.Physics.Arcade.StaticGroup;
    private movingPlatforms: Phaser.Physics.Arcade.Group;
    private lastPlatformY: number;
    private lastPlatformX: number;

    constructor(scene: Phaser.Scene, staticPlatforms: Phaser.Physics.Arcade.StaticGroup, movingPlatforms: Phaser.Physics.Arcade.Group) {
        this.scene = scene;
        this.staticPlatforms = staticPlatforms;
        this.movingPlatforms = movingPlatforms;
        this.lastPlatformY = 1050; // Start from the bottom
        this.lastPlatformX = 960;
    }

    init() {
        // Create initial platforms
        this.createPlatform(960, 1050, 10, 'standard'); // Base floor
        this.createPlatform(600, 800, 2, 'standard');
        this.createPlatform(1400, 700, 2, 'moving');
        this.createPlatform(200, 500, 2, 'standard');
        this.createPlatform(1000, 300, 2, 'breakable');

        this.lastPlatformY = 300;
        this.lastPlatformX = 1000;
    }

    update(playerY: number) {
        // Generate new platforms as player climbs
        const generationThreshold = playerY - 1200; // Generate ahead of player (increased range)

        if (this.lastPlatformY > generationThreshold) {
            this.generateNextChunk(Math.abs(playerY - 1000)); // Pass approximate altitude
        }

        // Cleanup old platforms
        this.cleanupPlatforms(this.staticPlatforms, playerY);
        this.cleanupPlatforms(this.movingPlatforms, playerY);
    }

    private cleanupPlatforms(group: Phaser.Physics.Arcade.Group | Phaser.Physics.Arcade.StaticGroup, playerY: number) {
        group.children.each((child: any) => {
            if (child.y > playerY + 1500) { // Increased cleanup buffer
                group.remove(child, true, true);
            }
            return true;
        });
    }

    private getDifficultyParams(altitude: number) {
        // Difficulty Tiers based on altitude
        if (altitude < 3000) {
            return { minGap: 100, maxGap: 200, density: 'high', movingChance: 0.1, breakableChance: 0.1 };
        } else if (altitude < 6000) {
            return { minGap: 150, maxGap: 280, density: 'medium', movingChance: 0.25, breakableChance: 0.2 };
        } else {
            return { minGap: 200, maxGap: 350, density: 'low', movingChance: 0.4, breakableChance: 0.3 };
        }
    }

    private generateNextChunk(altitude: number) {
        const params = this.getDifficultyParams(altitude);
        const patternRoll = Math.random();

        // Select Pattern
        if (patternRoll < 0.3) {
            this.generateZigZagPattern(params);
        } else if (patternRoll < 0.5) {
            this.generateWallJumpSection(params);
        } else {
            this.generateStandardPlatform(params);
        }
    }

    private generateStandardPlatform(params: any) {
        const yGap = Phaser.Math.Between(params.minGap, params.maxGap);
        const y = this.lastPlatformY - yGap;

        // Random X but keep it reachable from last X (max horizontal jump is ~300-400)
        // We clamp it to screen bounds with padding
        let minX = Math.max(100, this.lastPlatformX - 400);
        let maxX = Math.min(1820, this.lastPlatformX + 400);
        const x = Phaser.Math.Between(minX, maxX);

        const scale = Phaser.Math.FloatBetween(0.8, 2.0);

        // Determine type
        const typeRoll = Math.random();
        let type = 'standard';
        if (typeRoll < params.movingChance) type = 'moving';
        else if (typeRoll < params.movingChance + params.breakableChance) type = 'breakable';

        this.createPlatform(x, y, scale, type);
        this.lastPlatformY = y;
        this.lastPlatformX = x;
    }

    private generateZigZagPattern(params: any) {
        const steps = Phaser.Math.Between(3, 5);
        const yGap = Phaser.Math.Between(params.minGap, params.maxGap);

        for (let i = 0; i < steps; i++) {
            const y = this.lastPlatformY - yGap;
            // Alternate Left/Right
            // If last was left (< 960), go right. Else go left.
            const isLeft = this.lastPlatformX < 960;
            const x = isLeft ?
                Phaser.Math.Between(1000, 1700) :
                Phaser.Math.Between(200, 900);

            this.createPlatform(x, y, 1.5, 'standard');
            this.lastPlatformY = y;
            this.lastPlatformX = x;
        }
    }

    private generateWallJumpSection(params: any) {
        const steps = Phaser.Math.Between(3, 6);
        const yGap = 150; // Fixed small gap for wall jumps
        const wallX = Math.random() > 0.5 ? 200 : 1720; // Left or Right wall area

        for (let i = 0; i < steps; i++) {
            const y = this.lastPlatformY - yGap;
            // Platforms close to the wall
            const x = wallX + Phaser.Math.Between(-50, 50);

            this.createPlatform(x, y, 0.8, 'standard');
            this.lastPlatformY = y;
            this.lastPlatformX = x;
        }
    }

    private createPlatform(x: number, y: number, scale: number, type: string) {
        let platform: any;

        if (type === 'moving') {
            platform = this.movingPlatforms.create(x, y, 'ground');
            platform.setScale(scale, 1);
            platform.setImmovable(true);
            platform.body.allowGravity = false;
            platform.setData('type', 'moving');

            // Add movement tween
            const moveDist = 200;
            // Ensure we don't move offscreen
            const targetX = x + moveDist > 1850 ? x - moveDist : x + moveDist;

            this.scene.tweens.add({
                targets: platform,
                x: targetX,
                duration: 2000,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });

            // Tint for visual distinction
            platform.setTint(0x00ffff);
        } else if (type === 'breakable') {
            platform = this.staticPlatforms.create(x, y, 'ground');
            platform.setScale(scale, 1).refreshBody();
            platform.setTint(0xff0000); // Red for breakable
            platform.setData('type', 'breakable');
        } else {
            // Standard
            platform = this.staticPlatforms.create(x, y, 'ground');
            platform.setScale(scale, 1).refreshBody();
            platform.setData('type', 'standard');
        }
    }
}
