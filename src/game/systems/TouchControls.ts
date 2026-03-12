import Phaser from "phaser";
import { GameSettings } from "./GameSettings";

export type TouchButton = "A" | "B" | "X" | "Y";
export type SwipeDirection = "up" | "down";

interface JoystickState {
  active: boolean;
  pointerId: number;
  baseX: number;
  baseY: number;
  thumbX: number;
  thumbY: number;
  dirX: number;
  dirY: number;
}

interface ButtonState {
  pressed: boolean;
  justPressed: boolean;
  wasPressed: boolean;
  pointerId: number;
}

interface SwipeState {
  detected: boolean;
  consumed: boolean;
}

const JOYSTICK_RADIUS = 100;
const JOYSTICK_DEADZONE = 0.1;
const BUTTON_RADIUS = 28; // Half of 56px
const SWIPE_THRESHOLD = 60; // Minimum px for a swipe
const SWIPE_MAX_TIME = 400; // Max ms for a swipe gesture

/**
 * Touch control system for mobile play.
 *
 * The virtual joystick (left side) and action buttons (right side) are
 * managed entirely through Phaser's pointer/input system.  A companion
 * React overlay (TouchControlsOverlay.tsx) provides the *visual* layer;
 * this class owns all input logic.
 */
export class TouchControls {
  private scene: Phaser.Scene;

  // Joystick
  private joystick: JoystickState = {
    active: false,
    pointerId: -1,
    baseX: 0,
    baseY: 0,
    thumbX: 0,
    thumbY: 0,
    dirX: 0,
    dirY: 0,
  };

  // Buttons
  private buttons: Record<TouchButton, ButtonState> = {
    A: { pressed: false, justPressed: false, wasPressed: false, pointerId: -1 },
    B: { pressed: false, justPressed: false, wasPressed: false, pointerId: -1 },
    X: { pressed: false, justPressed: false, wasPressed: false, pointerId: -1 },
    Y: { pressed: false, justPressed: false, wasPressed: false, pointerId: -1 },
  };

  // Swipes
  private swipes: Record<SwipeDirection, SwipeState> = {
    up: { detected: false, consumed: false },
    down: { detected: false, consumed: false },
  };

  // Swipe tracking for active pointers on right side
  private rightPointerStart: Map<
    number,
    { x: number; y: number; time: number }
  > = new Map();

  // Two-finger tap detection
  private twoFingerTapTimer: number = 0;
  private activePointerCount: number = 0;

  // Phaser graphics for joystick + buttons (drawn in the Phaser scene)
  private joystickGraphics: Phaser.GameObjects.Graphics | null = null;
  private buttonGraphics: Phaser.GameObjects.Graphics | null = null;
  private buttonTexts: Phaser.GameObjects.Text[] = [];

  // Whether touch is the active input mode
  private _isActive: boolean = false;

  // Button positions (screen coordinates — recalculated on resize)
  private buttonPositions: Record<TouchButton, { x: number; y: number }> = {
    A: { x: 0, y: 0 },
    B: { x: 0, y: 0 },
    X: { x: 0, y: 0 },
    Y: { x: 0, y: 0 },
  };

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Enable multi-touch (Phaser starts with 2 pointers by default — add more)
    this.scene.input.addPointer(2); // total of 4 pointers

    this.joystickGraphics = this.scene.add.graphics();
    this.joystickGraphics.setDepth(1000);
    this.joystickGraphics.setScrollFactor(0);

    this.buttonGraphics = this.scene.add.graphics();
    this.buttonGraphics.setDepth(1000);
    this.buttonGraphics.setScrollFactor(0);

    this.calculateButtonPositions();

    // Pointer event listeners
    this.scene.input.on("pointerdown", this.onPointerDown, this);
    this.scene.input.on("pointermove", this.onPointerMove, this);
    this.scene.input.on("pointerup", this.onPointerUp, this);

