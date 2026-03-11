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

    constructor(scene: Phaser.Scene, x: number, y: number, player: Player) {
        super(scene, x, y, 'dude', player, 4, 1, 80);
        this.enemyType = 'floating_eye';
        this.tier = 'intermediate';
        this.setTint(0xffff00);
        this.setScale(0.65);
        this.startY = y;
        this.timeOffset = Math.random() * 1000;

        // Flying enemy - no gravity
        (this.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);

        // Beam group for overlap detection
        this.beamGroup = scene.physics.add.group({ allowGravity: false });

        this.beamCollider = scene.physics.add.overlap(
            player,
            this.beamGroup,
            () => this.onBeamHitPlayer(),
            undefined,
            this,
        );

        this.fsm = new EnemyStateMachine<FloatingEye>('HOVER', this);
        this.fsm
            .addState('HOVER', {
                onEnter: (ctx) => {
                    ctx.setTint(0xffff00);
                },
                onUpdate: (ctx, time, _delta) => {
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
                },
                onUpdate: (ctx, _time, delta) => {
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
                        ctx.fsm.transition('SWEEP');
                    }
                },
            })
            .addState('SWEEP', {
                onEnter: (ctx) => {
                    ctx.sweepTimer = 0;
                    ctx.setTint(0xff0000);

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
                    ctx.setTint(0xffff00);
                },
                onUpdate: (ctx, time, delta) => {
                    ctx.cooldownTimer += delta;

                    // Gentle hover during cooldown
                    const wave = Math.sin((time + ctx.timeOffset) * ctx.SINE_SPEED);
                    ctx.y = ctx.startY + wave * ctx.SINE_AMPLITUDE;

                    if (ctx.cooldownTimer >= ctx.COOLDOWN_DURATION) {
                        ctx.fsm.transition('HOVER');
                    }
                },
            });

        this.fsm.start();
    }

    private destroyBeam(): void {
        if (this.beam && this.beam.active) {
            this.beam.destroy();
        }
        this.beam = null;
    }

    private onBeamHitPlayer(): void {
        if ((this.player as any).isInvincible) return;

        (this.player as any).takeDamage(this.damage);

        EventBus.emit('health-change', {
            health: (this.player as any).health,
            maxHealth: (this.player as any).maxHealth,
        });

        // Knockback player away from the eye
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
        this.destroyBeam();
        this.beamCollider.destroy();
        this.beamGroup.clear(true, true);
        super.die();
    }
}
