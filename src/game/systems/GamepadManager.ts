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

import { CoopManager } from './CoopManager';
import { RemoteInputAdapter } from './RemoteInputAdapter';

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
  // Per-gamepad state: supports up to 4 gamepads (index 0-3)
  _states: [createDefaultState(), createDefaultState(), createDefaultState(), createDefaultState()] as GamepadState[],
  _prevButtons: [new Map<number, boolean>(), new Map<number, boolean>(), new Map<number, boolean>(), new Map<number, boolean>()] as Map<number, boolean>[],

  // Legacy aliases for backward compat
  get state(): GamepadState { return this._states[0]; },
  set state(v: GamepadState) { this._states[0] = v; },
  get _p2State(): GamepadState { return this._states[1]; },
  get previousButtons(): Map<number, boolean> { return this._prevButtons[0]; },
  get _p2PreviousButtons(): Map<number, boolean> { return this._prevButtons[1]; },

  _updateStateFromGamepad(
    gp: Gamepad,
    state: GamepadState,
    prevButtons: Map<number, boolean>,
  ): void {
    state.connected = true;

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

    state.moveX = moveX;
    state.moveY = moveY;

    // Button states with "just pressed" detection
    const checkButton = (
      index: number,
      current: keyof GamepadState,
      justPressed: keyof GamepadState,
    ) => {
      const pressed = gp.buttons[index]?.pressed || false;
      const wasPressed = prevButtons.get(index) || false;
      (state as any)[current] = pressed;
      (state as any)[justPressed] = pressed && !wasPressed;
      prevButtons.set(index, pressed);
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
      state.cataclysmJustPressed = state.attackBJustPressed;
      state.cataclysm = state.attackB;
      state.temporalRiftJustPressed = state.attackXJustPressed;
      state.temporalRift = state.attackX;
      state.divineInterventionJustPressed = state.attackYJustPressed;
      state.divineIntervention = state.attackY;
      state.essenceBurstJustPressed = state.jumpJustPressed;
      state.essenceBurst = state.jump;

      // Don't trigger normal attacks/jump while LB is held
      state.attackBJustPressed = false;
      state.attackB = false;
      state.attackXJustPressed = false;
      state.attackX = false;
      state.attackYJustPressed = false;
      state.attackY = false;
      state.jumpJustPressed = false;
      state.jump = false;
      // Also suppress dodge since LB is the dodge button
      state.dodgeJustPressed = false;
      state.dodge = false;
    } else {
      state.cataclysmJustPressed = false;
      state.cataclysm = false;
      state.temporalRiftJustPressed = false;
      state.temporalRift = false;
      state.divineInterventionJustPressed = false;
      state.divineIntervention = false;
      state.essenceBurstJustPressed = false;
      state.essenceBurst = false;
    }
  },

  update(): void {
    const gamepads = navigator.getGamepads();

    if (CoopManager.isActive()) {
      // Co-op: each physical gamepad maps to a player slot.
      // P1 uses keyboard primarily; first gamepad goes to P2, second to P1 (if present).
      // Reset all states first
      for (let i = 0; i < 4; i++) {
        this._states[i] = createDefaultState();
      }

      // Collect connected gamepads in order
      const connected: Gamepad[] = [];
      for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i]) connected.push(gamepads[i]!);
      }

      if (connected.length >= 2) {
        // Two+ gamepads: first goes to P1 (index 0), second to P2 (index 1)
        this._updateStateFromGamepad(connected[0], this._states[0], this._prevButtons[0]);
        this._updateStateFromGamepad(connected[1], this._states[1], this._prevButtons[1]);
      } else if (connected.length === 1) {
        // One gamepad: goes to P2 (P1 uses keyboard)
        this._updateStateFromGamepad(connected[0], this._states[1], this._prevButtons[1]);
      }
    } else {
      // Solo mode: first connected gamepad goes to Player 1
      const gp = gamepads[0] || gamepads[1] || gamepads[2] || gamepads[3];
      if (!gp) {
        this._states[0] = createDefaultState();
        return;
      }
      this._updateStateFromGamepad(gp, this._states[0], this._prevButtons[0]);
    }
  },

  getStateForPlayer(playerIndex: number): GamepadState {
    // Online co-op host: player 2 input comes from the remote guest
    if (playerIndex === 1 && CoopManager.isActive() && CoopManager.isOnline()) {
      return RemoteInputAdapter.getState();
    }
    return this._states[Math.min(playerIndex, 3)];
  },

  isConnected(): boolean {
    return this._states.some(s => s.connected);
  },
};
