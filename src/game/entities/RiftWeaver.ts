import Phaser from 'phaser';
import { Enemy } from './Enemy';
import { Player } from './Player';
import { EnemyStateMachine } from '../systems/EnemyStateMachine';
import { COMBAT } from '../config/GameConfig';
import { EventBus } from '../systems/EventBus';

export class RiftWeaver extends Enemy {
    private startY: number;
    private timeOffset: number;
    private floatTimer: number = 0;
    private cooldownTimer: number = 0;
    private activePortals: Phaser.GameObjects.Rectangle[] = [];
    private portalGroup: Phaser.Physics.Arcade.Group;
    private portalCollider: Phaser.Physics.Arcade.Collider;
    private fsm: EnemyStateMachine<RiftWeaver>;

    private readonly SINE_AMPLITUDE = 20;
    private readonly SINE_SPEED = 0.003;
    private readonly TELEPORT_INTERVAL = 6000;
    private readonly COOLDOWN_DURATION = 4000;
    private readonly PORTAL_SIZE = 60;
    private readonly PORTAL_LIFETIME = 3000;
    private readonly TELEPORT_MIN_DIST = 200;
    private readonly TELEPORT_MAX_DIST = 350;

    constructor(scene: Phaser.Scene, x: number, y: number, player: Player) {
        super(scene, x, y, 'dude', player, 12, 1, 120);
        this.enemyType = 'rift_weaver';
        this.tier = 'advanced';
        this.setTint(0x00cccc);
        this.setScale(0.8);
        this.startY = y;
        this.timeOffset = Math.random() * 1000;

        // Flying enemy - no gravity
        (this.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);

        // Portal group for overlap detection
        this.portalGroup = scene.physics.add.group({ allowGravity: false });

        this.portalCollider = scene.physics.add.overlap(
            player,
            this.portalGroup,
            () => this.onPortalHitPlayer(),
            undefined,
            this,
        );

        this.fsm = new EnemyStateMachine<RiftWeaver>('FLOAT', this);
        this.fsm
            .addState('FLOAT', {
                onEnter: (ctx) => {
                    ctx.floatTimer = 0;
                },
                onUpdate: (ctx, time, delta) => {
                    // Sine wave hover
                    const wave = Math.sin((time + ctx.timeOffset) * ctx.SINE_SPEED);
                    ctx.y = ctx.startY + wave * ctx.SINE_AMPLITUDE;

                    // Face player
                    ctx.setFlipX(ctx.player.x < ctx.x);
                    ctx.facingDirection = ctx.player.x > ctx.x ? 1 : -1;

                    ctx.floatTimer += delta;
                    if (ctx.floatTimer >= ctx.TELEPORT_INTERVAL) {
                        ctx.fsm.transition('TELEPORT');
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

                    // Calculate random position near player
                    const angle = Math.random() * Math.PI * 2;
                    const dist = ctx.TELEPORT_MIN_DIST + Math.random() * (ctx.TELEPORT_MAX_DIST - ctx.TELEPORT_MIN_DIST);
                    const destX = ctx.player.x + Math.cos(angle) * dist;
                    const destY = ctx.player.y + Math.sin(angle) * dist;

                    // Brief flash at old position
                    const flash = ctx.scene.add.rectangle(ctx.x, ctx.y, 30, 30, 0x00ffff, 0.8);
                    ctx.scene.time.delayedCall(200, () => {
                        if (flash.active) flash.destroy();
                    });

                    // Reappear after brief delay
                    ctx.scene.time.delayedCall(300, () => {
                        if (ctx.isDead) return;
                        ctx.setPosition(destX, destY);
                        ctx.startY = destY;
                        ctx.setAlpha(1);
                        body.enable = true;

                        // Flash at new position
                        const arrivalFlash = ctx.scene.add.rectangle(destX, destY, 40, 40, 0x00ffff, 0.6);
                        ctx.scene.time.delayedCall(200, () => {
                            if (arrivalFlash.active) arrivalFlash.destroy();
                        });

                        ctx.fsm.transition('CREATE_PORTAL');
                    });
                },
            })
            .addState('CREATE_PORTAL', {
                onEnter: (ctx) => {
                    ctx.createPortal();
                    ctx.fsm.transition('COOLDOWN');
                },
            })
            .addState('COOLDOWN', {
                onEnter: (ctx) => {
                    ctx.cooldownTimer = 0;
                },
                onUpdate: (ctx, time, delta) => {
                    // Gentle hover during cooldown
                    const wave = Math.sin((time + ctx.timeOffset) * ctx.SINE_SPEED);
                    ctx.y = ctx.startY + wave * ctx.SINE_AMPLITUDE;

                    // Face player
                    ctx.setFlipX(ctx.player.x < ctx.x);
                    ctx.facingDirection = ctx.player.x > ctx.x ? 1 : -1;

                    ctx.cooldownTimer += delta;
                    if (ctx.cooldownTimer >= ctx.COOLDOWN_DURATION) {
                        ctx.fsm.transition('FLOAT');
                    }
                },
            });

        this.fsm.start();
    }

    private createPortal(): void {
        const portal = this.scene.add.rectangle(
            this.x, this.y,
            this.PORTAL_SIZE, this.PORTAL_SIZE,
            0x00ffff, 0.6,
        );
        this.scene.physics.add.existing(portal);
        this.portalGroup.add(portal);

        const portalBody = portal.body as Phaser.Physics.Arcade.Body;
        portalBody.setAllowGravity(false);
        portalBody.setImmovable(true);

        this.activePortals.push(portal);

        // Fade out and destroy after lifetime
        this.scene.time.delayedCall(this.PORTAL_LIFETIME, () => {
            if (portal.active) {
                this.scene.tweens.add({
                    targets: portal,
                    alpha: 0,
                    duration: 300,
                    onComplete: () => {
                        portal.destroy();
                        this.activePortals = this.activePortals.filter((p) => p !== portal);
                    },
                });
            }
        });
    }

    private onPortalHitPlayer(): void {
        if ((this.player as any).isInvincible) return;

        (this.player as any).takeDamage(this.damage);

        EventBus.emit('health-change', {
            health: (this.player as any).health,
            maxHealth: (this.player as any).maxHealth,
        });

        // Knockback player away from rift weaver
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
        // Clean up all active portals
        for (const portal of this.activePortals) {
            if (portal.active) {
                portal.destroy();
            }
        }
        this.activePortals = [];
        this.portalCollider.destroy();
        this.portalGroup.clear(true, true);
        super.die();
    }
}
