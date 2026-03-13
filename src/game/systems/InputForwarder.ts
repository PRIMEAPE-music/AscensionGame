// InputForwarder.ts — Singleton that runs on the guest side. Each frame, it captures
// the guest's local input (keyboard + gamepad) and sends it to the host via NetworkManager.

import { NetworkManager } from './NetworkManager';
import { GamepadManager } from './GamepadManager';
import type { InputSnapshot } from './NetworkTypes';

export const InputForwarder = {
  _frame: 0,
  _scene: null as Phaser.Scene | null,

  /** Initialize with the guest's scene for keyboard access */
  init(scene: Phaser.Scene): void {
    this._scene = scene;
    this._frame = 0;
  },

  /** Called every frame on the guest to capture and send input */
  update(): void {
    if (!NetworkManager.isConnected() || !NetworkManager.isGuest()) return;

    this._frame++;
    const snapshot = this.captureInput();
    NetworkManager.send({ type: 'input', data: snapshot });
  },

  /** Capture current input state from keyboard and gamepad.
   *  On the guest machine the local player is always playerIndex 0,
   *  so GamepadManager.getStateForPlayer(0) already merges keyboard + gamepad. */
  captureInput(): InputSnapshot {
    const gp = GamepadManager.getStateForPlayer(0);

    const snapshot: InputSnapshot = {
      frame: this._frame,
      moveX: gp.moveX,
      moveY: gp.moveY,
      jump: gp.jump,
      jumpJP: gp.jumpJustPressed,
      attackB: gp.attackB,
      attackBJP: gp.attackBJustPressed,
      attackX: gp.attackX,
      attackXJP: gp.attackXJustPressed,
      attackY: gp.attackY,
      attackYJP: gp.attackYJustPressed,
      dodge: gp.dodge,
      dodgeJP: gp.dodgeJustPressed,
      grapple: gp.grapple,
      grappleJP: gp.grappleJustPressed,
      counterSlash: gp.counterSlash,
      counterSlashJP: gp.counterSlashJustPressed,
      groundSlam: gp.groundSlam,
      groundSlamJP: gp.groundSlamJustPressed,
      cataclysm: gp.cataclysm,
      cataclysmJP: gp.cataclysmJustPressed,
      temporalRift: gp.temporalRift,
      temporalRiftJP: gp.temporalRiftJustPressed,
      divineIntervention: gp.divineIntervention,
      divineInterventionJP: gp.divineInterventionJustPressed,
      essenceBurst: gp.essenceBurst,
      essenceBurstJP: gp.essenceBurstJustPressed,
    };

    return snapshot;
  },

  reset(): void {
    this._frame = 0;
    this._scene = null;
  },
};
