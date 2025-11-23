import Phaser from 'phaser';
import { ClassType, type ClassStats, CLASSES } from '../config/ClassConfig';
import type { ItemData, StatType } from '../config/ItemConfig';
import { AttackType, AttackDirection, type AttackDefinition, COMBAT_CONFIG } from '../systems/CombatTypes';

export class Player extends Phaser.Physics.Arcade.Sprite {
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    // private jumpKey!: Phaser.Input.Keyboard.Key;

    // Combat Keys
    private attackBKey!: Phaser.Input.Keyboard.Key; // Z - Light
    private attackXKey!: Phaser.Input.Keyboard.Key; // X - Heavy
    private attackYKey!: Phaser.Input.Keyboard.Key; // C - Special

    // Constants (Base values)
    private readonly BASE_MOVE_SPEED = 200;
    private readonly BASE_JUMP_FORCE = -500;
    // private readonly BASE_ATTACK_COOLDOWN = 500; // Unused
    private readonly WALL_SLIDE_SPEED = 100;
    private readonly WALL_JUMP_FORCE = { x: 300, y: -500 };
    private readonly COYOTE_TIME = 100; // ms
    private readonly JUMP_BUFFER_TIME = 150; // ms
    private readonly DRAG = 1200; // Ground friction
    private readonly AIR_DRAG = 200; // Air resistance
    private readonly ACCELERATION = 1000;
    private readonly JUMP_HOLD_FORCE = -10;
    private readonly JUMP_HOLD_DURATION = 250;
    private readonly COMBO_WINDOW = 500; // ms to input next attack

    // Combat State
    public isAttacking: boolean = false;
    private currentAttackId: string | null = null;
    private comboTimer: number = 0;
    // private lastAttackTime: number = 0; // Unused
    private attackState: 'IDLE' | 'STARTUP' | 'ACTIVE' | 'RECOVERY' = 'IDLE';
    private attackTimer: number = 0;

    private isWallSliding: boolean = false;
    public attackHitbox: Phaser.GameObjects.Rectangle | null = null;
    public hitEnemies: Set<any> = new Set();
    private isJumping: boolean = false;
    private jumpTimer: number = 0;
    private coyoteTimer: number = 0;
    private jumpBufferTimer: number = 0;

    // Double Jump State
    private canDoubleJump: boolean = false;
    private hasDoubleJumped: boolean = false;

    // Stats & Inventory
    public health: number;
    public maxHealth: number;
    public classType: ClassType;
    public classStats: ClassStats;
    public inventory: ItemData[] = [];
    public abilities: Set<string> = new Set();
    public statModifiers: Map<StatType, number> = new Map(); // Additive multipliers (0.1 = +10%)

    constructor(scene: Phaser.Scene, x: number, y: number, classType: ClassType = ClassType.MONK) {
        super(scene, x, y, 'dude');

        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.classType = classType;
        this.classStats = CLASSES[classType];
        this.maxHealth = this.classStats.health; // Initial max health
        this.health = this.maxHealth;
        this.setTint(this.classStats.color);

        this.setCollideWorldBounds(false); // Allow going up infinitely
        this.setGravityY(1000);
        this.setBounce(0);

        this.initInput();
    }

