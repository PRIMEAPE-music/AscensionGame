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
    private defaultTint: number = 0x888888;

    private readonly PATROL_TURN_INTERVAL = 4000;
    private readonly DETECT_RANGE = 500;
    private readonly ATTACK_RANGE = 200;
    private readonly TELEGRAPH_DURATION = 600;
    private readonly RECOVERY_DURATION = 1200;
    private readonly SHOCKWAVE_WIDTH = 500;
    private readonly SHOCKWAVE_HEIGHT = 20;
    private readonly SHOCKWAVE_DURATION = 300;

    constructor(scene: Phaser.Scene, x: number, y: number, player: Player) {
        super(scene, x, y, 'dude', player, 25, 2, 40);
        this.enemyType = 'armor_colossus';
        this.tier = 'advanced';
        this.setTint(this.defaultTint);
        this.setScale(1.3);

        // Large physics body
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setSize(body.width * 1.3, body.height * 1.3);

        // Shockwave group for overlap detection
        this.shockwaveGroup = scene.physics.add.group({ allowGravity: false });

        this.shockwaveCollider = scene.physics.add.overlap(
            player,
            this.shockwaveGroup,
            () => this.onShockwaveHitPlayer(),
            undefined,
            this,
        );

        this.fsm = new EnemyStateMachine<ArmorColossus>('PATROL', this);
        this.fsm
            .addState('PATROL', {
                onEnter: (ctx) => {
                    ctx.patrolTimer = 0;
                    ctx.setTint(ctx.defaultTint);
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
                onUpdate: (ctx, _time, _delta) => {
                    const dx = ctx.player.x - ctx.x;
                    ctx.direction = dx > 0 ? 1 : -1;
                    ctx.setVelocityX(ctx.speed * ctx.direction);
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
                    // Telegraph: flash white and slight rise
                    ctx.setTint(0xffffff);
                    ctx.setVelocityY(-50);
                },
                onUpdate: (ctx, _time, delta) => {
                    ctx.telegraphTimer += delta;

                    // Flash between white and normal during telegraph
                    const flash = Math.sin(ctx.telegraphTimer * 0.02) > 0;
                    ctx.setTint(flash ? 0xffffff : ctx.defaultTint);

                    if (ctx.telegraphTimer >= ctx.TELEGRAPH_DURATION) {
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
                    ctx.setTint(ctx.defaultTint);
                    // Very slow during recovery
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

    private onShockwaveHitPlayer(): void {
        if ((this.player as any).isInvincible) return;

        (this.player as any).takeDamage(this.damage);

        EventBus.emit('health-change', {
            health: (this.player as any).health,
            maxHealth: (this.player as any).maxHealth,
        });

        // Knockback player
        const direction = this.player.x > this.x ? 1 : -1;
        this.player.setVelocityX(COMBAT.KNOCKBACK_PLAYER.x * direction);
        this.player.setVelocityY(COMBAT.KNOCKBACK_PLAYER.y);
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
