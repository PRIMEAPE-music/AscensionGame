import Phaser from 'phaser';
import { Enemy } from './Enemy';
import { Player } from './Player';
import { EnemyStateMachine } from '../systems/EnemyStateMachine';

export class TerrorMimic extends Enemy {
    private direction: number = 1;
    private disguiseTimer: number = 0;
    private revealTimer: number = 0;
    private chaseTimer: number = 0;
    private cooldownTimer: number = 0;
    private flickerTimer: number = 0;
    private startY: number;
    private bobTimer: number = 0;
    private fsm: EnemyStateMachine<TerrorMimic>;
    private defaultTint: number = 0xffdd00;

    private readonly DETECT_RANGE = 80;
    private readonly REVEAL_DURATION = 400;
    private readonly LUNGE_SPEED_X = 400;
    private readonly LUNGE_SPEED_Y = -250;
    private readonly CHASE_DURATION = 5000;
    private readonly COOLDOWN_DURATION = 2000;
    private readonly BOB_AMPLITUDE = 10;
    private readonly BOB_SPEED = 0.00628; // ~1000ms period
    private readonly FLICKER_INTERVAL = 3000;
    private readonly FLICKER_DURATION = 50;
    private readonly CHASE_RANGE = 500;

    constructor(scene: Phaser.Scene, x: number, y: number, player: Player) {
        super(scene, x, y, 'dude', player, 15, 2, 200);
        this.enemyType = 'terror_mimic';
        this.tier = 'elite';
        this.setTint(this.defaultTint);
        this.setScale(0.5); // Same as ItemDrop
        this.startY = y;

        // Set body smaller to match item size
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setSize(body.width * 0.6, body.height * 0.6);

        this.fsm = new EnemyStateMachine<TerrorMimic>('DISGUISE', this);
        this.fsm
            .addState('DISGUISE', {
                onEnter: (ctx) => {
                    ctx.disguiseTimer = 0;
                    ctx.flickerTimer = 0;
                    ctx.setScale(0.5);
                    ctx.setTint(ctx.defaultTint);
                    ctx.setVelocityX(0);
                    ctx.setVelocityY(0);
                },
                onUpdate: (ctx, time, delta) => {
                    // Bobbing animation like ItemDrop
                    ctx.bobTimer += delta;
                    const wave = Math.sin(ctx.bobTimer * ctx.BOB_SPEED);
                    ctx.y = ctx.startY + wave * ctx.BOB_AMPLITUDE;

                    // Subtle tell: flicker every 3s
                    ctx.disguiseTimer += delta;
                    ctx.flickerTimer += delta;

                    if (ctx.flickerTimer >= ctx.FLICKER_INTERVAL) {
                        ctx.setTint(0xffcc33); // Slightly different gold
                        ctx.scene.time.delayedCall(ctx.FLICKER_DURATION, () => {
                            if (ctx.active && !ctx.isDead && ctx.fsm.currentState === 'DISGUISE') {
                                ctx.setTint(ctx.defaultTint);
                            }
                        });
                        ctx.flickerTimer = 0;
                    }

                    // Check if player is nearby
                    const dist = Phaser.Math.Distance.Between(
                        ctx.x, ctx.y, ctx.player.x, ctx.player.y,
                    );
                    if (dist < ctx.DETECT_RANGE) {
                        ctx.fsm.transition('REVEAL');
                    }
                },
            })
            .addState('REVEAL', {
                onEnter: (ctx) => {
                    ctx.revealTimer = 0;
                    // Scale up and change tint
                    ctx.scene.tweens.add({
                        targets: ctx,
                        scaleX: 0.95,
                        scaleY: 0.95,
                        duration: ctx.REVEAL_DURATION * 0.8,
                        ease: 'Back.easeOut',
                    });
                    ctx.setTint(0xff2200); // Angry red

                    // Restore body size for combat
                    const body = ctx.body as Phaser.Physics.Arcade.Body;
                    body.setSize(body.sourceWidth, body.sourceHeight);
                },
                onUpdate: (ctx, _time, delta) => {
                    ctx.revealTimer += delta;
                    if (ctx.revealTimer >= ctx.REVEAL_DURATION) {
                        ctx.fsm.transition('ATTACK');
                    }
                },
            })
            .addState('ATTACK', {
                onEnter: (ctx) => {
                    // Lunge at player (similar to HellHound)
                    const dx = ctx.player.x - ctx.x;
                    const lungeDir = dx > 0 ? 1 : -1;
                    ctx.setVelocityX(ctx.LUNGE_SPEED_X * lungeDir);
                    ctx.setVelocityY(ctx.LUNGE_SPEED_Y);
                    ctx.setFlipX(lungeDir < 0);
                    ctx.facingDirection = lungeDir;
                    ctx.setTint(0xff2200);
                },
                onUpdate: (ctx, _time, _delta) => {
                    // Wait until landing
                    const body = ctx.body as Phaser.Physics.Arcade.Body;
                    if (body.blocked.down) {
                        ctx.fsm.transition('CHASE');
                    }
                },
            })
            .addState('CHASE', {
                onEnter: (ctx) => {
                    ctx.chaseTimer = 0;
                    ctx.setTint(0xff2200);
                },
                onUpdate: (ctx, _time, delta) => {
                    // Chase player aggressively
                    const dx = ctx.player.x - ctx.x;
                    ctx.direction = dx > 0 ? 1 : -1;
                    ctx.setVelocityX(ctx.speed * ctx.direction);
                    ctx.setFlipX(ctx.direction < 0);
                    ctx.facingDirection = ctx.direction;

                    ctx.chaseTimer += delta;
                    if (ctx.chaseTimer >= ctx.CHASE_DURATION) {
                        ctx.fsm.transition('COOLDOWN');
                    }
                },
            })
            .addState('COOLDOWN', {
                onEnter: (ctx) => {
                    ctx.cooldownTimer = 0;
                    ctx.setVelocityX(0);
                    ctx.setTint(0xcc2200);
                },
                onUpdate: (ctx, _time, delta) => {
                    ctx.cooldownTimer += delta;
                    if (ctx.cooldownTimer >= ctx.COOLDOWN_DURATION) {
                        // If player nearby, chase again. Otherwise wander.
                        const dist = Phaser.Math.Distance.Between(
                            ctx.x, ctx.y, ctx.player.x, ctx.player.y,
                        );
                        if (dist < ctx.CHASE_RANGE) {
                            ctx.fsm.transition('CHASE');
                        } else {
                            // Wander - just chase at reduced speed
                            ctx.fsm.transition('CHASE');
                        }
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
