import Phaser from 'phaser';
import { Enemy } from './Enemy';
import { Player } from './Player';
import { EnemyStateMachine } from '../systems/EnemyStateMachine';
import { COMBAT } from '../config/GameConfig';
import { EventBus } from '../systems/EventBus';

export class FloatingEye extends Enemy {
    private startY: number;
    private timeOffset: number;
    private chargeTimer: number = 0;
    private sweepTimer: number = 0;
    private cooldownTimer: number = 0;
    private beam: Phaser.GameObjects.Rectangle | null = null;
    private beamGroup: Phaser.Physics.Arcade.Group;
    private beamCollider: Phaser.Physics.Arcade.Collider;
    private fsm: EnemyStateMachine<FloatingEye>;

    private readonly SINE_AMPLITUDE = 30;
    private readonly SINE_SPEED = 0.003;
    private readonly DETECT_RANGE = 500;
    private readonly CHARGE_DURATION = 1000;
    private readonly SWEEP_DURATION = 1000;
    private readonly COOLDOWN_DURATION = 3000;
    private readonly BEAM_LENGTH = 400;
    private readonly BEAM_THICKNESS = 4;

    constructor(scene: Phaser.Scene, x: number, y: number, player: Player | Player[]) {
        super(scene, x, y, 'dude', player, 4, 1, 80);
        this.enemyType = 'floating_eye';
        this.tier = 'intermediate';
        this.defaultTint = 0xffff00;
        this.setTint(0xffff00);
        this.setScale(0.65);
        this.startY = y;
        this.timeOffset = Math.random() * 1000;

        // Flee config: floats away when low
        this.desperateMode = false;
        this.fleeThreshold = 0.2;

        // Flying enemy - no gravity
        (this.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);

        // Beam group for overlap detection
        this.beamGroup = scene.physics.add.group({ allowGravity: false });

        const playerList = Array.isArray(player) ? player : [player];
        this.beamCollider = scene.physics.add.overlap(
            playerList,
            this.beamGroup,
            (p: any) => this.onBeamHitPlayer(p),
            undefined,
            this,
        );

        this.fsm = new EnemyStateMachine<FloatingEye>('HOVER', this);
        this.fsm
            .addState('HOVER', {
                onEnter: (ctx) => {
                    ctx.restoreTint();
                    ctx.aiState = 'PATROL';
                },
                onUpdate: (ctx, time, _delta) => {
                    // Check flee condition
                    if (!ctx.isElite && ctx.health <= ctx.maxHealth * ctx.fleeThreshold && ctx.health > 0) {
                        ctx.fsm.transition('FLEE');
                        return;
                    }

                    // Sine wave movement
                    const wave = Math.sin((time + ctx.timeOffset) * ctx.SINE_SPEED);
                    ctx.y = ctx.startY + wave * ctx.SINE_AMPLITUDE;

                    // Face player
                    ctx.setFlipX(ctx.player.x < ctx.x);

                    // Check for target
                    const dist = Phaser.Math.Distance.Between(
                        ctx.x, ctx.y, ctx.player.x, ctx.player.y,
                    );
                    if (dist < ctx.DETECT_RANGE) {
                        ctx.fsm.transition('CHARGE');
                    }
                },
            })
            .addState('CHARGE', {
                onEnter: (ctx) => {
                    ctx.chargeTimer = 0;
                    ctx.setVelocity(0, 0);
                    ctx.aiState = 'ATTACK';
                    ctx.isInAttackStartup = true;
                },
                onUpdate: (ctx, _time, delta) => {
                    // Check flee condition
                    if (!ctx.isElite && ctx.health <= ctx.maxHealth * ctx.fleeThreshold && ctx.health > 0) {
                        ctx.isInAttackStartup = false;
                        ctx.fsm.transition('FLEE');
                        return;
                    }

                    ctx.chargeTimer += delta;

                    // Visual: tint shift from yellow to red during charge
                    const progress = Math.min(ctx.chargeTimer / ctx.CHARGE_DURATION, 1);
                    const r = Math.floor(0xff);
                    const g = Math.floor(0xff * (1 - progress));
                    const b = 0;
                    ctx.setTint((r << 16) | (g << 8) | b);

                    // Face player during charge
                    ctx.setFlipX(ctx.player.x < ctx.x);

                    if (ctx.chargeTimer >= ctx.CHARGE_DURATION) {
                        ctx.isInAttackStartup = false;
                        ctx.fsm.transition('SWEEP');
                    }
                },
            })
            .addState('SWEEP', {
                onEnter: (ctx) => {
                    ctx.sweepTimer = 0;
                    ctx.setTint(0xff0000);
                    ctx.aiState = 'ATTACK';

                    // Create beam rectangle
                    const dirX = ctx.player.x > ctx.x ? 1 : -1;
                    const beamX = ctx.x + (ctx.BEAM_LENGTH / 2) * dirX;
                    const beamY = ctx.y;

                    ctx.beam = ctx.scene.add.rectangle(
                        beamX, beamY,
                        ctx.BEAM_LENGTH, ctx.BEAM_THICKNESS,
                        0xff0000, 0.8,
                    );
                    ctx.scene.physics.add.existing(ctx.beam);
                    ctx.beamGroup.add(ctx.beam);

                    const beamBody = ctx.beam.body as Phaser.Physics.Arcade.Body;
                    beamBody.setAllowGravity(false);
                    beamBody.setImmovable(true);
                },
                onUpdate: (ctx, _time, delta) => {
                    ctx.sweepTimer += delta;

                    // Sweep the beam by adjusting its vertical position (sweeping up/down)
                    if (ctx.beam && ctx.beam.active) {
                        const sweepProgress = ctx.sweepTimer / ctx.SWEEP_DURATION;
                        const sweepAngle = (sweepProgress - 0.5) * 60; // sweep from -30 to +30 degrees
                        const radians = Phaser.Math.DegToRad(sweepAngle);

                        const dirX = ctx.flipX ? -1 : 1;
                        ctx.beam.x = ctx.x + (ctx.BEAM_LENGTH / 2) * dirX * Math.cos(radians);
                        ctx.beam.y = ctx.y + (ctx.BEAM_LENGTH / 2) * Math.sin(radians);
                    }

                    if (ctx.sweepTimer >= ctx.SWEEP_DURATION) {
                        ctx.destroyBeam();
                        ctx.fsm.transition('COOLDOWN');
                    }
                },
                onExit: (ctx) => {
                    ctx.destroyBeam();
                },
            })
            .addState('COOLDOWN', {
                onEnter: (ctx) => {
                    ctx.cooldownTimer = 0;
                    ctx.restoreTint();
                    ctx.aiState = 'PATROL';
                },
                onUpdate: (ctx, time, delta) => {
                    // Check flee condition
                    if (!ctx.isElite && ctx.health <= ctx.maxHealth * ctx.fleeThreshold && ctx.health > 0) {
                        ctx.fsm.transition('FLEE');
                        return;
                    }

                    ctx.cooldownTimer += delta;

                    // Gentle hover during cooldown
                    const wave = Math.sin((time + ctx.timeOffset) * ctx.SINE_SPEED);
                    ctx.y = ctx.startY + wave * ctx.SINE_AMPLITUDE;

                    if (ctx.cooldownTimer >= ctx.COOLDOWN_DURATION) {
                        ctx.fsm.transition('HOVER');
                    }
                },
            })
            .addState('FLEE', {
                onEnter: (ctx) => {
                    ctx.aiState = 'FLEE';
                    ctx.startFleeBlink();
                    ctx.destroyBeam();
                    ctx.isInAttackStartup = false;
                },
                onUpdate: (ctx, _time, _delta) => {
                    // Float away from player
                    const dx = ctx.player.x - ctx.x;
                    const dy = ctx.player.y - ctx.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist > 0) {
                        // Move AWAY from player
                        ctx.setVelocityX((-dx / dist) * ctx.speed * 1.5);
                        ctx.setVelocityY((-dy / dist) * ctx.speed * 1.5 - ctx.speed * 0.5); // Bias upward
                    }
                    ctx.setFlipX(ctx.player.x < ctx.x);
                },
                onExit: (ctx) => {
                    ctx.stopFleeBlink();
                },
            })
            .addState('STUN', {
                onEnter: (ctx) => {
                    ctx.isInAttackStartup = false;
                    ctx.setVelocity(0, 0);
                    ctx.setTint(0xffff00);
                    ctx.aiState = 'STUN';
                    ctx.destroyBeam();
                },
                onUpdate: (ctx, _time, delta) => {
                    ctx.stunTimer -= delta;
                    if (ctx.stunTimer <= 0) {
                        ctx.restoreTint();
                        ctx.fsm.transition('HOVER');
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

    private destroyBeam(): void {
        if (this.beam && this.beam.active) {
            this.beam.destroy();
        }
        this.beam = null;
    }

    private onBeamHitPlayer(hitPlayer: any): void {
        if (hitPlayer.isInvincible) return;

        hitPlayer.takeDamage(this.damage);

        EventBus.emit('health-change', {
            health: hitPlayer.health,
            maxHealth: hitPlayer.maxHealth,
        });

        // Knockback player away from the eye
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
        this.destroyBeam();
        this.beamCollider.destroy();
        this.beamGroup.clear(true, true);
        super.die();
    }
}
