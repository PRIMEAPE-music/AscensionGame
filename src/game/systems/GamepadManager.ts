// Standard gamepad mapping (Xbox layout):
// A (0): Jump
// B (1): Attack B (Z)
// X (2): Attack X (X key)
// Y (3): Attack Y (C key)
// LB (4): Dodge / Air Dash (SHIFT)
// RB (5): Grappling Hook (V)
// LT (6): Counter Slash (G) / Charged Attack (H) — hold
// RT (7): Ground Slam (T) / Projectile (Y key)
// Select (8): not used
// Start (9): Pause (ESC)
// L3 (10): not used
// R3 (11): not used
// D-Pad Up (12): Up
// D-Pad Down (13): Down
// D-Pad Left (14): Left
// D-Pad Right (15): Right
// Left Stick axes[0]: Horizontal (-1 to 1)
// Left Stick axes[1]: Vertical (-1 to 1)

export interface GamepadState {
  connected: boolean;
  // Movement
  moveX: number; // -1 to 1
  moveY: number; // -1 to 1
  // Action buttons
  jump: boolean;
  jumpJustPressed: boolean;
  attackB: boolean;
  attackBJustPressed: boolean;
  attackX: boolean;
  attackXJustPressed: boolean;
  attackY: boolean;
  attackYJustPressed: boolean;
  dodge: boolean;
  dodgeJustPressed: boolean;
  grapple: boolean;
  grappleJustPressed: boolean;
  // Triggers
  counterSlash: boolean;
  counterSlashJustPressed: boolean;
  groundSlam: boolean;
  groundSlamJustPressed: boolean;
  // Special
  pause: boolean;
  pauseJustPressed: boolean;
  // Ultimate abilities (mapped to LB + face buttons)
  cataclysm: boolean;
  cataclysmJustPressed: boolean;
  temporalRift: boolean;
  temporalRiftJustPressed: boolean;
  divineIntervention: boolean;
  divineInterventionJustPressed: boolean;
  essenceBurst: boolean;
  essenceBurstJustPressed: boolean;
}

const DEADZONE = 0.2;

function createDefaultState(): GamepadState {
  return {
    connected: false,
    moveX: 0,
    moveY: 0,
    jump: false,
    jumpJustPressed: false,
    attackB: false,
    attackBJustPressed: false,
    attackX: false,
    attackXJustPressed: false,
    attackY: false,
    attackYJustPressed: false,
    dodge: false,
    dodgeJustPressed: false,
    grapple: false,
    grappleJustPressed: false,
    counterSlash: false,
    counterSlashJustPressed: false,
    groundSlam: false,
    groundSlamJustPressed: false,
    pause: false,
    pauseJustPressed: false,
    cataclysm: false,
    cataclysmJustPressed: false,
    temporalRift: false,
    temporalRiftJustPressed: false,
    divineIntervention: false,
    divineInterventionJustPressed: false,
    essenceBurst: false,
    essenceBurstJustPressed: false,
  };
}

export const GamepadManager = {
  state: createDefaultState(),
  previousButtons: new Map<number, boolean>(),

  update(): void {
    const gamepads = navigator.getGamepads();
    const gp = gamepads[0] || gamepads[1] || gamepads[2] || gamepads[3];

    if (!gp) {
      this.state.connected = false;
      return;
    }

    this.state.connected = true;

    // Movement from left stick or d-pad
    let moveX = gp.axes[0] || 0;
    let moveY = gp.axes[1] || 0;

    // Apply deadzone
    if (Math.abs(moveX) < DEADZONE) moveX = 0;
    if (Math.abs(moveY) < DEADZONE) moveY = 0;

    // D-pad overrides stick
    if (gp.buttons[14]?.pressed) moveX = -1; // Left
    if (gp.buttons[15]?.pressed) moveX = 1; // Right
    if (gp.buttons[12]?.pressed) moveY = -1; // Up
    if (gp.buttons[13]?.pressed) moveY = 1; // Down

    this.state.moveX = moveX;
    this.state.moveY = moveY;

    // Button states with "just pressed" detection
    const checkButton = (
      index: number,
      current: keyof GamepadState,
      justPressed: keyof GamepadState,
    ) => {
      const pressed = gp.buttons[index]?.pressed || false;
      const wasPressed = this.previousButtons.get(index) || false;
      (this.state as any)[current] = pressed;
      (this.state as any)[justPressed] = pressed && !wasPressed;
      this.previousButtons.set(index, pressed);
    };

    checkButton(0, "jump", "jumpJustPressed"); // A
    checkButton(1, "attackB", "attackBJustPressed"); // B
    checkButton(2, "attackX", "attackXJustPressed"); // X
    checkButton(3, "attackY", "attackYJustPressed"); // Y
    checkButton(4, "dodge", "dodgeJustPressed"); // LB
    checkButton(5, "grapple", "grappleJustPressed"); // RB
    checkButton(6, "counterSlash", "counterSlashJustPressed"); // LT
    checkButton(7, "groundSlam", "groundSlamJustPressed"); // RT
    checkButton(9, "pause", "pauseJustPressed"); // Start

    // Ultimate abilities: hold LB + face buttons
    const lbHeld = gp.buttons[4]?.pressed;
    if (lbHeld) {
      // When LB is held, face buttons trigger ultimate abilities instead
      this.state.cataclysmJustPressed = this.state.attackBJustPressed;
      this.state.cataclysm = this.state.attackB;
      this.state.temporalRiftJustPressed = this.state.attackXJustPressed;
      this.state.temporalRift = this.state.attackX;
      this.state.divineInterventionJustPressed = this.state.attackYJustPressed;
      this.state.divineIntervention = this.state.attackY;
      this.state.essenceBurstJustPressed = this.state.jumpJustPressed;
      this.state.essenceBurst = this.state.jump;

      // Don't trigger normal attacks/jump while LB is held
      this.state.attackBJustPressed = false;
      this.state.attackB = false;
      this.state.attackXJustPressed = false;
      this.state.attackX = false;
      this.state.attackYJustPressed = false;
      this.state.attackY = false;
      this.state.jumpJustPressed = false;
      this.state.jump = false;
      // Also suppress dodge since LB is the dodge button
      this.state.dodgeJustPressed = false;
      this.state.dodge = false;
    } else {
      this.state.cataclysmJustPressed = false;
      this.state.cataclysm = false;
      this.state.temporalRiftJustPressed = false;
      this.state.temporalRift = false;
      this.state.divineInterventionJustPressed = false;
      this.state.divineIntervention = false;
      this.state.essenceBurstJustPressed = false;
      this.state.essenceBurst = false;
    }
  },

  isConnected(): boolean {
    return this.state.connected;
  },
};
