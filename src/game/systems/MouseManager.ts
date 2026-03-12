import Phaser from "phaser";
import { GameSettings } from "./GameSettings";

/**
 * MouseManager — singleton that manages mouse-based gameplay controls.
 *
 * Features:
 * - Click to Attack: left click = attack, right click = dodge, middle click = special
 * - Mouse Aim: track mouse world position, calculate aim angle/direction from player
 * - Camera Lookahead: offset camera slightly toward mouse position
 *
 * All features are togglable via GameSettings and disabled by default.
 */
export const MouseManager = {
  _scene: null as Phaser.Scene | null,
  _pointer: null as Phaser.Input.Pointer | null,

  // Click state — true only on the frame the click occurred
  _leftClicked: false,
  _rightClicked: false,
  _middleClicked: false,

  // Aim state
  _aimAngle: 0,
  _aimDirX: 1,
  _aimDirY: 0,

  // Camera offset (lerped)
  _cameraOffsetX: 0,
  _cameraOffsetY: 0,

  // Player position cache
  _playerX: 0,
  _playerY: 0,

  init(scene: Phaser.Scene): void {
    this._scene = scene;
    this._pointer = scene.input.activePointer;

    // Reset state
    this._leftClicked = false;
    this._rightClicked = false;
    this._middleClicked = false;
    this._aimAngle = 0;
    this._aimDirX = 1;
    this._aimDirY = 0;
    this._cameraOffsetX = 0;
    this._cameraOffsetY = 0;

    // Disable browser context menu on the game canvas so right-click works
    scene.game.canvas.addEventListener("contextmenu", this._preventContext);

    // Listen for pointer down events
    scene.input.on("pointerdown", this._onPointerDown, this);
  },

  _preventContext(e: Event): void {
    e.preventDefault();
  },

  _onPointerDown(pointer: Phaser.Input.Pointer): void {
    const settings = GameSettings.get();
    if (!settings.mouseAttackEnabled) return;

    if (pointer.leftButtonDown()) {
      this._leftClicked = true;
    }
    if (pointer.rightButtonDown()) {
      this._rightClicked = true;
    }
    if (pointer.middleButtonDown()) {
      this._middleClicked = true;
    }
  },

  update(playerX: number, playerY: number): void {
    if (!this._scene || !this._pointer) return;

    this._playerX = playerX;
    this._playerY = playerY;

    const settings = GameSettings.get();

    // Update aim if mouse aim is enabled
    if (settings.mouseAimEnabled) {
      const camera = this._scene.cameras.main;
      // Convert pointer screen position to world position
      const worldX = this._pointer.x + camera.scrollX;
      const worldY = this._pointer.y + camera.scrollY;

      const dx = worldX - playerX;
      const dy = worldY - playerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      this._aimAngle = Math.atan2(dy, dx);

      if (dist > 0.001) {
        this._aimDirX = dx / dist;
        this._aimDirY = dy / dist;
      } else {
        this._aimDirX = 1;
        this._aimDirY = 0;
      }
    }

    // Update camera lookahead offset
    if (settings.mouseCameraLookahead) {
      const camera = this._scene.cameras.main;
      const worldX = this._pointer.x + camera.scrollX;
      const worldY = this._pointer.y + camera.scrollY;

      const dx = worldX - playerX;
      const dy = worldY - playerY;

      // Clamp to max offset of 50px
      const MAX_OFFSET = 50;
      const targetX = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, dx * 0.15));
      const targetY = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, dy * 0.15));

      // Smooth interpolation to prevent jitter
      const LERP_SPEED = 0.08;
      this._cameraOffsetX += (targetX - this._cameraOffsetX) * LERP_SPEED;
      this._cameraOffsetY += (targetY - this._cameraOffsetY) * LERP_SPEED;
    } else {
      // Decay offset back to zero when disabled
      this._cameraOffsetX *= 0.9;
      this._cameraOffsetY *= 0.9;
    }
  },

  /**
   * Called at the END of each frame to clear one-frame click flags.
   * MainScene should call this after all input consumers have read click state.
   */
  lateUpdate(): void {
    this._leftClicked = false;
    this._rightClicked = false;
    this._middleClicked = false;
  },

  getAimAngle(): number {
    return this._aimAngle;
  },

  getAimDirection(): { x: number; y: number } {
    return { x: this._aimDirX, y: this._aimDirY };
  },

  getCameraOffset(): { x: number; y: number } {
    return { x: this._cameraOffsetX, y: this._cameraOffsetY };
  },

  isLeftClicked(): boolean {
    return this._leftClicked;
  },

  isRightClicked(): boolean {
    return this._rightClicked;
  },

  isMiddleClicked(): boolean {
    return this._middleClicked;
  },

  destroy(): void {
    if (this._scene) {
      this._scene.input.off("pointerdown", this._onPointerDown, this);
      this._scene.game.canvas.removeEventListener("contextmenu", this._preventContext);
    }
    this._scene = null;
    this._pointer = null;
    this._leftClicked = false;
    this._rightClicked = false;
    this._middleClicked = false;
    this._cameraOffsetX = 0;
    this._cameraOffsetY = 0;
  },
};