    private initInput() {
        this.cursors = this.scene.input.keyboard!.createCursorKeys();
        // this.jumpKey = this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        // Map keys: Z=Light(B), X=Heavy(X), C=Special(Y)
        this.attackBKey = this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
        this.attackXKey = this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.X);
        this.attackYKey = this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.C);
    }

    private getStat(stat: StatType, baseValue: number, classMultiplier: number): number {
        const modifier = this.statModifiers.get(stat) || 0;
        return baseValue * classMultiplier * (1 + modifier);
    }

    update(time: number, delta: number) {
        this.handleMovement();
        this.handleJumping(time, delta);
        this.handleWallInteraction();
        this.handleCombat(delta);
        this.updateTimers(delta);
    }

    private updateTimers(delta: number) {
        // Coyote time: if on ground, reset timer. If in air, decrease.
        if (this.body!.touching.down) {
            this.coyoteTimer = this.COYOTE_TIME;
        } else {
            this.coyoteTimer -= delta;
        }

        // Jump buffer: if jump pressed, set timer. Decrease otherwise.
        if (Phaser.Input.Keyboard.JustDown(this.cursors.space!)) {
            this.jumpBufferTimer = this.JUMP_BUFFER_TIME;
        } else {
            this.jumpBufferTimer -= delta;
        }

        // Combo timer decay
        if (this.comboTimer > 0) {
            this.comboTimer -= delta;
            if (this.comboTimer <= 0) {
                // Combo dropped
                this.currentAttackId = null;
            }
        }
    }

    private handleMovement() {
        // Disable movement during attack startup/active frames if grounded (optional design choice)
        if (this.isAttacking && this.body!.touching.down && this.attackState !== 'RECOVERY') {
            this.setAccelerationX(0);
            this.setVelocityX(0);
            return;
        }

        const { left, right } = this.cursors;
        const onGround = this.body!.touching.down;

        // Apply drag based on state
        if (onGround) {
            this.setDragX(this.DRAG);
        } else {
            this.setDragX(this.AIR_DRAG);
        }

        const moveSpeed = this.getStat('moveSpeed', this.BASE_MOVE_SPEED, this.classStats.moveSpeed);

        if (left.isDown) {
            this.setAccelerationX(-this.ACCELERATION);
            this.setFlipX(true);
        } else if (right.isDown) {
            this.setAccelerationX(this.ACCELERATION);
            this.setFlipX(false);
        } else {
            this.setAccelerationX(0);
        }

        // Cap horizontal speed
        if (this.body!.velocity.x > moveSpeed) {
            this.setVelocityX(moveSpeed);
        } else if (this.body!.velocity.x < -moveSpeed) {
            this.setVelocityX(-moveSpeed);
        }
    }

    private handleJumping(_time: number, delta: number) {
        const canJump = this.coyoteTimer > 0;
        const wantsToJump = this.jumpBufferTimer > 0;
        const jumpForce = this.getStat('jumpHeight', this.BASE_JUMP_FORCE, this.classStats.jumpHeight);

        // Reset Double Jump when on ground
        if (this.body!.touching.down) {
            this.canDoubleJump = true;
            this.hasDoubleJumped = false;
        }

        // DEBUG: Direct Jump
        if (this.cursors.space?.isDown && this.body!.touching.down) {
            console.log('DEBUG DIRECT JUMP');
            this.setVelocityY(jumpForce);
            this.isJumping = true;
        }

        // Initial Jump
        if (wantsToJump && canJump) {
            console.log('Jumping! Force:', jumpForce);
            this.setVelocityY(jumpForce);
            this.isJumping = true;
            this.jumpTimer = 0;
            this.coyoteTimer = 0; // Consume coyote time
            this.jumpBufferTimer = 0; // Consume buffer
        } else if (Phaser.Input.Keyboard.JustDown(this.cursors.space!)) {
            console.log('Jump pressed but failed. Wants:', wantsToJump, 'Can:', canJump, 'Coyote:', this.coyoteTimer, 'Buffer:', this.jumpBufferTimer, 'OnGround:', this.body!.touching.down);
        }
        // Double Jump
        else if (Phaser.Input.Keyboard.JustDown(this.cursors.space!) && !canJump && this.canDoubleJump && !this.hasDoubleJumped && this.abilities.has('double_jump')) {
            this.setVelocityY(jumpForce * 0.8); // Slightly weaker double jump
            this.hasDoubleJumped = true;
            this.isJumping = true;
            this.jumpTimer = 0;

            // Visual cue for double jump
            const particle = this.scene.add.circle(this.x, this.y + 20, 10, 0xffd700, 0.8);
            this.scene.tweens.add({
                targets: particle,
                scale: 2,
                alpha: 0,
                duration: 300,
                onComplete: () => particle.destroy()
            });
        }

        // Variable Jump Height (holding button)
        if (this.isJumping && this.cursors.space?.isDown) {
            this.jumpTimer += delta;
            if (this.jumpTimer < this.JUMP_HOLD_DURATION) {
                this.setVelocityY(this.body!.velocity.y + this.JUMP_HOLD_FORCE);
            }
        }

        // Reset jumping state if key released or timer expired
        if (!this.cursors.space?.isDown || this.jumpTimer >= this.JUMP_HOLD_DURATION) {
            this.isJumping = false;
        }
    }

    private handleWallInteraction() {
        const onWall = this.body!.blocked.left || this.body!.blocked.right;
        const onGround = this.body!.touching.down;

        if (onWall && !onGround) {
            this.isWallSliding = true;

            // Wall Slide
            if (this.body!.velocity.y > 0) {
                this.setVelocityY(this.WALL_SLIDE_SPEED);
            }

            // Wall Jump
            if (Phaser.Input.Keyboard.JustDown(this.cursors.space!)) {
                const jumpDir = this.body!.blocked.left ? 1 : -1;
                const jumpForceY = this.getStat('jumpHeight', this.WALL_JUMP_FORCE.y, this.classStats.jumpHeight);

                this.setVelocityX(this.WALL_JUMP_FORCE.x * jumpDir);
                this.setVelocityY(jumpForceY);

                // Reset states
                this.isWallSliding = false;
                this.isJumping = true;
                this.jumpTimer = 0;
                this.hasDoubleJumped = false; // Allow double jump after wall jump
                this.canDoubleJump = true;
            }
        } else {
            this.isWallSliding = false;
        }
    }

    private handleCombat(delta: number) {
        // Handle Attack State Machine
        if (this.isAttacking) {
            this.attackTimer += delta;

            // Failsafe: If stuck in attack for too long (e.g. error occurred), reset
            if (this.attackTimer > 2000) {
                console.warn('[Player] Attack stuck, forcing reset');
                this.endAttack();
                return;
            }

            const attackDef = COMBAT_CONFIG[this.classType].attacks[this.currentAttackId!];

            if (!attackDef) {
                // Fallback if ID invalid
                this.isAttacking = false;
                return;
            }

            if (this.attackState === 'STARTUP') {
                if (this.attackTimer >= attackDef.startup) {
                    this.enterActiveState(attackDef);
                }
            } else if (this.attackState === 'ACTIVE') {
                // Update hitbox position to follow player
                if (this.attackHitbox) {
                    const facingRight = !this.flipX;
                    const offsetX = facingRight ? attackDef.hitbox.offsetX : -attackDef.hitbox.offsetX;
                    this.attackHitbox.setPosition(this.x + offsetX, this.y + attackDef.hitbox.offsetY);
                }

                if (this.attackTimer >= attackDef.startup + attackDef.hitbox.duration) {
                    this.enterRecoveryState(attackDef);
                }
            } else if (this.attackState === 'RECOVERY') {
                if (this.attackTimer >= attackDef.startup + attackDef.hitbox.duration + attackDef.recovery) {
                    this.endAttack();
                }
            }

            // Allow early combo input during recovery? (Buffer system - simplified for now)
            // For now, only allow input after full recovery or late recovery
        }

        // Input Handling
        // Only allow new attack if not attacking OR if in recovery (combo window)
        // Note: Real games allow buffering, here we'll keep it simple: can attack if IDLE or if we hit a combo window

        const canAttack = !this.isAttacking || (this.attackState === 'RECOVERY'); // Simple chain logic

        if (canAttack && !this.isWallSliding) {
            if (Phaser.Input.Keyboard.JustDown(this.attackBKey)) {
                this.tryAttack(AttackType.LIGHT);
            } else if (Phaser.Input.Keyboard.JustDown(this.attackXKey)) {
                this.tryAttack(AttackType.HEAVY);
            } else if (Phaser.Input.Keyboard.JustDown(this.attackYKey)) {
                this.tryAttack(AttackType.SPECIAL);
            }
        }
    }

    private tryAttack(type: AttackType) {
        // Determine Direction
        let direction: AttackDirection = AttackDirection.NEUTRAL;
        if (this.cursors.up.isDown) direction = AttackDirection.UP;
        else if (this.cursors.down.isDown) direction = AttackDirection.DOWN;

        const config = COMBAT_CONFIG[this.classType];
        const onGround = this.body!.touching.down;

        let nextAttackId: string | undefined;

        // Check for Combo
        if (this.currentAttackId && this.comboTimer > 0) {
            const comboNode = config.combos[this.currentAttackId];
            if (comboNode && comboNode.next[type]) {
                nextAttackId = comboNode.next[type];
            }
        }

        // If no combo found, start new chain
        if (!nextAttackId) {
            const map = onGround ? config.groundAttacks : config.airAttacks;
            nextAttackId = map[type][direction];
        }

        if (nextAttackId) {
            this.startAttack(nextAttackId);
        }
    }

    private startAttack(attackId: string) {
        this.isAttacking = true;
        this.currentAttackId = attackId;
        this.attackState = 'STARTUP';
        this.attackTimer = 0;
        this.hitEnemies.clear();

        // Reset velocity if ground attack (stop moving)
        if (this.body!.touching.down) {
            this.setVelocityX(0);
        }

        // Visual Debug: Tint
        const def = COMBAT_CONFIG[this.classType].attacks[attackId];
        if (def) this.setTint(def.color);
    }

    private enterActiveState(def: AttackDefinition) {
        this.attackState = 'ACTIVE';

        // Create Hitbox
        const facingRight = !this.flipX;
        const offsetX = facingRight ? def.hitbox.offsetX : -def.hitbox.offsetX;

        this.attackHitbox = this.scene.add.rectangle(
            this.x + offsetX,
            this.y + def.hitbox.offsetY,
            def.hitbox.width,
            def.hitbox.height,
            0xff0000,
            0.5
        );
        this.scene.physics.add.existing(this.attackHitbox);
        (this.attackHitbox.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    }

    private enterRecoveryState(_def: AttackDefinition) {
        this.attackState = 'RECOVERY';
        if (this.attackHitbox) {
            this.attackHitbox.destroy();
            this.attackHitbox = null;
        }
    }

    private endAttack() {
        this.isAttacking = false;
        this.attackState = 'IDLE';
        this.setTint(this.classStats.color); // Restore color

        // Set combo window
        this.comboTimer = this.COMBO_WINDOW;
    }

    public takeDamage(amount: number) {
        this.health -= amount;
        this.setTint(0xff0000);
        this.scene.time.delayedCall(200, () => this.setTint(this.classStats.color));

        if (this.health <= 0) {
            // Die
            this.scene.scene.restart();
        }
    }

    public collectItem(item: ItemData) {
        this.inventory.push(item);

        // Apply Effects
        if (item.effects) {
            item.effects.forEach(effect => {
                if (effect.targetStat === 'health') {
                    // Special case for health (flat addition to max)
                    this.maxHealth += effect.value;
                    this.health += effect.value;
                } else {
                    // Additive multiplier
                    const current = this.statModifiers.get(effect.targetStat) || 0;
                    this.statModifiers.set(effect.targetStat, current + effect.value);
                }
            });
        }

        // Unlock Ability
        if (item.abilityId) {
            this.abilities.add(item.abilityId);
        }

        // Visual Feedback
        const text = this.scene.add.text(this.x, this.y - 50, `+ ${item.name}`, {
            fontSize: '16px',
            color: '#ffff00',
            stroke: '#000',
            strokeThickness: 3
        });
        this.scene.tweens.add({
            targets: text,
            y: this.y - 100,
            alpha: 0,
            duration: 1000,
            onComplete: () => text.destroy()
        });

        // Dispatch Inventory Change
        window.dispatchEvent(new CustomEvent('inventory-change', {
            detail: { inventory: this.inventory }
        }));
    }
}
