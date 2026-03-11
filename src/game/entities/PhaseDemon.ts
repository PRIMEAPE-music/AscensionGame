import Phaser from 'phaser';
import { Enemy } from './Enemy';
import { Player } from './Player';
import { EnemyStateMachine } from '../systems/EnemyStateMachine';

export class PhaseDemon extends Enemy {
    private direction: number = 1;
    private corporealTimer: number = 0;
    private phaseShiftTimer: number = 0;
    private incorporealTimer: number = 0;
    private phaseBackTimer: number = 0;
    public isIncorporeal: boolean = false;
    private flickerTimer: number = 0;
    private fsm: EnemyStateMachine<PhaseDemon>;
    private defaultTint: number = 0xff00aa;

    private readonly CORPOREAL_DURATION = 2500;
    private readonly PHASE_SHIFT_DURATION = 500;
    private readonly INCORPOREAL_DURATION = 2500;
    private readonly INCORPOREAL_TINT = 0x5500aa;
    private readonly FLICKER_INTERVAL = 50;

    constructor(scene: Phaser.Scene, x: number, y: number, player: Player) {
        super(scene, x, y, 'dude', player, 8, 1, 180);
        this.enemyType = 'phase_demon';
        this.tier = 'advanced';
        this.setTint(this.defaultTint);
        this.setScale(0.85);

        this.fsm = new EnemyStateMachine<PhaseDemon>('CORPOREAL', this);
        this.fsm
            .addState('CORPOREAL', {
                onEnter: (ctx) => {
                    ctx.corporealTimer = 0;
                    ctx.isIncorporeal = false;
                    ctx.setAlpha(1);
                    ctx.setTint(ctx.defaultTint);
                    // Enable gravity and platform collision
                    const body = ctx.body as Phaser.Physics.Arcade.Body;
                    body.setAllowGravity(true);
                    body.checkCollision.down = true;
                    body.checkCollision.up = true;
                    body.checkCollision.left = true;
                    body.checkCollision.right = true;
                },
                onUpdate: (ctx, _time, delta) => {
                    // Chase player aggressively
                    const dx = ctx.player.x - ctx.x;
                    ctx.direction = dx > 0 ? 1 : -1;
                    ctx.setVelocityX(ctx.speed * ctx.direction);
                    ctx.setFlipX(ctx.direction < 0);
                    ctx.facingDirection = ctx.direction;

                    ctx.corporealTimer += delta;
                    if (ctx.corporealTimer >= ctx.CORPOREAL_DURATION) {
                        ctx.fsm.transition('PHASE_SHIFT');
                    }
                },
            })
            .addState('PHASE_SHIFT', {
                onEnter: (ctx) => {
                    ctx.phaseShiftTimer = 0;
                    ctx.flickerTimer = 0;
                    ctx.setVelocityX(0);
                },
                onUpdate: (ctx, _time, delta) => {
                    ctx.phaseShiftTimer += delta;
                    ctx.flickerTimer += delta;

                    // Rapid alpha flicker
                    if (ctx.flickerTimer >= ctx.FLICKER_INTERVAL) {
                        ctx.setAlpha(ctx.alpha < 0.5 ? 1 : 0.2);
                        ctx.flickerTimer = 0;
                    }

                    if (ctx.phaseShiftTimer >= ctx.PHASE_SHIFT_DURATION) {
                        ctx.fsm.transition('INCORPOREAL');
                    }
                },
            })
            .addState('INCORPOREAL', {
                onEnter: (ctx) => {
                    ctx.incorporealTimer = 0;
                    ctx.isIncorporeal = true;
                    ctx.setAlpha(0.3);
                    ctx.setTint(ctx.INCORPOREAL_TINT);
                    // Disable gravity and platform collision
                    const body = ctx.body as Phaser.Physics.Arcade.Body;
                    body.setAllowGravity(false);
                    body.checkCollision.down = false;
                    body.checkCollision.up = false;
                    body.checkCollision.left = false;
                    body.checkCollision.right = false;
                },
                onUpdate: (ctx, _time, delta) => {
                    // Float gently toward player
                    const dx = ctx.player.x - ctx.x;
                    const dy = ctx.player.y - ctx.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist > 0) {
                        const floatSpeed = ctx.speed * 0.6;
                        ctx.setVelocityX((dx / dist) * floatSpeed);
                        ctx.setVelocityY((dy / dist) * floatSpeed);
                    }

                    ctx.direction = dx > 0 ? 1 : -1;
                    ctx.setFlipX(ctx.direction < 0);
                    ctx.facingDirection = ctx.direction;

                    ctx.incorporealTimer += delta;
                    if (ctx.incorporealTimer >= ctx.INCORPOREAL_DURATION) {
                        ctx.fsm.transition('PHASE_SHIFT_BACK');
                    }
                },
            })
            .addState('PHASE_SHIFT_BACK', {
                onEnter: (ctx) => {
                    ctx.phaseBackTimer = 0;
                    ctx.flickerTimer = 0;
                    ctx.setVelocityX(0);
                    ctx.setVelocityY(0);
                },
                onUpdate: (ctx, _time, delta) => {
                    ctx.phaseBackTimer += delta;
                    ctx.flickerTimer += delta;

                    // Rapid alpha flicker
                    if (ctx.flickerTimer >= ctx.FLICKER_INTERVAL) {
                        ctx.setAlpha(ctx.alpha < 0.5 ? 1 : 0.2);
                        ctx.flickerTimer = 0;
                    }

                    if (ctx.phaseBackTimer >= ctx.PHASE_SHIFT_DURATION) {
                        ctx.fsm.transition('CORPOREAL');
                    }
                },
            });

        this.fsm.start();
    }

    public takeDamage(amount: number) {
        if (this.isIncorporeal) return; // Cannot take damage while incorporeal
        super.takeDamage(amount);
    }

    update(time: number, delta: number) {
        super.update(time, delta);
        if (this.isDead) return;
        this.fsm.update(time, delta);
    }
}
