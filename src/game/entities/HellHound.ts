import { Enemy } from "./Enemy";
import { Player } from "./Player";
import Phaser from "phaser";

type HoundState = "PATROL" | "CHASE" | "LUNGE" | "RECOVERY";

export class HellHound extends Enemy {
  private state: HoundState = "PATROL";
  private direction: number = 1;
  private patrolTimer: number = 0;
  private recoveryTimer: number = 0;

  private readonly DETECT_RANGE = 350;
  private readonly LUNGE_RANGE = 120;
  private readonly LUNGE_SPEED_X = 400;
  private readonly LUNGE_SPEED_Y = -250;
  private readonly RECOVERY_DURATION = 800;
  private readonly PATROL_TURN_INTERVAL = 1500;

  constructor(scene: Phaser.Scene, x: number, y: number, player: Player) {
    super(scene, x, y, "dude", player, 4, 1, 250); // 4 HP, 1 Dmg, 250 Speed
    this.setTint(0xff4400); // Orange-red
    this.setScale(0.75);
  }

  update(time: number, delta: number) {
    super.update(time, delta);
    if (this.isDead) return;

    switch (this.state) {
      case "PATROL":
        this.handlePatrol(delta);
        break;
      case "CHASE":
        this.handleChase();
        break;
      case "LUNGE":
        this.handleLunge();
        break;
      case "RECOVERY":
        this.handleRecovery(delta);
        break;
    }
  }

  private handlePatrol(delta: number) {
    this.setVelocityX(this.speed * 0.4 * this.direction);

    this.patrolTimer += delta;
    if (this.patrolTimer >= this.PATROL_TURN_INTERVAL) {
      this.direction *= -1;
      this.patrolTimer = 0;
    }
    this.setFlipX(this.direction < 0);

    // Check if player is in detection range
    const dist = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      this.player.x,
      this.player.y,
    );
    if (dist < this.DETECT_RANGE) {
      this.state = "CHASE";
    }
  }

  private handleChase() {
    // Run toward player
    const dx = this.player.x - this.x;
    this.direction = dx > 0 ? 1 : -1;
    this.setVelocityX(this.speed * this.direction);
    this.setFlipX(this.direction < 0);

    const dist = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      this.player.x,
      this.player.y,
    );

    // Lunge when close enough
    if (dist < this.LUNGE_RANGE) {
      this.startLunge();
      return;
    }

    // Lose interest if player gets too far
    if (dist > this.DETECT_RANGE * 2) {
      this.state = "PATROL";
      this.patrolTimer = 0;
    }
  }

  private startLunge() {
    this.state = "LUNGE";

    // Brief telegraph flash
    this.setTint(0xffaa00);

    const lungeDir = this.player.x > this.x ? 1 : -1;
    this.setVelocityX(this.LUNGE_SPEED_X * lungeDir);
    this.setVelocityY(this.LUNGE_SPEED_Y);
  }

  private handleLunge() {
    // Wait until landing (on ground)
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body.blocked.down) {
      this.state = "RECOVERY";
      this.recoveryTimer = 0;
      this.setVelocityX(0);
      this.setTint(0xff4400); // Reset tint
    }
  }

  private handleRecovery(delta: number) {
    this.setVelocityX(0);
    this.recoveryTimer += delta;

    if (this.recoveryTimer >= this.RECOVERY_DURATION) {
      // After recovery, check if player is still nearby
      const dist = Phaser.Math.Distance.Between(
        this.x,
        this.y,
        this.player.x,
        this.player.y,
      );
      this.state = dist < this.DETECT_RANGE ? "CHASE" : "PATROL";
      this.patrolTimer = 0;
    }
  }
}
