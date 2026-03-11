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

    private baseSummonInterval: number = 10000;
    private readonly COOLDOWN_DURATION = 2000;
    private readonly MAX_MINIONS = 3;
    private readonly SUMMON_DURATION = 1000;
    private readonly DETECT_RANGE = 600;

    constructor(scene: Phaser.Scene, x: number, y: number, player: Player) {
        super(scene, x, y, 'dude', player, 8, 0, 0);
        this.enemyType = 'demon_spawner';
        this.tier = 'intermediate';
        this.defaultTint = 0x880088;
        this.setTint(this.defaultTint);
        this.setScale(1.1);

        // Spawner config: desperate mode (summons faster), never flees
        this.desperateMode = true;
        this.fleeThreshold = 0.2;

        // Stationary: no gravity, immovable
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setAllowGravity(false);
        body.setImmovable(true);

        this.fsm = new EnemyStateMachine<DemonSpawner>('IDLE', this);
        this.fsm
            .addState('IDLE', {
                onEnter: (ctx) => {
                    ctx.summonTimer = 0;
                    ctx.restoreTint();
                    ctx.aiState = 'IDLE';
                },
                onUpdate: (ctx, _time, delta) => {
                    ctx.summonTimer += delta;

                    // Clean up dead/destroyed minions from tracking array
                    ctx.spawnedMinions = ctx.spawnedMinions.filter(
                        (m) => m.active && m.health > 0,
                    );

                    // Check if player is in range to start summoning
                    const dist = Phaser.Math.Distance.Between(
                        ctx.x, ctx.y, ctx.player.x, ctx.player.y,
                    );
                    if (dist < ctx.DETECT_RANGE) {
                        ctx.fsm.transition('ALERT');
                    }
                },
            })
            .addState('ALERT', {
                onEnter: (ctx) => {
                    ctx.summonTimer = 0;
                    ctx.aiState = 'ALERT';
                    ctx.restoreTint();
                },
                onUpdate: (ctx, _time, delta) => {
                    ctx.summonTimer += delta;

                    // Clean up dead/destroyed minions
                    ctx.spawnedMinions = ctx.spawnedMinions.filter(
                        (m) => m.active && m.health > 0,
                    );

                    // Desperate mode: summon 50% faster
                    const summonInterval = (ctx.desperateMode && ctx.health <= ctx.maxHealth * ctx.fleeThreshold)
                        ? ctx.baseSummonInterval * 0.5
                        : ctx.baseSummonInterval;

                    if (ctx.summonTimer >= summonInterval) {
                        if (ctx.spawnedMinions.length < ctx.MAX_MINIONS) {
                            ctx.fsm.transition('SUMMONING');
                        } else {
                            // Reset timer; try again later
                            ctx.summonTimer = 0;
                        }
                    }

                    // If player leaves range, go back to idle
                    const dist = Phaser.Math.Distance.Between(
                        ctx.x, ctx.y, ctx.player.x, ctx.player.y,
                    );
                    if (dist > ctx.DETECT_RANGE * 1.5) {
                        ctx.fsm.transition('IDLE');
                    }
                },
            })
            .addState('SUMMONING', {
                onEnter: (ctx) => {
                    ctx.pulseTimer = 0;
                    ctx.aiState = 'ATTACK';
                    ctx.isInAttackStartup = true;
                },
                onUpdate: (ctx, _time, delta) => {
                    ctx.pulseTimer += delta;

                    // Pulse/flash tint during summoning
                    const flash = Math.sin(ctx.pulseTimer * 0.01) > 0;
                    ctx.setTint(flash ? 0xff00ff : ctx.defaultTint);

                    if (ctx.pulseTimer >= ctx.SUMMON_DURATION) {
                        ctx.isInAttackStartup = false;
                        ctx.performSummon();
                        ctx.fsm.transition('COOLDOWN');
                    }
                },
            })
            .addState('COOLDOWN', {
                onEnter: (ctx) => {
                    ctx.cooldownTimer = 0;
                    ctx.isInAttackStartup = false;
                    ctx.restoreTint();
                    ctx.aiState = 'PATROL';
                },
                onUpdate: (ctx, _time, delta) => {
                    ctx.cooldownTimer += delta;
                    if (ctx.cooldownTimer >= ctx.COOLDOWN_DURATION) {
                        ctx.fsm.transition('ALERT');
                    }
                },
            })
            .addState('STUN', {
                onEnter: (ctx) => {
                    ctx.isInAttackStartup = false;
                    ctx.setVelocity(0, 0);
                    ctx.setTint(0xffff00);
                    ctx.aiState = 'STUN';
                },
                onUpdate: (ctx, _time, delta) => {
                    ctx.stunTimer -= delta;
                    if (ctx.stunTimer <= 0) {
                        ctx.restoreTint();
                        ctx.fsm.transition('ALERT');
                    }
                },
            });

        this.fsm.start();
    }

    public takeDamage(amount: number) {
        if (this.isDead) return;

        // Apply stun damage multiplier
        if (this.aiState === 'STUN') {
            amount = Math.ceil(amount * this.stunDamageMultiplier);
        }

        // Check if hit during attack startup — triggers stun
        if (this.isInAttackStartup) {
            this.stunTimer = 500 + amount * 100;
            this.fsm.transition('STUN');
        }

        this.health -= amount;

        // Flash red on hit
        this.setTint(0xff0000);
        this.scene.time.delayedCall(100, () => {
            if (this.active && !this.isDead) {
                this.restoreTint();
            }
        });

        if (this.health <= 0) {
            this.die();
        }
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
