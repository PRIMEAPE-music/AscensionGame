// NetworkTypes.ts — Pure type definitions for the online co-op networking system.
// No runtime code. All messages are sent over WebRTC DataChannel.

/** The role this client plays in a networked session. */
export type NetworkRole = 'host' | 'guest' | 'none';

/** Lifecycle state of the peer connection. */
export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

/**
 * Input snapshot sent from guest to host each frame.
 * Mirrors GamepadState but uses short suffixes (JP = justPressed) for bandwidth.
 */
export interface InputSnapshot {
  frame: number;
  moveX: number;
  moveY: number;
  jump: boolean;
  jumpJP: boolean;
  attackB: boolean;
  attackBJP: boolean;
  attackX: boolean;
  attackXJP: boolean;
  attackY: boolean;
  attackYJP: boolean;
  dodge: boolean;
  dodgeJP: boolean;
  grapple: boolean;
  grappleJP: boolean;
  counterSlash: boolean;
  counterSlashJP: boolean;
  groundSlam: boolean;
  groundSlamJP: boolean;
  cataclysm: boolean;
  cataclysmJP: boolean;
  temporalRift: boolean;
  temporalRiftJP: boolean;
  divineIntervention: boolean;
  divineInterventionJP: boolean;
  essenceBurst: boolean;
  essenceBurstJP: boolean;
}

/** Per-player state included in a full game-state snapshot. */
export interface PlayerSnapshot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  health: number;
  maxHealth: number;
  /** Current animation key. */
  anim: string;
  flipX: boolean;
  isAttacking: boolean;
  isDodging: boolean;
  invincible: boolean;
  classType: string;
  playerIndex: number;
  /** Monk flow meter value. */
  flowMeter?: number;
  /** Whether the Paladin is currently shield-guarding. */
  isShieldGuarding?: boolean;
}

/** Per-enemy state included in a snapshot. */
export interface EnemySnapshot {
  /** Network ID — unique across the session. */
  nid: number;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  /** Enemy type identifier (e.g. "skeleton", "wraith"). */
  type: string;
  anim: string;
  flipX: boolean;
  active: boolean;
  isElite?: boolean;
  affixes?: string[];
}

/** Boss state snapshot. Extends the base enemy snapshot with boss-specific fields. */
export interface BossSnapshot extends EnemySnapshot {
  phase: number;
  bossName: string;
  bossNumber: number;
}

/** Projectile state included in a snapshot. */
export interface ProjectileSnapshot {
  nid: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: string;
}

/** Platform state sent in full snapshots (V1 approach). */
export interface PlatformSnapshot {
  x: number;
  y: number;
  scaleX: number;
  /** Platform type identifier (maps to PlatformType). */
  type: string;
  tint?: number;
}

/** An item drop sitting on the ground. */
export interface ItemDropSnapshot {
  nid: number;
  x: number;
  y: number;
  itemId: string;
}

/**
 * Full authoritative game-state snapshot sent from host to guest.
 * Contains everything the guest needs to render the current frame.
 */
export interface GameStateSnapshot {
  frame: number;
  timestamp: number;
  players: PlayerSnapshot[];
  enemies: EnemySnapshot[];
  boss: BossSnapshot | null;
  projectiles: ProjectileSnapshot[];
  platforms: PlatformSnapshot[];
  itemDrops: ItemDropSnapshot[];
  cameraY: number;
  altitude: number;
  biome: string;
  essence: number;
  comboCount: number;
  comboMultiplier: number;
}

/**
 * Delta snapshot containing only the fields that changed since the last full snapshot.
 * Used for bandwidth optimization (V2+).
 */
export interface DeltaSnapshot {
  frame: number;
  timestamp: number;
  players?: Partial<PlayerSnapshot>[];
  enemies?: Array<{ nid: number } & Partial<EnemySnapshot>>;
  boss?: Partial<BossSnapshot> | null;
  /** Network IDs of enemies that were removed since the last snapshot. */
  removedEnemies?: number[];
  /** Newly spawned enemies not present in the previous snapshot. */
  newEnemies?: EnemySnapshot[];
  cameraY?: number;
  altitude?: number;
  biome?: string;
  essence?: number;
}

/**
 * Discriminated union of every message type sent over the WebRTC DataChannel.
 * Use `message.type` to narrow.
 */
export type NetworkMessage =
  | { type: 'input'; data: InputSnapshot }
  | { type: 'state'; data: GameStateSnapshot }
  | { type: 'delta'; data: DeltaSnapshot }
  | { type: 'event'; name: string; payload: unknown }
  | { type: 'ping'; timestamp: number }
  | { type: 'pong'; timestamp: number }
  | { type: 'class-select'; classType: string }
  | { type: 'ready' }
  | { type: 'start-game'; seed: number; hostClass: string; guestClass: string }
  | { type: 'disconnect'; reason: string }
  | { type: 'chat'; message: string };

/** Information about the current room / lobby session. */
export interface RoomInfo {
  code: string;
  hostPeerId: string;
  role: NetworkRole;
}
