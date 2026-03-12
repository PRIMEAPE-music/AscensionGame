import Phaser from 'phaser';
import { Enemy } from './Enemy';
import { Player } from './Player';
import { EnemyStateMachine } from '../systems/EnemyStateMachine';
import { COMBAT } from '../config/GameConfig';
import { EventBus } from '../systems/EventBus';

export class ChainDevil extends Enemy {
    private spawnX: number;
    private spawnY: number;
    private swingTimer: number = 0;
    private chargeTimer: number = 0;
    private recoveryTimer: number = 0;
    private whipGroup: Phaser.Physics.Arcade.Group;
    private whipCollider: Phaser.Physics.Arcade.Collider;
    private fsm: EnemyStateMachine<ChainDevil>;

    private readonly SWING_AMPLITUDE = 150;
    private readonly SWING_SPEED = 0.002;
    private readonly DETECT_RANGE_V = 350;
    private readonly DETECT_RANGE_H = 400;
    private readonly CHARGE_DURATION = 300;
    private readonly WHIP_LENGTH = 300;
    private readonly WHIP_THICKNESS = 8;
    private readonly WHIP_DURATION = 200;
    private readonly RECOVERY_DURATION = 1500;

    constructor(scene: Phaser.Scene, x: number, y: number, player: Player | Player[]) {
        super(scene, x, y, 'dude', player, 10, 2, 0);
        this.enemyType = 'chain_devil';
        this.tier = 'advanced';
        this.defaultTint = 0xcc4400;
        this.setTint(this.defaultTint);
        this.setScale(0.9);
        this.spawnX = x;
        this.spawnY = y;

        // Chain Devil config: desperate mode (attacks faster when low)
        this.desperateMode = true;
        this.fleeThreshold = 0.2;

        // No gravity - hangs from chain
        (this.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);

        // Whip group for overlap detection
        this.whipGroup = scene.physics.add.group({ allowGravity: false });

        const playerList = Array.isArray(player) ? player : [player];
        this.whipCollider = scene.physics.add.overlap(
            playerList,
            this.whipGroup,
            (p: any) => this.onWhipHitPlayer(p),
            undefined,
            this,
        );

        this.fsm = new EnemyStateMachine<ChainDevil>('SWING', this);
        this.fsm
            .addState('SWING', {
                onEnter: (ctx) => {
                    ctx.swingTimer = 0;
                    ctx.aiState = 'PATROL';
                    ctx.restoreTint();
                },
                onUpdate: (ctx, time, _delta) => {
                    // Pendulum motion on X axis
                    const wave = Math.sin((time) * ctx.SWING_SPEED);
                    ctx.x = ctx.spawnX + wave * ctx.SWING_AMPLITUDE;
                    ctx.y = ctx.spawnY;

                    // Face player
                    ctx.setFlipX(ctx.player.x < ctx.x);
                    ctx.facingDirection = ctx.player.x > ctx.x ? 1 : -1;

                    // Check if player is within attack range
                    const dx = Math.abs(ctx.player.x - ctx.x);
                    const dy = Math.abs(ctx.player.y - ctx.y);

                    if (dx < ctx.DETECT_RANGE_H && dy < ctx.DETECT_RANGE_V) {
                        ctx.fsm.transition('WHIP_CHARGE');
                    }
                },
            })
            .addState('WHIP_CHARGE', {
                onEnter: (ctx) => {
                    ctx.chargeTimer = 0;
                    ctx.aiState = 'ATTACK';
                    ctx.isInAttackStartup = true;
                    // Telegraph with tint flash
                    ctx.setTint(0xff8800);
                },
                onUpdate: (ctx, _time, delta) => {
                    ctx.chargeTimer += delta;

                    // Flash tint during charge
                    const flash = Math.sin(ctx.chargeTimer * 0.03) > 0;
                    ctx.setTint(flash ? 0xffaa00 : ctx.defaultTint);

                    // Desperate mode: faster charge
                    const chargeDur = (ctx.desperateMode && ctx.health <= ctx.maxHealth * ctx.fleeThreshold)
                        ? ctx.CHARGE_DURATION * 0.5
                        : ctx.CHARGE_DURATION;

                    if (ctx.chargeTimer >= chargeDur) {
                        ctx.isInAttackStartup = false;
                        ctx.fsm.transition('WHIP_ATTACK');
                    }
                },
            })
            .addState('WHIP_ATTACK', {
                onEnter: (ctx) => {
                    ctx.setTint(0xff6600);
                    ctx.aiState = 'ATTACK';
                    ctx.createWhip();

                    // Auto transition after whip duration
                    ctx.scene.time.delayedCall(ctx.WHIP_DURATION, () => {
                        if (!ctx.isDead && ctx.fsm.currentState === 'WHIP_ATTACK') {
                            ctx.fsm.transition('RECOVERY');
                        }
                    });
                },
            })
            .addState('RECOVERY', {
                onEnter: (ctx) => {
                    ctx.recoveryTimer = 0;
                    ctx.isInAttackStartup = false;
                    ctx.restoreTint();
                },
                onUpdate: (ctx, time, delta) => {
                    ctx.recoveryTimer += delta;

                    // Resume swinging during recovery
                    const wave = Math.sin((time) * ctx.SWING_SPEED);
                    ctx.x = ctx.spawnX + wave * ctx.SWING_AMPLITUDE;
                    ctx.y = ctx.spawnY;

                    ctx.setFlipX(ctx.player.x < ctx.x);
                    ctx.facingDirection = ctx.player.x > ctx.x ? 1 : -1;

                    // Desperate mode: shorter recovery
                    const recovDur = (ctx.desperateMode && ctx.health <= ctx.maxHealth * ctx.fleeThreshold)
                        ? ctx.RECOVERY_DURATION * 0.5
                        : ctx.RECOVERY_DURATION;

                    if (ctx.recoveryTimer >= recovDur) {
                        ctx.fsm.transition('SWING');
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
                        ctx.fsm.transition('SWING');
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

    private createWhip(): void {
        // Direction toward player
        const dx = this.player.x - this.x;
        const dirX = dx > 0 ? 1 : -1;

        const whipX = this.x + (this.WHIP_LENGTH / 2) * dirX;
        const whipY = this.y;

        const whip = this.scene.add.rectangle(
            whipX, whipY,
            this.WHIP_LENGTH, this.WHIP_THICKNESS,
            0xff4400, 0.8,
        );
        this.scene.physics.add.existing(whip);
        this.whipGroup.add(whip);

        const whipBody = whip.body as Phaser.Physics.Arcade.Body;
        whipBody.setAllowGravity(false);
        whipBody.setImmovable(true);

        // Destroy after duration
        this.scene.time.delayedCall(this.WHIP_DURATION, () => {
            if (whip.active) {
                whip.destroy();
            }
        });
    }

    private onWhipHitPlayer(hitPlayer: any): void {
        if (hitPlayer.isInvincible) return;

        hitPlayer.takeDamage(this.damage);

        EventBus.emit('health-change', {
            health: hitPlayer.health,
            maxHealth: hitPlayer.maxHealth,
        });

        // Knockback player away
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
        this.whipCollider.destroy();
        this.whipGroup.clear(true, true);
        super.die();
    }
}
