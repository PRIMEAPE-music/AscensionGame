import Phaser from 'phaser';
import { Enemy } from './Enemy';
import { Player } from './Player';
import { EnemyStateMachine } from '../systems/EnemyStateMachine';
import { COMBAT } from '../config/GameConfig';
import { EventBus } from '../systems/EventBus';

export class SoulReaper extends Enemy {
    private drainTimer: number = 0;
    private repositionTimer: number = 0;
    private drainDamageTimer: number = 0;
    private isDraining: boolean = false;
    private drainAura: Phaser.GameObjects.Rectangle | null = null;
    private drainGroup: Phaser.Physics.Arcade.Group;
    private drainCollider: Phaser.Physics.Arcade.Collider;
    private pulseTimer: number = 0;
    private fsm: EnemyStateMachine<SoulReaper>;
    private defaultTint: number = 0x220044;

    private readonly DETECT_RANGE = 150;
    private readonly DRAIN_DURATION = 5000;
    private readonly DRAIN_DAMAGE_INTERVAL = 2000;
    private readonly AURA_SIZE = 120;
    private readonly LERP_FACTOR = 0.02;
    private readonly REPOSITION_DURATION = 1500;
    private readonly REPOSITION_DISTANCE = 250;

    constructor(scene: Phaser.Scene, x: number, y: number, player: Player) {
        super(scene, x, y, 'dude', player, 20, 1, 100);
        this.enemyType = 'soul_reaper';
        this.tier = 'elite';
        this.setTint(this.defaultTint);
        this.setScale(1.0);

        // No gravity, can pass through platforms
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setAllowGravity(false);
        body.checkCollision.down = false;
        body.checkCollision.up = false;
        body.checkCollision.left = false;
        body.checkCollision.right = false;

        // Drain aura group for overlap detection
        this.drainGroup = scene.physics.add.group({ allowGravity: false });

        this.drainCollider = scene.physics.add.overlap(
            player,
            this.drainGroup,
            () => this.onDrainHitPlayer(),
            undefined,
            this,
        );

        this.fsm = new EnemyStateMachine<SoulReaper>('PURSUE', this);
        this.fsm
            .addState('PURSUE', {
                onEnter: (ctx) => {
                    ctx.isDraining = false;
                    ctx.destroyAura();
                },
                onUpdate: (ctx, _time, _delta) => {
                    // Glide smoothly toward player (lerp)
                    const dx = ctx.player.x - ctx.x;
                    const dy = ctx.player.y - ctx.y;
                    ctx.x += dx * ctx.LERP_FACTOR;
                    ctx.y += dy * ctx.LERP_FACTOR;

                    ctx.setFlipX(ctx.player.x < ctx.x);
                    ctx.facingDirection = ctx.player.x > ctx.x ? 1 : -1;

                    const dist = Phaser.Math.Distance.Between(
                        ctx.x, ctx.y, ctx.player.x, ctx.player.y,
                    );

                    if (dist < ctx.DETECT_RANGE) {
                        ctx.fsm.transition('DRAIN');
                    }
                },
            })
            .addState('DRAIN', {
                onEnter: (ctx) => {
                    ctx.drainTimer = 0;
                    ctx.drainDamageTimer = 0;
                    ctx.isDraining = true;
                    ctx.pulseTimer = 0;
                    ctx.createAura();
                },
                onUpdate: (ctx, _time, delta) => {
                    ctx.drainTimer += delta;
                    ctx.pulseTimer += delta;

                    // Pulse dark purple aura effect
                    if (ctx.drainAura && ctx.drainAura.active) {
                        const pulse = 0.3 + Math.sin(ctx.pulseTimer * 0.005) * 0.2;
                        ctx.drainAura.setAlpha(pulse);
                        ctx.drainAura.setPosition(ctx.x, ctx.y);
                    }

                    // Slowly track player while draining
                    const dx = ctx.player.x - ctx.x;
                    const dy = ctx.player.y - ctx.y;
                    ctx.x += dx * ctx.LERP_FACTOR * 0.5;
                    ctx.y += dy * ctx.LERP_FACTOR * 0.5;

                    ctx.setFlipX(ctx.player.x < ctx.x);
                    ctx.facingDirection = ctx.player.x > ctx.x ? 1 : -1;

                    if (ctx.drainTimer >= ctx.DRAIN_DURATION) {
                        ctx.fsm.transition('REPOSITION');
                    }
                },
            })
            .addState('REPOSITION', {
                onEnter: (ctx) => {
                    ctx.repositionTimer = 0;
                    ctx.isDraining = false;
                    ctx.destroyAura();

                    // Move to a new position offset from player
                    const angle = Math.random() * Math.PI * 2;
                    const targetX = ctx.player.x + Math.cos(angle) * ctx.REPOSITION_DISTANCE;
                    const targetY = ctx.player.y + Math.sin(angle) * ctx.REPOSITION_DISTANCE;

                    const dx = targetX - ctx.x;
                    const dy = targetY - ctx.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist > 0) {
                        const moveSpeed = ctx.speed * 1.5;
                        ctx.setVelocityX((dx / dist) * moveSpeed);
                        ctx.setVelocityY((dy / dist) * moveSpeed);
                    }
                },
                onUpdate: (ctx, _time, delta) => {
                    ctx.repositionTimer += delta;
                    if (ctx.repositionTimer >= ctx.REPOSITION_DURATION) {
                        ctx.setVelocity(0, 0);
                        ctx.fsm.transition('PURSUE');
                    }
                },
            });

        this.fsm.start();
    }

    private createAura(): void {
        this.drainAura = this.scene.add.rectangle(
            this.x, this.y,
            this.AURA_SIZE, this.AURA_SIZE,
            0x440088, 0.4,
        );
        this.scene.physics.add.existing(this.drainAura);
        this.drainGroup.add(this.drainAura);

        const auraBody = this.drainAura.body as Phaser.Physics.Arcade.Body;
        auraBody.setAllowGravity(false);
        auraBody.setImmovable(true);
    }

    private destroyAura(): void {
        if (this.drainAura && this.drainAura.active) {
            this.drainAura.destroy();
        }
        this.drainAura = null;
    }

    private onDrainHitPlayer(): void {
        if ((this.player as any).isInvincible) return;
        if (!this.isDraining) return;

        // Only deal damage every DRAIN_DAMAGE_INTERVAL
        this.drainDamageTimer += 16; // Approximate frame delta
        if (this.drainDamageTimer < this.DRAIN_DAMAGE_INTERVAL) return;
        this.drainDamageTimer = 0;

        (this.player as any).takeDamage(this.damage);

        EventBus.emit('health-change', {
            health: (this.player as any).health,
            maxHealth: (this.player as any).maxHealth,
        });

        // Light knockback
        const direction = this.player.x > this.x ? 1 : -1;
        this.player.setVelocityX(COMBAT.KNOCKBACK_PLAYER.x * 0.5 * direction);
        this.player.setVelocityY(COMBAT.KNOCKBACK_PLAYER.y * 0.5);
    }

    public takeDamage(amount: number) {
        if (this.isDead) return;
        // Take double damage while draining
        const finalAmount = this.isDraining ? amount * 2 : amount;
        super.takeDamage(finalAmount);
    }

    update(time: number, delta: number) {
        super.update(time, delta);
        if (this.isDead) return;
        this.fsm.update(time, delta);
    }

    protected die() {
        this.destroyAura();
        this.drainCollider.destroy();
        this.drainGroup.clear(true, true);
        super.die();
    }
}
