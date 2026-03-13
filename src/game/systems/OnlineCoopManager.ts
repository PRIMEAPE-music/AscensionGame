import { NetworkManager } from './NetworkManager';
import { StateSerializer } from './StateSerializer';
import { RemoteInputAdapter } from './RemoteInputAdapter';
import { InputForwarder } from './InputForwarder';
import { EventBridge } from './EventBridge';
import { CoopManager } from './CoopManager';
import type { NetworkMessage, GameStateSnapshot } from './NetworkTypes';

/** 20 Hz serialization rate = 50 ms per tick. */
const SERIALIZATION_INTERVAL = 50;

interface LobbyUpdateData {
  state: string;
  roomCode: string;
  latency: number;
  guestClass: string;
}

export const OnlineCoopManager = {
  _scene: null as Phaser.Scene | null,
  _serializationTimer: 0,
  _onLobbyUpdate: null as ((data: LobbyUpdateData) => void) | null,
  _latestSnapshot: null as GameStateSnapshot | null,
  _guestClass: '' as string,
  _roomCode: '' as string,

  // ---------------------------------------------------------------------------
  // Host flow
  // ---------------------------------------------------------------------------

  async hostGame(hostClass: string): Promise<string> {
    const code = await NetworkManager.createRoom();
    this._roomCode = code;

    NetworkManager.onMessage((msg: NetworkMessage) => {
      switch (msg.type) {
        case 'input':
          RemoteInputAdapter.updateFromNetwork(msg.data);
          break;

        case 'class-select':
          this._guestClass = msg.classType;
          this._notifyLobby({ state: 'class-selected', roomCode: code, latency: 0, guestClass: msg.classType });
          break;

        case 'ready':
          this._notifyLobby({ state: 'ready', roomCode: code, latency: 0, guestClass: this._guestClass });
          break;

        case 'event':
          EventBridge.handleGuestEvent(msg.name, msg.payload);
          break;
      }
    });

    NetworkManager.onStateChange((state: string) => {
      this._notifyLobby({ state, roomCode: code, latency: 0, guestClass: this._guestClass });
    });

    return code;
  },

  startGame(scene: Phaser.Scene, hostClass: string, guestClass: string): void {
    this._scene = scene;

    CoopManager.activateOnline(guestClass);
    StateSerializer.resetNetworkIds();
    EventBridge.startHostBridge();

    NetworkManager.send({
      type: 'start-game',
      seed: Date.now(),
      hostClass,
      guestClass,
    });

    this._serializationTimer = 0;
  },

  // ---------------------------------------------------------------------------
  // Guest flow
  // ---------------------------------------------------------------------------

  async joinGame(code: string, guestClass: string): Promise<void> {
    await NetworkManager.joinRoom(code);
    this._roomCode = code;

    NetworkManager.send({ type: 'class-select', classType: guestClass });

    NetworkManager.onMessage((msg: NetworkMessage) => {
      switch (msg.type) {
        case 'state':
          this._latestSnapshot = msg.data;
          window.dispatchEvent(new CustomEvent('online-state-update', { detail: msg.data }));
          break;

        case 'event':
          EventBridge.handleRemoteEvent(msg.name, msg.payload);
          break;

        case 'start-game':
          window.dispatchEvent(new CustomEvent('online-game-start', { detail: msg }));
          break;
      }
    });

    // InputForwarder.update() will be called each frame by GuestScene
    EventBridge.startGuestBridge();
  },

  // ---------------------------------------------------------------------------
  // Per-frame update (host only)
  // ---------------------------------------------------------------------------

  update(delta: number): void {
    if (!this._scene || !NetworkManager.isHost() || !NetworkManager.isConnected()) return;

    this._serializationTimer += delta;

    if (this._serializationTimer >= SERIALIZATION_INTERVAL) {
      const snapshot = StateSerializer.serializeGameState(this._scene);
      NetworkManager.send({ type: 'state', data: snapshot });
      this._serializationTimer -= SERIALIZATION_INTERVAL;
    }
  },

  // ---------------------------------------------------------------------------
  // Snapshot access (guest side)
  // ---------------------------------------------------------------------------

  getLatestSnapshot(): GameStateSnapshot | null {
    return this._latestSnapshot;
  },

  // ---------------------------------------------------------------------------
  // Lobby UI callback
  // ---------------------------------------------------------------------------

  onLobbyUpdate(cb: (data: LobbyUpdateData) => void): void {
    this._onLobbyUpdate = cb;
  },

  _notifyLobby(data: LobbyUpdateData): void {
    if (this._onLobbyUpdate) {
      this._onLobbyUpdate(data);
    }
  },

  // ---------------------------------------------------------------------------
  // Teardown
  // ---------------------------------------------------------------------------

  disconnect(): void {
    NetworkManager.disconnect();
    EventBridge.stop();
    RemoteInputAdapter.reset();
    InputForwarder.reset();
    CoopManager.deactivate();
    this._scene = null;
    this._latestSnapshot = null;
    this._guestClass = '';
    this._roomCode = '';
    this._serializationTimer = 0;
    this._onLobbyUpdate = null;
  },

  // ---------------------------------------------------------------------------
  // Connection state helpers
  // ---------------------------------------------------------------------------

  isHosting(): boolean {
    return NetworkManager.isHost();
  },

  isGuest(): boolean {
    return NetworkManager.isGuest();
  },

  isConnected(): boolean {
    return NetworkManager.isConnected();
  },
};