    // Listen for resize to recalculate button positions
    this.scene.scale.on("resize", this.calculateButtonPositions, this);
  }

  // ─── Public API ────────────────────────────────────────────────────

  isActive(): boolean {
    return this._isActive;
  }

  getMovement(): { x: number; y: number } {
    return { x: this.joystick.dirX, y: this.joystick.dirY };
  }

  isButtonPressed(button: TouchButton): boolean {
    return this.buttons[button].pressed;
  }

  isButtonJustPressed(button: TouchButton): boolean {
    return this.buttons[button].justPressed;
  }

  wasSwipeDetected(direction: SwipeDirection): boolean {
    if (this.swipes[direction].detected && !this.swipes[direction].consumed) {
      this.swipes[direction].consumed = true;
      return true;
    }
    return false;
  }

  /**
   * Call once per frame. Processes justPressed → wasPressed transitions,
   * clears consumed swipes, and redraws the visual indicators.
   */
  update(): void {
    // Transition justPressed → wasPressed each frame
    for (const key of Object.keys(this.buttons) as TouchButton[]) {
      const btn = this.buttons[key];
      if (btn.justPressed) {
        // justPressed is true for exactly one frame
        btn.justPressed = false;
      }
    }

    // Clear consumed swipes
    for (const dir of ["up", "down"] as SwipeDirection[]) {
      if (this.swipes[dir].consumed) {
        this.swipes[dir].detected = false;
        this.swipes[dir].consumed = false;
      }
    }

    // Draw visuals
    this.drawJoystick();
    this.drawButtons();
  }

  destroy(): void {
    this.scene.input.off("pointerdown", this.onPointerDown, this);
    this.scene.input.off("pointermove", this.onPointerMove, this);
    this.scene.input.off("pointerup", this.onPointerUp, this);
    this.scene.scale.off("resize", this.calculateButtonPositions, this);

    this.joystickGraphics?.destroy();
    this.buttonGraphics?.destroy();
    for (const txt of this.buttonTexts) {
      txt.destroy();
    }
    this.buttonTexts = [];
  }

  // ─── Internal: pointer event handlers ──────────────────────────────

  private onPointerDown = (pointer: Phaser.Input.Pointer): void => {
    this._isActive = true;
    this.activePointerCount++;

    // Two-finger tap detection
    if (this.activePointerCount >= 2) {
      // Dispatch pause (same pattern as GamepadManager)
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          code: "Escape",
          bubbles: true,
        }),
      );
      return;
    }

    const screenW = this.scene.scale.width;
    const isLeftSide =
      GameSettings.get().touchJoystickSide === "LEFT"
        ? pointer.x < screenW / 2
        : pointer.x >= screenW / 2;

    if (isLeftSide) {
      // Joystick activation
      if (!this.joystick.active) {
        this.joystick.active = true;
        this.joystick.pointerId = pointer.id;
        this.joystick.baseX = pointer.x;
        this.joystick.baseY = pointer.y;
        this.joystick.thumbX = pointer.x;
        this.joystick.thumbY = pointer.y;
        this.joystick.dirX = 0;
        this.joystick.dirY = 0;
      }
    } else {
      // Right side — check buttons first
      const hitButton = this.hitTestButtons(pointer.x, pointer.y);
      if (hitButton) {
        this.pressButton(hitButton, pointer.id);
      } else {
        // Track for potential swipe
        this.rightPointerStart.set(pointer.id, {
          x: pointer.x,
          y: pointer.y,
          time: Date.now(),
        });
      }
    }
  };

  private onPointerMove = (pointer: Phaser.Input.Pointer): void => {
    // Joystick movement
    if (this.joystick.active && pointer.id === this.joystick.pointerId) {
      const dx = pointer.x - this.joystick.baseX;
      const dy = pointer.y - this.joystick.baseY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > JOYSTICK_RADIUS) {
        // Clamp to radius
        this.joystick.thumbX =
          this.joystick.baseX + (dx / dist) * JOYSTICK_RADIUS;
        this.joystick.thumbY =
          this.joystick.baseY + (dy / dist) * JOYSTICK_RADIUS;
      } else {
        this.joystick.thumbX = pointer.x;
        this.joystick.thumbY = pointer.y;
      }

      // Normalized direction with deadzone
      const norm = Math.min(dist / JOYSTICK_RADIUS, 1);
      if (norm < JOYSTICK_DEADZONE) {
        this.joystick.dirX = 0;
        this.joystick.dirY = 0;
      } else {
        const adjusted = (norm - JOYSTICK_DEADZONE) / (1 - JOYSTICK_DEADZONE);
        this.joystick.dirX = (dx / dist) * adjusted;
        this.joystick.dirY = (dy / dist) * adjusted;
      }
    }
  };

  private onPointerUp = (pointer: Phaser.Input.Pointer): void => {
    this.activePointerCount = Math.max(0, this.activePointerCount - 1);

    // Joystick release
    if (this.joystick.active && pointer.id === this.joystick.pointerId) {
      this.joystick.active = false;
      this.joystick.pointerId = -1;
      this.joystick.dirX = 0;
      this.joystick.dirY = 0;
    }

    // Button release
    for (const key of Object.keys(this.buttons) as TouchButton[]) {
      if (this.buttons[key].pointerId === pointer.id) {
        this.buttons[key].pressed = false;
        this.buttons[key].pointerId = -1;
      }
    }

    // Swipe detection on right side
    const startData = this.rightPointerStart.get(pointer.id);
    if (startData) {
      this.rightPointerStart.delete(pointer.id);
      const elapsed = Date.now() - startData.time;
      if (elapsed < SWIPE_MAX_TIME) {
        const dy = pointer.y - startData.y;
        const dx = pointer.x - startData.x;
        // Must be primarily vertical
        if (Math.abs(dy) > SWIPE_THRESHOLD && Math.abs(dy) > Math.abs(dx)) {
          if (dy < 0) {
            this.swipes.up.detected = true;
            this.swipes.up.consumed = false;
          } else {
            this.swipes.down.detected = true;
            this.swipes.down.consumed = false;
          }
        }
      }
    }
  };

  // ─── Internal: helpers ─────────────────────────────────────────────

  private calculateButtonPositions = (): void => {
    const screenW = this.scene.scale.width;
    const screenH = this.scene.scale.height;
    const settings = GameSettings.get();
    const sizeMultiplier =
      settings.touchButtonSize === "SMALL"
        ? 0.75
        : settings.touchButtonSize === "LARGE"
          ? 1.25
          : 1.0;
    const btnRadius = BUTTON_RADIUS * sizeMultiplier;
    const spacing = btnRadius * 2.4;

    // Center of diamond on right side, offset from edges
    const isJoystickLeft = settings.touchJoystickSide === "LEFT";
    const centerX = isJoystickLeft
      ? screenW - 90 * sizeMultiplier
      : 90 * sizeMultiplier;
    const centerY = screenH - 130 * sizeMultiplier;

    // Diamond layout: Y top, X left, B right, A bottom
    this.buttonPositions = {
      Y: { x: centerX, y: centerY - spacing },
      X: { x: centerX - spacing, y: centerY },
      B: { x: centerX + spacing, y: centerY },
      A: { x: centerX, y: centerY + spacing },
    };
  };

  private hitTestButtons(
    x: number,
    y: number,
  ): TouchButton | null {
    const settings = GameSettings.get();
    const sizeMultiplier =
      settings.touchButtonSize === "SMALL"
        ? 0.75
        : settings.touchButtonSize === "LARGE"
          ? 1.25
          : 1.0;
    const hitRadius = BUTTON_RADIUS * sizeMultiplier * 1.3; // Slightly larger hit area

    for (const key of Object.keys(this.buttonPositions) as TouchButton[]) {
      const pos = this.buttonPositions[key];
      const dx = x - pos.x;
      const dy = y - pos.y;
      if (dx * dx + dy * dy <= hitRadius * hitRadius) {
        return key;
      }
    }
    return null;
  }

  private pressButton(button: TouchButton, pointerId: number): void {
    const btn = this.buttons[button];
    if (!btn.pressed) {
      btn.justPressed = true;
    }
    btn.pressed = true;
    btn.pointerId = pointerId;
    // Also remove this pointer from swipe tracking
    this.rightPointerStart.delete(pointerId);
  }

  // ─── Internal: Phaser graphics rendering ───────────────────────────

  private drawJoystick(): void {
    const gfx = this.joystickGraphics;
    if (!gfx) return;
    gfx.clear();

    if (!this.joystick.active) return;

    const settings = GameSettings.get();
    const alpha = settings.touchButtonOpacity;

    // Outer ring
    gfx.lineStyle(3, 0xffffff, alpha * 0.5);
    gfx.strokeCircle(
      this.joystick.baseX,
      this.joystick.baseY,
      JOYSTICK_RADIUS,
    );

    // Inner thumb
    gfx.fillStyle(0xffffff, alpha * 0.7);
    gfx.fillCircle(this.joystick.thumbX, this.joystick.thumbY, 30);
  }

  private drawButtons(): void {
    const gfx = this.buttonGraphics;
    if (!gfx) return;
    gfx.clear();

    // Destroy old texts
    for (const txt of this.buttonTexts) {
      txt.destroy();
    }
    this.buttonTexts = [];

    const settings = GameSettings.get();
    const alpha = settings.touchButtonOpacity;
    const sizeMultiplier =
      settings.touchButtonSize === "SMALL"
        ? 0.75
        : settings.touchButtonSize === "LARGE"
          ? 1.25
          : 1.0;
    const btnRadius = BUTTON_RADIUS * sizeMultiplier;

    const buttonColors: Record<TouchButton, number> = {
      A: 0x44bb44, // green — jump
      B: 0xbb4444, // red — attack
      X: 0x4488cc, // blue — dodge
      Y: 0xccaa44, // yellow — special
    };

    for (const key of Object.keys(this.buttonPositions) as TouchButton[]) {
      const pos = this.buttonPositions[key];
      const btn = this.buttons[key];
      const color = buttonColors[key];
      const pressedScale = btn.pressed ? 0.85 : 1.0;
      const pressedAlpha = btn.pressed ? alpha * 1.0 : alpha * 0.6;
      const r = btnRadius * pressedScale;

      // Button circle
      gfx.fillStyle(color, pressedAlpha);
      gfx.fillCircle(pos.x, pos.y, r);
      gfx.lineStyle(2, 0xffffff, pressedAlpha * 0.8);
      gfx.strokeCircle(pos.x, pos.y, r);

      // Label
      const label = this.scene.add.text(pos.x, pos.y, key, {
        fontSize: `${Math.round(18 * sizeMultiplier)}px`,
        fontFamily: "monospace",
        color: "#ffffff",
        align: "center",
      });
      label.setOrigin(0.5, 0.5);
      label.setScrollFactor(0);
      label.setDepth(1001);
      label.setAlpha(pressedAlpha);
      this.buttonTexts.push(label);
    }
  }
}
