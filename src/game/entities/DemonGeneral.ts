import Phaser from 'phaser';
import { Enemy } from './Enemy';
import { Player } from './Player';
import { EnemyStateMachine } from '../systems/EnemyStateMachine';
import { COMBAT } from '../config/GameConfig';
import { EventBus } from '../systems/EventBus';

export class DemonGeneral extends Enemy {
    private direction: number = 1;
    private comboCount: number = 0;
    private comboTimer: number = 0;
    private recoveryTimer: number = 0;
    private buffTimer: number = 0;
    private timeSinceLastBuff: number = 0;
    private buffedEnemies: { enemy: Enemy; originalSpeed: number }[] = [];
    private hitboxGroup: Phaser.Physics.Arcade.Group;
    private hitboxCollider: Phaser.Physics.Arcade.Collider;
    private fsm: EnemyStateMachine<DemonGeneral>;
    private defaultTint: number = 0xaa0000;

    private readonly COMMAND_MIN_DIST = 300;
    private readonly COMMAND_MAX_DIST = 400;
    private readonly ATTACK_RANGE = 100;
    private readonly COMBO_HITS = 3;
    private readonly COMBO_INTERVAL = 300;
    private readonly RECOVERY_DURATION = 800;
    private readonly BUFF_INTERVAL = 15000;
    private readonly BUFF_RANGE = 400;
    private readonly BUFF_DURATION = 5000;
    private readonly BUFF_SPEED_MULT = 1.5;
    private readonly HITBOX_WIDTH = 100;
    private readonly HITBOX_HEIGHT = 60;

    constructor(scene: Phaser.Scene, x: number, y: number, player: Player) {
        super(scene, x, y, 'dude', player, 30, 2, 100);
        this.enemyType = 'demon_general';
        this.tier = 'elite';
        this.setTint(this.defaultTint);
        this.setScale(1.1);

        // Hitbox group for combo attack overlap
        this.hitboxGroup = scene.physics.add.group({ allowGravity: false });

        this.hitboxCollider = scene.physics.add.overlap(
            player,
            this.hitboxGroup,
            () => this.onComboHitPlayer(),
            undefined,
            this,
        );

        this.fsm = new EnemyStateMachine<DemonGeneral>('COMMAND', this);
        this.fsm
            .addState('COMMAND', {
                onEnter: (ctx) => {
                    ctx.timeSinceLastBuff = 0;
                },
                onUpdate: (ctx, _time, delta) => {
                    const dx = ctx.player.x - ctx.x;
                    const dist = Math.abs(dx);
                    ctx.direction = dx > 0 ? 1 : -1;
                    ctx.setFlipX(ctx.direction < 0);
                    ctx.facingDirection = ctx.direction;

                    // Maintain distance from player
                    if (dist < ctx.COMMAND_MIN_DIST) {
                        // Too close, back away
                        ctx.setVelocityX(-ctx.direction * ctx.speed * 0.5);
                    } else if (dist > ctx.COMMAND_MAX_DIST) {
                        // Too far, move closer
                        ctx.setVelocityX(ctx.direction * ctx.speed * 0.5);
                    } else {
                        ctx.setVelocityX(0);
                    }

                    // Check buff timer
                    ctx.timeSinceLastBuff += delta;
                    if (ctx.timeSinceLastBuff >= ctx.BUFF_INTERVAL) {
                        ctx.performBuff();
                        ctx.timeSinceLastBuff = 0;
                    }

                    // Check if player health is low or few enemies alive
                    const playerHealth = (ctx.player as any).health ?? 99;
                    const shouldAdvance = playerHealth <= 2;

                    if (shouldAdvance) {
                        ctx.fsm.transition('APPROACH');
                        return;
                    }

                    // If player gets close, switch to approach
                    if (dist < ctx.ATTACK_RANGE * 1.5) {
                        ctx.fsm.transition('APPROACH');
                    }
                },
            })
            .addState('APPROACH', {
                onUpdate: (ctx, _time, delta) => {
                    const dx = ctx.player.x - ctx.x;
                    ctx.direction = dx > 0 ? 1 : -1;
                    ctx.setVelocityX(ctx.speed * ctx.direction);
                    ctx.setFlipX(ctx.direction < 0);
                    ctx.facingDirection = ctx.direction;

                    const dist = Phaser.Math.Distance.Between(
                        ctx.x, ctx.y, ctx.player.x, ctx.player.y,
                    );

                    // Check buff timer during approach too
                    ctx.timeSinceLastBuff += delta;
                    if (ctx.timeSinceLastBuff >= ctx.BUFF_INTERVAL) {
                        ctx.performBuff();
                        ctx.timeSinceLastBuff = 0;
                    }

                    if (dist < ctx.ATTACK_RANGE) {
                        ctx.fsm.transition('COMBO_ATTACK');
                        return;
                    }

                    if (dist > ctx.COMMAND_MAX_DIST * 2) {
                        ctx.fsm.transition('COMMAND');
                    }
                },
            })
            .addState('COMBO_ATTACK', {
                onEnter: (ctx) => {
                    ctx.comboCount = 0;
                    ctx.comboTimer = 0;
                    ctx.setVelocityX(0);
                    ctx.executeComboHit();
                },
                onUpdate: (ctx, _time, delta) => {
                    ctx.comboTimer += delta;

                    if (ctx.comboTimer >= ctx.COMBO_INTERVAL && ctx.comboCount < ctx.COMBO_HITS) {
                        ctx.executeComboHit();
                        ctx.comboTimer = 0;
                    }

                    if (ctx.comboCount >= ctx.COMBO_HITS) {
                        ctx.fsm.transition('RECOVERY');
                    }
                },
            })
            .addState('BUFF', {
                onEnter: (ctx) => {
                    ctx.buffTimer = 0;
                    // Visual: golden flash on self
                    ctx.setTint(0xffdd00);
                },
                onUpdate: (ctx, _time, delta) => {
                    ctx.buffTimer += delta;
                    if (ctx.buffTimer >= 500) {
                        ctx.setTint(ctx.defaultTint);
                        ctx.fsm.transition('COMMAND');
                    }
                },
            })
            .addState('RECOVERY', {
                onEnter: (ctx) => {
                    ctx.recoveryTimer = 0;
                    ctx.setVelocityX(0);
                    ctx.setTint(ctx.defaultTint);
                },
                onUpdate: (ctx, _time, delta) => {
                    ctx.recoveryTimer += delta;
                    if (ctx.recoveryTimer >= ctx.RECOVERY_DURATION) {
                        const dist = Phaser.Math.Distance.Between(
                            ctx.x, ctx.y, ctx.player.x, ctx.player.y,
                        );
                        ctx.fsm.transition(dist < ctx.ATTACK_RANGE * 2 ? 'APPROACH' : 'COMMAND');
                    }
                },
            });

        this.fsm.start();
    }

