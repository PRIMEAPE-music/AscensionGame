import Phaser from 'phaser';
import { Enemy } from './Enemy';
import { Player } from './Player';
import { EnemyStateMachine } from '../systems/EnemyStateMachine';
import { COMBAT } from '../config/GameConfig';
import { EventBus } from '../systems/EventBus';

export class ArmorColossus extends Enemy {
    private direction: number = 1;
    private patrolTimer: number = 0;
    private telegraphTimer: number = 0;
    private recoveryTimer: number = 0;
    private shockwaveGroup: Phaser.Physics.Arcade.Group;
    private shockwaveCollider: Phaser.Physics.Arcade.Collider;
    private fsm: EnemyStateMachine<ArmorColossus>;

    private readonly PATROL_TURN_INTERVAL = 4000;
    private readonly DETECT_RANGE = 500;
    private readonly ATTACK_RANGE = 200;
    private readonly TELEGRAPH_DURATION = 600;
    private readonly RECOVERY_DURATION = 1200;
    private readonly SHOCKWAVE_WIDTH = 500;
    private readonly SHOCKWAVE_HEIGHT = 20;
    private readonly SHOCKWAVE_DURATION = 300;

    constructor(scene: Phaser.Scene, x: number, y: number, player: Player | Player[]) {
        super(scene, x, y, 'dude', player, 25, 2, 40);
        this.enemyType = 'armor_colossus';
        this.tier = 'advanced';
        this.defaultTint = 0x888888;
        this.setTint(this.defaultTint);
        this.setScale(1.3);

        // Colossus config: desperate mode (attacks faster), never flees
        this.desperateMode = true;
        this.fleeThreshold = 0.2;

        // Large physics body
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setSize(body.width * 1.3, body.height * 1.3);

        // Shockwave group for overlap detection
        this.shockwaveGroup = scene.physics.add.group({ allowGravity: false });

        const playerList = Array.isArray(player) ? player : [player];
        this.shockwaveCollider = scene.physics.add.overlap(
            playerList,
            this.shockwaveGroup,
            (p: any) => this.onShockwaveHitPlayer(p),
            undefined,
            this,
        );

        this.fsm = new EnemyStateMachine<ArmorColossus>('PATROL', this);
        this.fsm
            .addState('PATROL', {
                onEnter: (ctx) => {
                    ctx.patrolTimer = 0;
                    ctx.restoreTint();
                    ctx.aiState = 'PATROL';
                },
                onUpdate: (ctx, _time, delta) => {
                    ctx.setVelocityX(ctx.speed * 0.5 * ctx.direction);
                    ctx.setFlipX(ctx.direction < 0);
                    ctx.facingDirection = ctx.direction;

                    ctx.patrolTimer += delta;
                    if (ctx.patrolTimer >= ctx.PATROL_TURN_INTERVAL) {
                        ctx.direction *= -1;
                        ctx.patrolTimer = 0;
                    }

                    const dist = Phaser.Math.Distance.Between(
                        ctx.x, ctx.y, ctx.player.x, ctx.player.y,
                    );
                    if (dist < ctx.DETECT_RANGE) {
                        ctx.fsm.transition('APPROACH');
                    }
                },
            })
            .addState('APPROACH', {
                onEnter: (ctx) => {
                    ctx.aiState = 'ALERT';
                    ctx.restoreTint();
                },
                onUpdate: (ctx, _time, _delta) => {
                    const dx = ctx.player.x - ctx.x;
                    ctx.direction = dx > 0 ? 1 : -1;

                    // Desperate mode: move faster
                    const speedMult = (ctx.desperateMode && ctx.health <= ctx.maxHealth * ctx.fleeThreshold) ? 1.5 : 1.0;
                    ctx.setVelocityX(ctx.speed * ctx.direction * speedMult);
                    ctx.setFlipX(ctx.direction < 0);
                    ctx.facingDirection = ctx.direction;

                    const dist = Phaser.Math.Distance.Between(
                        ctx.x, ctx.y, ctx.player.x, ctx.player.y,
                    );

                    if (dist < ctx.ATTACK_RANGE) {
                        ctx.fsm.transition('GROUND_POUND');
                        return;
                    }

                    if (dist > ctx.DETECT_RANGE * 1.5) {
                        ctx.fsm.transition('PATROL');
                    }
                },
            })
            .addState('GROUND_POUND', {
                onEnter: (ctx) => {
                    ctx.telegraphTimer = 0;
                    ctx.setVelocityX(0);
                    ctx.aiState = 'ATTACK';
                    ctx.isInAttackStartup = true;
                    // Telegraph: flash white and slight rise
                    ctx.setTint(0xffffff);
                    ctx.setVelocityY(-50);
                },
                onUpdate: (ctx, _time, delta) => {
                    ctx.telegraphTimer += delta;

                    // Flash between white and normal during telegraph
                    const flash = Math.sin(ctx.telegraphTimer * 0.02) > 0;
                    ctx.setTint(flash ? 0xffffff : ctx.defaultTint);

                    // Desperate mode: faster telegraph
                    const telegraphDur = (ctx.desperateMode && ctx.health <= ctx.maxHealth * ctx.fleeThreshold)
                        ? ctx.TELEGRAPH_DURATION * 0.6
                        : ctx.TELEGRAPH_DURATION;

                    if (ctx.telegraphTimer >= telegraphDur) {
                        ctx.isInAttackStartup = false;
                        // Slam down
                        ctx.setVelocityY(400);
                        ctx.createShockwave();
                        ctx.fsm.transition('RECOVERY');
                    }
                },
            })
            .addState('RECOVERY', {
                onEnter: (ctx) => {
                    ctx.recoveryTimer = 0;
                    ctx.isInAttackStartup = false;
                    ctx.restoreTint();
                    // Very slow during recovery
                    ctx.setVelocityX(0);
                },
                onUpdate: (ctx, _time, delta) => {
                    ctx.recoveryTimer += delta;

                    // Desperate mode: shorter recovery
                    const recovDur = (ctx.desperateMode && ctx.health <= ctx.maxHealth * ctx.fleeThreshold)
                        ? ctx.RECOVERY_DURATION * 0.5
                        : ctx.RECOVERY_DURATION;

                    if (ctx.recoveryTimer >= recovDur) {
                        const dist = Phaser.Math.Distance.Between(
                            ctx.x, ctx.y, ctx.player.x, ctx.player.y,
                        );
                        ctx.fsm.transition(dist < ctx.DETECT_RANGE ? 'APPROACH' : 'PATROL');
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
                        const dist = Phaser.Math.Distance.Between(
                            ctx.x, ctx.y, ctx.player.x, ctx.player.y,
                        );
                        ctx.fsm.transition(dist < ctx.DETECT_RANGE ? 'APPROACH' : 'PATROL');
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

    private createShockwave(): void {
        const shockwave = this.scene.add.rectangle(
            this.x, this.y + (this.displayHeight / 2),
            this.SHOCKWAVE_WIDTH, this.SHOCKWAVE_HEIGHT,
            0xffaa00, 0.7,
        );
        this.scene.physics.add.existing(shockwave);
        this.shockwaveGroup.add(shockwave);

        const swBody = shockwave.body as Phaser.Physics.Arcade.Body;
        swBody.setAllowGravity(false);
        swBody.setImmovable(true);

        // Screen shake if camera exists
        if (this.scene.cameras && this.scene.cameras.main) {
            this.scene.cameras.main.shake(200, 0.01);
        }

        // Destroy after duration
        this.scene.time.delayedCall(this.SHOCKWAVE_DURATION, () => {
            if (shockwave.active) {
                shockwave.destroy();
            }
        });
    }

    private onShockwaveHitPlayer(hitPlayer: any): void {
        if (hitPlayer.isInvincible) return;

        hitPlayer.takeDamage(this.damage);

        EventBus.emit('health-change', {
            health: hitPlayer.health,
            maxHealth: hitPlayer.maxHealth,
        });

        // Knockback player
        const direction = hitPlayer.x > this.x ? 1 : -1;
        hitPlayer.setVelocityX(COMBAT.KNOCKBACK_PLAYER.x * direction);
        hitPlayer.setVelocityY(COMBAT.KNOCKBACK_PLAYER.y);
    }

    update(time: number, delta: number) {
        super.update(time, delta);
        if (this.isDead) return;
        this.fsm.update(time, delta);
    }

    protected die() {
        this.shockwaveCollider.destroy();
        this.shockwaveGroup.clear(true, true);
        super.die();
    }
}
