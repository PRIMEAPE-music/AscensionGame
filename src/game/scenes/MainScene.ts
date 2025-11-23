import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { LevelGenerator } from '../systems/LevelGenerator';
import { Enemy } from '../entities/Enemy';
import { ImpCrawler } from '../entities/ImpCrawler';
import { ShadowBat } from '../entities/ShadowBat';
import { ClassType } from '../config/ClassConfig';
import { ItemDrop } from '../entities/ItemDrop';
import { ITEMS } from '../config/ItemDatabase';

export class MainScene extends Phaser.Scene {
    private player!: Player;
    private staticPlatforms!: Phaser.Physics.Arcade.StaticGroup;
    private movingPlatforms!: Phaser.Physics.Arcade.Group;
    private enemies!: Phaser.Physics.Arcade.Group;
    private items!: Phaser.Physics.Arcade.Group;
    private levelGenerator!: LevelGenerator;
    private leftWall!: Phaser.GameObjects.Rectangle;
    private rightWall!: Phaser.GameObjects.Rectangle;

    constructor() {
        super({ key: 'MainScene' });
    }

    preload() {
        // Generate textures programmatically to avoid external dependencies

        // Ground texture
        const ground = this.make.graphics({ x: 0, y: 0 }, false);
        ground.fillStyle(0x00ff00);
        ground.fillRect(0, 0, 400, 32);
        ground.generateTexture('ground', 400, 32);

        // Player texture (placeholder for 'dude')
        const player = this.make.graphics({ x: 0, y: 0 }, false);
        player.fillStyle(0xffffff);
        player.fillRect(0, 0, 32, 48);
        player.generateTexture('dude', 32, 48);

        // Sky texture (optional, just use background color)
        const sky = this.make.graphics({ x: 0, y: 0 }, false);
        sky.fillStyle(0x000033);
        sky.fillRect(0, 0, 800, 600);
        sky.generateTexture('sky', 800, 600);
    }

    create() {
        this.add.image(960, 540, 'sky').setScale(2).setScrollFactor(0); // Fixed background

        this.staticPlatforms = this.physics.add.staticGroup();
        this.movingPlatforms = this.physics.add.group({
            allowGravity: false,
            immovable: true
        });
        this.enemies = this.physics.add.group({
            runChildUpdate: true
        });
        this.items = this.physics.add.group();

        // Create Infinite Walls
        // Left Wall (x=-25, width=50)
        this.leftWall = this.add.rectangle(-25, 540, 50, 2000, 0x333333);
        this.physics.add.existing(this.leftWall, true); // Static body

        // Right Wall (x=1945, width=50)
        this.rightWall = this.add.rectangle(1945, 540, 50, 2000, 0x333333);
        this.physics.add.existing(this.rightWall, true); // Static body

        this.levelGenerator = new LevelGenerator(this, this.staticPlatforms, this.movingPlatforms);
        this.levelGenerator.init();

        // Initialize Player with specific class (e.g., MONK)
        this.player = new Player(this, 960, 950, ClassType.MONK);

        // Colliders
        this.physics.add.collider(this.player, this.staticPlatforms, this.handleStaticPlatformCollision, undefined, this);
        this.physics.add.collider(this.player, this.movingPlatforms, this.handleMovingPlatformCollision, undefined, this);
        this.physics.add.collider(this.enemies, this.staticPlatforms);
        this.physics.add.collider(this.enemies, this.movingPlatforms);
        this.physics.add.collider(this.items, this.staticPlatforms);
        this.physics.add.collider(this.items, this.movingPlatforms);

        // Wall Collisions
        this.physics.add.collider(this.player, this.leftWall);
        this.physics.add.collider(this.player, this.rightWall);

        // Combat Collisions
        this.physics.add.overlap(this.player, this.enemies, this.handlePlayerEnemyCollision, undefined, this);
        this.physics.add.overlap(this.player, this.items, this.handlePlayerItemCollision, undefined, this);

        // Camera follows player
        this.cameras.main.startFollow(this.player, true, 0.05, 0.05);
        this.cameras.main.setDeadzone(100, 100);
        this.cameras.main.setZoom(1);

        this.add.text(10, 10, 'Ascension Prototype', { fontSize: '32px', color: '#fff' }).setScrollFactor(0);

        // Initial Enemy Spawn (Test)
        this.spawnEnemy(600, 750);

        // Initial Item Spawn (Test)
        this.spawnItem(800, 900, 'hermes_feather'); // Test Double Jump
        this.spawnItem(1100, 900, 'winged_boots'); // Test Speed
    }

