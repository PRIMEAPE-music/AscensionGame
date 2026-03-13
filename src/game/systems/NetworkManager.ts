// NetworkManager.ts — Core networking singleton wrapping PeerJS for WebRTC peer-to-peer connections.
// Handles room creation/joining, message passing, latency tracking, and reconnection.

import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import type { NetworkMessage, NetworkRole, ConnectionState, RoomInfo } from './NetworkTypes';

const PEER_ID_PREFIX = 'ascension-';
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excludes I, O, 0, 1
const ROOM_CODE_LENGTH = 6;
const CONNECT_TIMEOUT_MS = 10_000;
const PING_INTERVAL_MS = 2_000;

export const NetworkManager = {
    _peer: null as Peer | null,
    _connection: null as DataConnection | null,
    _role: 'none' as NetworkRole,
    _state: 'idle' as ConnectionState,
    _roomCode: '',
    _onMessage: null as ((msg: NetworkMessage) => void) | null,
    _onStateChange: null as ((state: ConnectionState) => void) | null,
    _latency: 0,
    _pingInterval: null as ReturnType<typeof setInterval> | null,
    _reconnectAttempts: 0,
    _maxReconnectAttempts: 3,

    // ============ PUBLIC METHODS ============

    createRoom(): Promise<string> {
        return new Promise((resolve, reject) => {
            // Clean up any previous session
            this.disconnect();

            const code = this._generateRoomCode();
            const peerId = PEER_ID_PREFIX + code;

            this._roomCode = code;
            this._role = 'host';
            this._setState('connecting');

            const peer = new Peer(peerId, { debug: 0 });
            this._peer = peer;

            const timeout = setTimeout(() => {
                peer.destroy();
                this._setState('error');
                reject(new Error('Failed to connect to signaling server within 10s'));
            }, CONNECT_TIMEOUT_MS);

            peer.on('open', () => {
                clearTimeout(timeout);
                // Host is ready, waiting for a guest to connect
                resolve(code);
            });

            peer.on('connection', (conn: DataConnection) => {
                this._connection = conn;
                this._setupConnection(conn);

                conn.on('open', () => {
                    this._setState('connected');
                    this._reconnectAttempts = 0;
                });
            });

            peer.on('error', (err) => {
                console.error('[NetworkManager] PeerJS error:', err);
                clearTimeout(timeout);
                this._setState('error');
                reject(err);
            });
        });
    },

    joinRoom(code: string): Promise<void> {
        return new Promise((resolve, reject) => {
            // Clean up any previous session
            this.disconnect();

            const normalizedCode = code.toUpperCase();
            const hostPeerId = PEER_ID_PREFIX + normalizedCode;

            this._roomCode = normalizedCode;
            this._role = 'guest';
            this._setState('connecting');

            const peer = new Peer({ debug: 0 });
            this._peer = peer;

            const timeout = setTimeout(() => {
                peer.destroy();
                this._setState('error');
                reject(new Error('Failed to connect to host within 10s'));
            }, CONNECT_TIMEOUT_MS);

            peer.on('open', () => {
                const conn = peer.connect(hostPeerId, {
                    reliable: true,
                    serialization: 'json',
                });

                this._connection = conn;
                this._setupConnection(conn);

                conn.on('open', () => {
                    clearTimeout(timeout);
                    this._setState('connected');
                    this._reconnectAttempts = 0;
                    resolve();
                });

                conn.on('error', (err) => {
                    clearTimeout(timeout);
                    console.error('[NetworkManager] Connection error:', err);
                    this._setState('error');
                    reject(err);
                });
            });

            peer.on('error', (err) => {
                console.error('[NetworkManager] PeerJS error:', err);
                clearTimeout(timeout);
                this._setState('error');
                reject(err);
            });
        });
    },

    send(message: NetworkMessage): void {
        if (!this._connection || this._state !== 'connected') return;
        this._connection.send(message);
    },

    onMessage(callback: (msg: NetworkMessage) => void): void {
        this._onMessage = callback;
    },

    onStateChange(callback: (state: ConnectionState) => void): void {
        this._onStateChange = callback;
    },

    disconnect(): void {
        if (this._pingInterval) {
            clearInterval(this._pingInterval);
            this._pingInterval = null;
        }

        if (this._connection) {
            try { this._connection.close(); } catch { /* already closed */ }
            this._connection = null;
        }

        if (this._peer) {
            try { this._peer.destroy(); } catch { /* already destroyed */ }
            this._peer = null;
        }

        this._role = 'none';
        this._state = 'idle';
        this._roomCode = '';
        this._latency = 0;
        this._reconnectAttempts = 0;
        this._onMessage = null;
        this._onStateChange = null;
    },

    getRole(): NetworkRole {
        return this._role;
    },

    getState(): ConnectionState {
        return this._state;
    },

    getRoomCode(): string {
        return this._roomCode;
    },

    getLatency(): number {
        return this._latency;
    },

    isHost(): boolean {
        return this._role === 'host';
    },

    isGuest(): boolean {
        return this._role === 'guest';
    },

    isConnected(): boolean {
        return this._state === 'connected';
    },

    // ============ INTERNAL METHODS ============

    _setState(state: ConnectionState): void {
        this._state = state;
        if (this._onStateChange) {
            this._onStateChange(state);
        }
    },

    _setupConnection(conn: DataConnection): void {
        conn.on('data', (data: unknown) => {
            this._handleMessage(data as NetworkMessage);
        });

        conn.on('close', () => {
            this._handleDisconnect();
        });

        conn.on('error', (err) => {
            console.error('[NetworkManager] Connection error:', err);
            this._handleDisconnect();
        });

        this._startPingLoop();
    },

    _handleMessage(msg: NetworkMessage): void {
        if (msg.type === 'ping') {
            // Respond with pong immediately
            this.send({ type: 'pong', timestamp: msg.timestamp });
            return;
        }

        if (msg.type === 'pong') {
            // Calculate round-trip latency
            this._latency = Date.now() - msg.timestamp;
            return;
        }

        // Forward all other messages to the registered callback
        if (this._onMessage) {
            this._onMessage(msg);
        }
    },

    _startPingLoop(): void {
        if (this._pingInterval) {
            clearInterval(this._pingInterval);
        }

        this._pingInterval = setInterval(() => {
            if (this._state === 'connected') {
                this.send({ type: 'ping', timestamp: Date.now() });
            }
        }, PING_INTERVAL_MS);
    },

    _handleDisconnect(): void {
        if (this._pingInterval) {
            clearInterval(this._pingInterval);
            this._pingInterval = null;
        }

        this._setState('disconnected');

        // Only guests attempt reconnection — host keeps listening for new connections
        if (this._role === 'guest') {
            this._attemptReconnect();
        }
    },

    _attemptReconnect(): void {
        if (this._reconnectAttempts >= this._maxReconnectAttempts) {
            console.error('[NetworkManager] Max reconnect attempts reached');
            this._setState('error');
            return;
        }

        const attempt = this._reconnectAttempts;
        this._reconnectAttempts++;

        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt) * 1000;

        console.log(`[NetworkManager] Reconnect attempt ${attempt + 1}/${this._maxReconnectAttempts} in ${delay}ms`);

        setTimeout(() => {
            // Bail if state changed while waiting (e.g. user called disconnect)
            if (this._state !== 'disconnected' || this._role !== 'guest') return;

            const peer = this._peer;
            if (!peer || peer.destroyed) return;

            const hostPeerId = PEER_ID_PREFIX + this._roomCode;
            const conn = peer.connect(hostPeerId, {
                reliable: true,
                serialization: 'json',
            });

            this._connection = conn;
            this._setState('connecting');

            const timeout = setTimeout(() => {
                // This attempt timed out — try again
                this._handleDisconnect();
            }, CONNECT_TIMEOUT_MS);

            conn.on('open', () => {
                clearTimeout(timeout);
                this._setupConnection(conn);
                this._setState('connected');
                this._reconnectAttempts = 0;
            });

            conn.on('error', () => {
                clearTimeout(timeout);
                this._handleDisconnect();
            });
        }, delay);
    },

    _generateRoomCode(): string {
        let code = '';
        for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
            code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
        }
        return code;
    },
};
