import Phaser from "phaser";

export type NPCType = "wanderer" | "blacksmith" | "cursed_one" | "seer";

const NPC_COLORS: Record<NPCType, number> = {
  wanderer: 0x44bbaa,
  blacksmith: 0xdd8833,
  cursed_one: 0x9933cc,
  seer: 0x66aadd,
};

const NPC_NAMES: Record<NPCType, string> = {
  wanderer: "The Wanderer",
  blacksmith: "The Blacksmith",
  cursed_one: "The Cursed One",
  seer: "The Seer",
};

let npcIdCounter = 0;

export class NPC extends Phaser.GameObjects.Container {
  public npcType: NPCType;
  public npcId: string;
  public interacted: boolean = false;

  private body_rect: Phaser.GameObjects.Rectangle;
  private nameText: Phaser.GameObjects.Text;
  private exclamation: Phaser.GameObjects.Text;
  private interactionZone: Phaser.GameObjects.Zone;
  private playerNearby: boolean = false;
  private exclamationTween: Phaser.Tweens.Tween | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    npcType: NPCType,
  ) {
    super(scene, x, y);
    this.npcType = npcType;
    this.npcId = `npc_${npcType}_${npcIdCounter++}`;

    const color = NPC_COLORS[npcType];
    const name = NPC_NAMES[npcType];

    // NPC body rectangle (40x60)
    this.body_rect = scene.add.rectangle(0, 0, 40, 60, color);
    this.body_rect.setStrokeStyle(2, 0xffffff, 0.6);
    this.add(this.body_rect);

    // Subtle inner highlight
    const highlight = scene.add.rectangle(-8, -10, 6, 20, 0xffffff, 0.25);
    this.add(highlight);

    // Name label above
    this.nameText = scene.add.text(0, -50, name, {
      fontSize: "14px",
      color: "#ffffff",
      fontFamily: "monospace",
      fontStyle: "bold",
      align: "center",
    });
    this.nameText.setOrigin(0.5, 1);
    this.add(this.nameText);

    // Exclamation mark indicator (hidden until player is nearby)
    this.exclamation = scene.add.text(0, -70, "!", {
      fontSize: "24px",
      color: "#ffcc00",
      fontFamily: "monospace",
      fontStyle: "bold",
    });
    this.exclamation.setOrigin(0.5, 1);
    this.exclamation.setVisible(false);
    this.add(this.exclamation);

    // Interaction zone (wider than NPC for easier triggering)
    this.interactionZone = scene.add.zone(x, y - 20, 120, 100);
    scene.physics.add.existing(this.interactionZone, true);

    // Add to scene
    scene.add.existing(this);
    this.setDepth(5);
  }

  getInteractionZone(): Phaser.GameObjects.Zone {
    return this.interactionZone;
  }

  setPlayerNearby(nearby: boolean): void {
    if (this.interacted) return;

    this.playerNearby = nearby;
    this.exclamation.setVisible(nearby);

    if (nearby && !this.exclamationTween) {
      this.exclamationTween = this.scene.tweens.add({
        targets: this.exclamation,
        y: { from: -70, to: -78 },
        duration: 500,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    } else if (!nearby && this.exclamationTween) {
      this.exclamationTween.destroy();
      this.exclamationTween = null;
      this.exclamation.y = -70;
    }
  }

  markInteracted(): void {
    this.interacted = true;
    this.exclamation.setVisible(false);
    if (this.exclamationTween) {
      this.exclamationTween.destroy();
      this.exclamationTween = null;
    }

    // Gray out the NPC
    this.body_rect.setAlpha(0.4);
    this.nameText.setAlpha(0.4);

    // Show checkmark
    const check = this.scene.add.text(0, -70, "\u2713", {
      fontSize: "24px",
      color: "#44ff44",
      fontFamily: "monospace",
      fontStyle: "bold",
    });
    check.setOrigin(0.5, 1);
    this.add(check);
  }

  isPlayerNearby(): boolean {
    return this.playerNearby;
  }

  cleanup(): void {
    if (this.exclamationTween) {
      this.exclamationTween.destroy();
      this.exclamationTween = null;
    }
    this.interactionZone.destroy();
    this.destroy();
  }
}