    update(time: number, delta: number) {
        this.player.update(time, delta);
        this.levelGenerator.update(this.player.y);

        // Emit altitude change (inverted Y, normalized to 0 at start)
        const altitude = Math.max(0, (950 - this.player.y) / 10);
        window.dispatchEvent(new CustomEvent('altitude-change', { detail: { altitude } }));

        // Check for attack hits
        if (this.player.isAttacking && this.player.attackHitbox) {
            this.physics.overlap(this.player.attackHitbox, this.enemies, this.handleAttackHit, undefined, this);
        }

        // Infinite background scrolling illusion (optional, for now just fixed)
        // Infinite background scrolling illusion (optional, for now just fixed)
        if (this.player.y > 2000) {
            // Reset player if they fall too far (simple death plane)
            this.player.setPosition(100, 450);
            this.player.setVelocity(0, 0);
            this.player.takeDamage(1);
        }

        // Update Wall Positions to follow camera vertically
        const camY = this.cameras.main.scrollY;
        const camHeight = this.cameras.main.height;

        this.leftWall.y = camY + camHeight / 2;
        this.rightWall.y = camY + camHeight / 2;

        // Refresh physics bodies
        (this.leftWall.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject();
        (this.rightWall.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject();
    }

    private handleAttackHit(_attackHitbox: any, enemy: any) {
        try {
            if (this.player.hitEnemies.has(enemy)) return;

            this.player.hitEnemies.add(enemy);

            if (enemy instanceof Enemy) {
                enemy.takeDamage(1);

                // Knockback
                const direction = enemy.x > this.player.x ? 1 : -1;
                enemy.setVelocityX(200 * direction);
                enemy.setVelocityY(-200);
            }
        } catch (e) {
            console.error('[MainScene] Error in handleAttackHit:', e);
        }
    }

    private handlePlayerEnemyCollision(_player: any, enemy: any) {
        if (enemy instanceof Enemy) {
            // Simple damage logic
            this.player.takeDamage(1);

            // Emit health change
            window.dispatchEvent(new CustomEvent('health-change', {
                detail: { health: this.player.health, maxHealth: 5 }
            }));

            // Knockback player
            const direction = this.player.x > enemy.x ? 1 : -1;
            this.player.setVelocityX(300 * direction);
            this.player.setVelocityY(-300);
        }
    }

    private handleStaticPlatformCollision(player: any, platform: any) {
        if (platform.getData('type') === 'breakable' && platform.body.touching.up && player.body.touching.down) {
            if (!platform.getData('isBreaking')) {
                platform.setData('isBreaking', true);

                // Shake effect or visual cue
                this.tweens.add({
                    targets: platform,
                    alpha: 0.5,
                    duration: 500,
                    onComplete: () => {
                        platform.disableBody(true, true); // Hide and disable

                        // Respawn after 8 seconds
                        this.time.delayedCall(8000, () => {
                            if (platform.active) { // Check if not destroyed by cleanup
                                platform.enableBody(false, platform.x, platform.y, true, true);
                                platform.setAlpha(1);
                                platform.setData('isBreaking', false);
                            }
                        });
                    }
                });
            }
        }
    }

    private handleMovingPlatformCollision(player: any, platform: any) {
        // Custom logic for moving platforms if needed (e.g. friction)
        if (platform.body.touching.up && player.body.touching.down) {
            // Player is on top
        }
    }
    private spawnEnemy(x: number, y: number) {
        const type = Math.random() > 0.5 ? 'crawler' : 'bat';
        let enemy: Enemy;

        if (type === 'crawler') {
            enemy = new ImpCrawler(this, x, y, this.player);
        } else {
            enemy = new ShadowBat(this, x, y, this.player);
        }

        this.enemies.add(enemy);
    }

    private spawnItem(x: number, y: number, itemId: string) {
        const itemData = ITEMS[itemId];
        if (itemData) {
            const item = new ItemDrop(this, x, y, itemData);
            this.items.add(item);
        }
    }

    private handlePlayerItemCollision(_player: any, item: any) {
        if (item instanceof ItemDrop) {
            this.player.collectItem(item.itemData);
            item.destroy();
        }
    }
}
