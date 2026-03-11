import Phaser from 'phaser';
import { Enemy } from './Enemy';
import { Player } from './Player';
import { EnemyStateMachine } from '../systems/EnemyStateMachine';

export class CursedKnight extends Enemy {
    private direction: number = 1;
    private patrolTimer: number = 0;
    private recoveryTimer: number = 0;
    private attackTelegraphTimer: number = 0;
    private isTelegraphing: boolean = false;
    private fsm: EnemyStateMachine<CursedKnight>;
    private defaultTint: number = 0x4444aa;

    private readonly DETECT_RANGE = 400;
    private readonly ATTACK_RANGE = 80;
    private readonly PATROL_TURN_INTERVAL = 3000;
    private readonly TELEGRAPH_DURATION = 400;
    private readonly RECOVERY_DURATION = 600;

    constructor(scene: Phaser.Scene, x: number, y: number, player: Player) {
        super(scene, x, y, 'dude', player, 10, 2, 60);
        this.enemyType = 'cursed_knight';
        this.tier = 'intermediate';
        this.setTint(this.defaultTint);
        this.setScale(1.0);

        this.fsm = new EnemyStateMachine<CursedKnight>('PATROL', this);
        this.fsm
            .addState('PATROL', {
                onEnter: (ctx) => {
                    ctx.patrolTimer = 0;
                    ctx.isBlocking = false;
                },
                onUpdate: (ctx, _time, delta) => {
                    ctx.setVelocityX(ctx.speed * ctx.direction);
                    ctx.facingDirection = ctx.direction;
                    ctx.setFlipX(ctx.direction < 0);

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
                    ctx.isBlocking = false;
                },
                onUpdate: (ctx, _time, _delta) => {
                    const dx = ctx.player.x - ctx.x;
                    ctx.direction = dx > 0 ? 1 : -1;
                    ctx.facingDirection = ctx.direction;
                    ctx.setVelocityX(ctx.speed * ctx.direction);
                    ctx.setFlipX(ctx.direction < 0);

                    // Block when player is in front
                    const playerInFront =
                        (ctx.direction > 0 && ctx.player.x > ctx.x) ||
                        (ctx.direction < 0 && ctx.player.x < ctx.x);
                    ctx.isBlocking = playerInFront;

                    const dist = Phaser.Math.Distance.Between(
                        ctx.x, ctx.y, ctx.player.x, ctx.player.y,
                    );

                    if (dist < ctx.ATTACK_RANGE) {
                        ctx.fsm.transition('ATTACK');
                        return;
                    }

                    if (dist > ctx.DETECT_RANGE * 2) {
                        ctx.fsm.transition('PATROL');
                    }
                },
            })
            .addState('BLOCK', {
                onEnter: (ctx) => {
                    ctx.isBlocking = true;
                    ctx.setVelocityX(0);
                },
                onUpdate: (ctx, _time, _delta) => {
                    // Face the player
                    const dx = ctx.player.x - ctx.x;
                    ctx.facingDirection = dx > 0 ? 1 : -1;
                    ctx.setFlipX(ctx.facingDirection < 0);

                    const dist = Phaser.Math.Distance.Between(
                        ctx.x, ctx.y, ctx.player.x, ctx.player.y,
                    );

                    if (dist < ctx.ATTACK_RANGE) {
                        ctx.fsm.transition('ATTACK');
                    } else if (dist > ctx.DETECT_RANGE) {
                        ctx.fsm.transition('PATROL');
                    } else {
                        ctx.fsm.transition('APPROACH');
                    }
                },
            })
            .addState('ATTACK', {
                onEnter: (ctx) => {
                    ctx.isBlocking = false;
                    ctx.isTelegraphing = true;
                    ctx.attackTelegraphTimer = 0;
                    ctx.setVelocityX(0);
                    // Telegraph flash - shift to white for windup
                    ctx.setTint(0xffffff);
                },
                onUpdate: (ctx, _time, delta) => {
                    if (ctx.isTelegraphing) {
                        ctx.attackTelegraphTimer += delta;
                        if (ctx.attackTelegraphTimer >= ctx.TELEGRAPH_DURATION) {
                            ctx.isTelegraphing = false;
                            // Execute overhead strike - tint red during strike
                            ctx.setTint(0xff0000);

                            // Brief lunge forward for the strike
                            const dx = ctx.player.x - ctx.x;
                            const strikeDir = dx > 0 ? 1 : -1;
                            ctx.setVelocityX(ctx.speed * 3 * strikeDir);

                            // After a short window, go to recovery
                            ctx.scene.time.delayedCall(200, () => {
                                if (ctx.isDead) return;
                                ctx.setVelocityX(0);
                                ctx.setTint(ctx.defaultTint);
                                ctx.fsm.transition('RECOVERY');
                            });
                        }
                    }
                },
            })
            .addState('RECOVERY', {
                onEnter: (ctx) => {
                    ctx.recoveryTimer = 0;
                    ctx.isBlocking = false;
                    ctx.setVelocityX(0);
                },
                onUpdate: (ctx, _time, delta) => {
                    ctx.recoveryTimer += delta;
                    if (ctx.recoveryTimer >= ctx.RECOVERY_DURATION) {
                        const dist = Phaser.Math.Distance.Between(
                            ctx.x, ctx.y, ctx.player.x, ctx.player.y,
                        );
                        ctx.fsm.transition(dist < ctx.DETECT_RANGE ? 'APPROACH' : 'PATROL');
                    }
                },
            });

        this.fsm.start();
    }

    update(time: number, delta: number) {
        super.update(time, delta);
        if (this.isDead) return;
        this.fsm.update(time, delta);
    }
}
