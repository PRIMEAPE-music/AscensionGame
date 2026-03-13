// RemoteInputAdapter.ts — Singleton that stores the latest input state received from
// the remote guest player. The host reads from this when processing the guest's Player entity.

import type { InputSnapshot } from './NetworkTypes';
import type { GamepadState } from './GamepadManager';

/** Returns a GamepadState with all buttons false, moveX/Y 0, connected false. */
function createDefaultRemoteState(): GamepadState {
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

export const RemoteInputAdapter = {
  _latestInput: null as InputSnapshot | null,

  /** Called when an input message is received from the guest */
  updateFromNetwork(input: InputSnapshot): void {
    this._latestInput = input;
  },

  /** Returns a GamepadState-compatible object from the latest remote input.
   *  This is what GamepadManager.getStateForPlayer(1) will return when hosting. */
  getState(): GamepadState {
    const inp = this._latestInput;
    if (!inp) {
      // Return a default "no input" state
      return createDefaultRemoteState();
    }
    return {
      connected: true,
      moveX: inp.moveX,
      moveY: inp.moveY,
      jump: inp.jump,
      jumpJustPressed: inp.jumpJP,
      attackB: inp.attackB,
      attackBJustPressed: inp.attackBJP,
      attackX: inp.attackX,
      attackXJustPressed: inp.attackXJP,
      attackY: inp.attackY,
      attackYJustPressed: inp.attackYJP,
      dodge: inp.dodge,
      dodgeJustPressed: inp.dodgeJP,
      grapple: inp.grapple,
      grappleJustPressed: inp.grappleJP,
      counterSlash: inp.counterSlash,
      counterSlashJustPressed: inp.counterSlashJP,
      groundSlam: inp.groundSlam,
      groundSlamJustPressed: inp.groundSlamJP,
      pause: false,
      pauseJustPressed: false,
      cataclysm: inp.cataclysm,
      cataclysmJustPressed: inp.cataclysmJP,
      temporalRift: inp.temporalRift,
      temporalRiftJustPressed: inp.temporalRiftJP,
      divineIntervention: inp.divineIntervention,
      divineInterventionJustPressed: inp.divineInterventionJP,
      essenceBurst: inp.essenceBurst,
      essenceBurstJustPressed: inp.essenceBurstJP,
    };
  },

  /** Clear stored input (on disconnect) */
  reset(): void {
    this._latestInput = null;
  },
};
