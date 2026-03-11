import Phaser from 'phaser';
import { Enemy } from './Enemy';
import { Player } from './Player';
import { EnemyStateMachine } from '../systems/EnemyStateMachine';

export class VoidStalker extends Enemy {
    private direction: number = 1;
    private patrolTimer: number = 0;
    private stalkTimer: number = 0;
    private recoveryTimer: number = 0;
    private backstabTimer: number = 0;
    private fsm: EnemyStateMachine<VoidStalker>;

    private readonly DETECT_RANGE = 300;
    private readonly TELEPORT_INTERVAL = 8000;
    private readonly TELEPORT_DELAY = 300;
    private readonly BACKSTAB_DURATION = 300;
    private readonly RECOVERY_DURATION = 500;
    private readonly PATROL_TURN_INTERVAL = 2000;

    constructor(scene: Phaser.Scene, x: number, y: number, player: Player) {
        super(scene, x, y, 'dude', player, 6, 1, 150);
        this.enemyType = 'void_stalker';
        this.tier = 'intermediate';
        this.setTint(0x6600aa);

        this.fsm = new EnemyStateMachine<VoidStalker>('PATROL', this);
        this.fsm
            .addState('PATROL', {
                onEnter: (ctx) => {
                    ctx.patrolTimer = 0;
                    ctx.stalkTimer = 0;
                },
                onUpdate: (ctx, _time, delta) => {
                    ctx.setVelocityX(ctx.speed * 0.5 * ctx.direction);
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
                        ctx.fsm.transition('STALK');
                    }
                },
            })
            .addState('STALK', {
                onEnter: (ctx) => {
                    ctx.stalkTimer = 0;
                },
                onUpdate: (ctx, _time, delta) => {
                    const dx = ctx.player.x - ctx.x;
                    ctx.direction = dx > 0 ? 1 : -1;
                    ctx.setVelocityX(ctx.speed * ctx.direction);
                    ctx.setFlipX(ctx.direction < 0);

                    ctx.stalkTimer += delta;
                    if (ctx.stalkTimer >= ctx.TELEPORT_INTERVAL) {
                        ctx.fsm.transition('TELEPORT');
                        return;
                    }

                    const dist = Phaser.Math.Distance.Between(
                        ctx.x, ctx.y, ctx.player.x, ctx.player.y,
                    );
                    if (dist > ctx.DETECT_RANGE * 2) {
                        ctx.fsm.transition('PATROL');
                    }
                },
            })
            .addState('TELEPORT', {
                onEnter: (ctx) => {
                    // Disappear
                    ctx.setAlpha(0);
                    const body = ctx.body as Phaser.Physics.Arcade.Body;
                    body.enable = false;
                    ctx.setVelocity(0, 0);

                    // Determine destination behind player
                    const playerFacingRight = !ctx.player.flipX;
                    const behindX = playerFacingRight
                        ? ctx.player.x - 60
                        : ctx.player.x + 60;
                    const destY = ctx.player.y;

                    // Create brief shadow indicator at destination
                    const shadow = ctx.scene.add.rectangle(
                        behindX, destY, 20, 30, 0x6600aa, 0.4,
                    );
                    ctx.scene.time.delayedCall(ctx.TELEPORT_DELAY + 200, () => {
                        if (shadow.active) shadow.destroy();
                    });

                    // After delay, reappear behind player
                    ctx.scene.time.delayedCall(ctx.TELEPORT_DELAY, () => {
                        if (ctx.isDead) return;
                        ctx.setPosition(behindX, destY);
                        ctx.setAlpha(1);
                        body.enable = true;
                        ctx.direction = playerFacingRight ? -1 : 1;
                        ctx.setFlipX(ctx.direction < 0);
                        ctx.fsm.transition('BACKSTAB');
                    });
                },
            })
            .addState('BACKSTAB', {
                onEnter: (ctx) => {
                    ctx.backstabTimer = 0;
                    // Quick lunge toward player
                    const dx = ctx.player.x - ctx.x;
                    const lungeDir = dx > 0 ? 1 : -1;
                    ctx.setVelocityX(ctx.speed * 2.5 * lungeDir);
                },
                onUpdate: (ctx, _time, delta) => {
                    ctx.backstabTimer += delta;
                    if (ctx.backstabTimer >= ctx.BACKSTAB_DURATION) {
                        ctx.setVelocityX(0);
                        ctx.fsm.transition('RECOVERY');
                    }
                },
            })
            .addState('RECOVERY', {
                onEnter: (ctx) => {
                    ctx.recoveryTimer = 0;
                    ctx.setVelocityX(0);
                },
                onUpdate: (ctx, _time, delta) => {
                    ctx.recoveryTimer += delta;
                    if (ctx.recoveryTimer >= ctx.RECOVERY_DURATION) {
                        const dist = Phaser.Math.Distance.Between(
                            ctx.x, ctx.y, ctx.player.x, ctx.player.y,
                        );
                        ctx.fsm.transition(dist < ctx.DETECT_RANGE ? 'STALK' : 'PATROL');
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
