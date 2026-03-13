// EventBridge.ts — Bridges EventBus events across the network for online co-op.
// On the host, listens for game events and forwards them to the guest.
// On the guest, receives event messages and re-emits them locally.

import { NetworkManager } from './NetworkManager';
import { EventBus } from './EventBus';

/**
 * Events that the host forwards to the guest so the guest's React UI stays in sync.
 */
const BRIDGED_EVENTS: string[] = [
  'boss-spawn',
  'boss-health-change',
  'boss-phase-change',
  'boss-defeated',
  'boss-arena-start',
  'boss-arena-end',
  'boss-enrage',
  'biome-change',
  'shop-open',
  'shop-close',
  'gambling-open',
  'gambling-close',
  'item-replace-prompt',
  'ascension-offer',
  'subclass-offer',
  'player-died',
  'coop-respawn',
  'show-death-screen',
  'health-change',
  'essence-change',
  'combo-update',
  'inventory-change',
  'achievement-unlocked',
  'synergy-activated',
  'finishing-move',
  'parry-success',
  'progress-update',
];

/**
 * Events the guest sends to the host (guest actions the host needs to process).
 */
const GUEST_TO_HOST_EVENTS: string[] = [
  'shop-purchase',
  'item-replace-decision',
  'ascension-chosen',
  'gambling-result',
];

export const EventBridge = {
  _cleanups: [] as (() => void)[],
  _active: false,

  /**
   * Start bridging events on the host side.
   * Call after the network connection is established.
   *
   * For each bridged event, listens via EventBus.on and also via a raw
   * window CustomEvent listener. A per-event send guard prevents duplicate
   * network messages since EventBus.on is implemented on top of
   * window.addEventListener internally.
   */
  startHostBridge(): void {
    this._active = true;

    for (const eventName of BRIDGED_EVENTS) {
      // Guard to deduplicate: EventBus.on uses window.addEventListener under
      // the hood, so an EventBus.emit (which dispatches a CustomEvent on
      // window) would trigger both the EventBus.on handler AND the raw window
      // listener.  The guard ensures we only send once per synchronous event.
      let sending = false;

      const doSend = (data: unknown) => {
        if (sending) return;
        if (!NetworkManager.isConnected()) return;
        sending = true;
        NetworkManager.send({ type: 'event', name: eventName, payload: data });
        // Reset on next microtask so the guard only collapses the same
        // synchronous dispatch, not future ones.
        Promise.resolve().then(() => { sending = false; });
      };

      // Listen via EventBus.on (returns an unsubscribe function)
      const unsub = EventBus.on(eventName as any, (data: unknown) => {
        doSend(data);
      });
      this._cleanups.push(unsub);

      // Also listen via raw window CustomEvent for events that may be
      // dispatched directly on window without going through EventBus.emit.
      const handler = (e: Event) => {
        doSend((e as CustomEvent).detail);
      };
      window.addEventListener(eventName, handler);
      this._cleanups.push(() => window.removeEventListener(eventName, handler));
    }

    // Listen for guest-to-host events coming from the guest side.
    // These are handled via NetworkManager.onMessage in OnlineCoopManager,
    // which calls handleGuestEvent.
  },

  /**
   * Start receiving bridged events on the guest side.
   * NetworkManager.onMessage (set up in OnlineCoopManager) routes incoming
   * messages and calls handleRemoteEvent for 'event' type messages.
   */
  startGuestBridge(): void {
    this._active = true;

    // Forward guest-to-host events from the local EventBus to the host.
    for (const eventName of GUEST_TO_HOST_EVENTS) {
      const unsub = EventBus.on(eventName as any, (data: unknown) => {
        if (!NetworkManager.isConnected()) return;
        NetworkManager.send({ type: 'event', name: eventName, payload: data });
      });
      this._cleanups.push(unsub);
    }
  },

  /**
   * Called on the guest when an event message is received from the host.
   * Re-emits the event locally so the guest UI reacts.
   */
  handleRemoteEvent(name: string, payload: unknown): void {
    EventBus.emit(name as any, payload as any);
    // EventBus.emit already dispatches a CustomEvent on window, so any
    // window-level listeners will also receive this event automatically.
  },

  /**
   * Called on the host when a guest action event is received.
   * Re-emits the event locally so the host game logic processes it.
   */
  handleGuestEvent(name: string, payload: unknown): void {
    EventBus.emit(name as any, payload as any);
  },

  /** Stop all bridging and clean up listeners. */
  stop(): void {
    this._active = false;
    for (const cleanup of this._cleanups) {
      cleanup();
    }
    this._cleanups = [];
  },

  /** Whether bridging is currently active. */
  isActive(): boolean {
    return this._active;
  },
};