    private executeComboHit(): void {
        this.comboCount++;

        // Create hitbox rectangle in front of the general
        const hitboxX = this.x + this.facingDirection * (this.HITBOX_WIDTH / 2 + 20);
        const hitboxY = this.y;

        const hitbox = this.scene.add.rectangle(
            hitboxX, hitboxY,
            this.HITBOX_WIDTH, this.HITBOX_HEIGHT,
            0xff2200, 0.5,
        );
        this.scene.physics.add.existing(hitbox);
        this.hitboxGroup.add(hitbox);

        const hitBody = hitbox.body as Phaser.Physics.Arcade.Body;
        hitBody.setAllowGravity(false);
        hitBody.setImmovable(true);

        // Brief flash on self
        this.setTint(0xff4400);
        this.scene.time.delayedCall(100, () => {
            if (this.active && !this.isDead) {
                this.setTint(this.defaultTint);
            }
        });

        // Destroy hitbox after brief moment
        this.scene.time.delayedCall(150, () => {
            if (hitbox.active) {
                hitbox.destroy();
            }
        });
    }

    private performBuff(): void {
        // Find all active enemies within buff range
        const enemiesGroup = this.getEnemiesGroup();
        if (!enemiesGroup) return;

        const children = enemiesGroup.getChildren() as Enemy[];
        const buffTargets: { enemy: Enemy; originalSpeed: number }[] = [];

        for (const enemy of children) {
            if (enemy === this) continue;
            if (!enemy.active || enemy.health <= 0) continue;

            const dist = Phaser.Math.Distance.Between(
                this.x, this.y, enemy.x, enemy.y,
            );

            if (dist < this.BUFF_RANGE) {
                const originalSpeed = (enemy as any).speed as number;
                (enemy as any).speed = originalSpeed * this.BUFF_SPEED_MULT;

                // Visual: golden flash on buffed enemy
                const origTint = enemy.tintTopLeft;
                enemy.setTint(0xffdd00);
                this.scene.time.delayedCall(300, () => {
                    if (enemy.active) {
                        enemy.setTint(origTint);
                    }
                });

                buffTargets.push({ enemy, originalSpeed });
            }
        }

        // Restore speeds after buff duration
        if (buffTargets.length > 0) {
            this.scene.time.delayedCall(this.BUFF_DURATION, () => {
                for (const { enemy, originalSpeed } of buffTargets) {
                    if (enemy.active && enemy.health > 0) {
                        (enemy as any).speed = originalSpeed;
                    }
                }
            });
        }

        // Golden flash on self
        this.setTint(0xffdd00);
        this.scene.time.delayedCall(400, () => {
            if (this.active && !this.isDead) {
                this.setTint(this.defaultTint);
            }
        });
    }

    private getEnemiesGroup(): Phaser.Physics.Arcade.Group | null {
        const group = (this.scene as any).enemies;
        if (group instanceof Phaser.Physics.Arcade.Group) {
            return group;
        }
        return null;
    }

    private onComboHitPlayer(): void {
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
        this.hitboxCollider.destroy();
        this.hitboxGroup.clear(true, true);
        super.die();
    }
}
