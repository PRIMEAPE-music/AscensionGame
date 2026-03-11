import Phaser from 'phaser';
import { Enemy } from './Enemy';
import { Player } from './Player';
import { ImpCrawler } from './ImpCrawler';
import { EnemyStateMachine } from '../systems/EnemyStateMachine';

export class DemonSpawner extends Enemy {
    private summonTimer: number = 0;
    private cooldownTimer: number = 0;
    private spawnedMinions: Enemy[] = [];
    private fsm: EnemyStateMachine<DemonSpawner>;
    private pulseTimer: number = 0;
    private defaultTint: number = 0x880088;

    private readonly SUMMON_INTERVAL = 10000;
    private readonly COOLDOWN_DURATION = 2000;
    private readonly MAX_MINIONS = 3;
    private readonly SUMMON_DURATION = 1000;

    constructor(scene: Phaser.Scene, x: number, y: number, player: Player) {
        super(scene, x, y, 'dude', player, 8, 0, 0);
        this.enemyType = 'demon_spawner';
        this.tier = 'intermediate';
        this.setTint(this.defaultTint);
        this.setScale(1.1);

        // Stationary: no gravity, immovable
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setAllowGravity(false);
        body.setImmovable(true);

        this.fsm = new EnemyStateMachine<DemonSpawner>('IDLE', this);
        this.fsm
            .addState('IDLE', {
                onEnter: (ctx) => {
                    ctx.summonTimer = 0;
                    ctx.setTint(ctx.defaultTint);
                },
                onUpdate: (ctx, _time, delta) => {
                    ctx.summonTimer += delta;

                    // Clean up dead/destroyed minions from tracking array
                    ctx.spawnedMinions = ctx.spawnedMinions.filter(
                        (m) => m.active && m.health > 0,
                    );

                    if (ctx.summonTimer >= ctx.SUMMON_INTERVAL) {
                        if (ctx.spawnedMinions.length < ctx.MAX_MINIONS) {
                            ctx.fsm.transition('SUMMONING');
                        } else {
                            // Reset timer; try again later
                            ctx.summonTimer = 0;
                        }
                    }
                },
            })
            .addState('SUMMONING', {
                onEnter: (ctx) => {
                    ctx.pulseTimer = 0;
                },
                onUpdate: (ctx, _time, delta) => {
                    ctx.pulseTimer += delta;

                    // Pulse/flash tint during summoning
                    const flash = Math.sin(ctx.pulseTimer * 0.01) > 0;
                    ctx.setTint(flash ? 0xff00ff : ctx.defaultTint);

                    if (ctx.pulseTimer >= ctx.SUMMON_DURATION) {
                        ctx.performSummon();
                        ctx.fsm.transition('COOLDOWN');
                    }
                },
            })
            .addState('COOLDOWN', {
                onEnter: (ctx) => {
                    ctx.cooldownTimer = 0;
                    ctx.setTint(ctx.defaultTint);
                },
                onUpdate: (ctx, _time, delta) => {
                    ctx.cooldownTimer += delta;
                    if (ctx.cooldownTimer >= ctx.COOLDOWN_DURATION) {
                        ctx.fsm.transition('IDLE');
                    }
                },
            });

        this.fsm.start();
    }

    private performSummon(): void {
        // Clean up dead/destroyed minions from tracking
        this.spawnedMinions = this.spawnedMinions.filter(
            (m) => m.active && m.health > 0,
        );

        const slotsAvailable = this.MAX_MINIONS - this.spawnedMinions.length;
        if (slotsAvailable <= 0) return;

        const count = Math.min(Phaser.Math.Between(1, 2), slotsAvailable);

        // Find the enemies group this spawner belongs to
        const enemiesGroup = this.getEnemiesGroup();

        for (let i = 0; i < count; i++) {
            const offsetX = Phaser.Math.Between(-60, 60);
            const spawnX = this.x + offsetX;
            const spawnY = this.y + 20;

            const minion = new ImpCrawler(this.scene, spawnX, spawnY, this.player);

            if (enemiesGroup) {
                enemiesGroup.add(minion);
            }

            this.spawnedMinions.push(minion);
        }
    }

    /** Access the scene's enemies group (private on MainScene, accessed via cast). */
    private getEnemiesGroup(): Phaser.Physics.Arcade.Group | null {
        const group = (this.scene as any).enemies;
        if (group instanceof Phaser.Physics.Arcade.Group) {
            return group;
        }
        return null;
    }

    update(time: number, delta: number) {
        super.update(time, delta);
        if (this.isDead) return;
        this.fsm.update(time, delta);
    }

    protected die() {
        // Kill all active minions when spawner dies
        for (const minion of this.spawnedMinions) {
            if (minion.active && minion.health > 0) {
                minion.takeDamage(minion.health);
            }
        }
        this.spawnedMinions = [];
        super.die();
    }
}
