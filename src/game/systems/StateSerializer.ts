import type {
  GameStateSnapshot,
  PlayerSnapshot,
  EnemySnapshot,
  BossSnapshot,
  ProjectileSnapshot,
  PlatformSnapshot,
  ItemDropSnapshot,
} from './NetworkTypes';
import { ComboManager } from './ComboManager';

// ------------------------------------------------------------------ helpers

function serializePlayer(player: any): PlayerSnapshot {
  return {
    x: Math.round(player.x),
    y: Math.round(player.y),
    vx: Math.round(player.body?.velocity?.x ?? 0),
    vy: Math.round(player.body?.velocity?.y ?? 0),
    health: player.health,
    maxHealth: player.maxHealth,
    anim: player.anims?.currentAnim?.key ?? '',
    flipX: player.flipX,
    isAttacking: player.isAttacking ?? false,
    isDodging: player.isDodging ?? false,
    invincible: player._invincible ?? false,
    classType: player.classType ?? '',
    playerIndex: player.playerIndex ?? 0,
    flowMeter: player._flowMeter,
    isShieldGuarding: player._isShieldGuarding,
  };
}

function ensureNetworkId(entity: any, serializer: typeof StateSerializer): number {
  if (!entity._networkId) {
    entity._networkId = serializer._nextNetworkId++;
  }
  return entity._networkId;
}

function serializeEnemy(enemy: any): EnemySnapshot {
  return {
    nid: enemy._networkId ?? 0,
    x: Math.round(enemy.x),
    y: Math.round(enemy.y),
    health: enemy.health ?? 0,
    maxHealth: enemy.maxHealth ?? 0,
    type: enemy.constructor?.name ?? 'Enemy',
    anim: enemy.anims?.currentAnim?.key ?? '',
    flipX: enemy.flipX ?? false,
    active: enemy.active ?? false,
    isElite: enemy.isElite,
    affixes: enemy.eliteAffixes,
  };
}

function serializeBoss(boss: any): BossSnapshot {
  return {
    ...serializeEnemy(boss),
    phase: boss._currentPhase ?? 1,
    bossName: boss._bossName ?? 'Boss',
    bossNumber: boss._bossNumber ?? 1,
  };
}

function serializePlatform(plat: any): PlatformSnapshot {
  return {
    x: Math.round(plat.x),
    y: Math.round(plat.y),
    scaleX: plat.scaleX ?? 1,
    type: plat.getData?.('type') ?? 'STANDARD',
    tint: plat.tintTopLeft,
  };
}

// ------------------------------------------------------------------ singleton

export const StateSerializer = {
  _nextNetworkId: 1,
  _frameCounter: 0,

  // -------------------------------------------------------------- serialise

  /**
   * Read the current MainScene state and produce a compact snapshot that can
   * be sent to the guest over the WebRTC DataChannel.
   */
  serializeGameState(scene: Phaser.Scene): GameStateSnapshot {
    const s = scene as any;

    // --- Players ---
    const players: PlayerSnapshot[] = [];
    if (s.player) {
      players.push(serializePlayer(s.player));
    }
    if (s.player2) {
      players.push(serializePlayer(s.player2));
    }

    // --- Camera ---
    const cameraY = scene.cameras.main.scrollY;
    const cameraTop = cameraY - 500;
    const cameraBottom = cameraY + scene.cameras.main.height + 500;

    // --- Enemies ---
    const enemies: EnemySnapshot[] = [];
    const enemyChildren: any[] = s.enemies?.getChildren?.() ?? [];
    for (const enemy of enemyChildren) {
      // Skip inactive enemies unless they are a boss
      if (!enemy.active && !enemy._bossName) continue;
      ensureNetworkId(enemy, this);
      enemies.push(serializeEnemy(enemy));
    }

    // --- Boss ---
    let boss: BossSnapshot | null = null;
    const currentBoss = s.bossArenaManager?.getCurrentBoss?.();
    if (currentBoss) {
      ensureNetworkId(currentBoss, this);
      boss = serializeBoss(currentBoss);
    }

    // --- Projectiles ---
    const projectiles: ProjectileSnapshot[] = [];
    const projChildren: any[] = s.projectiles?.getChildren?.() ?? [];
    for (const proj of projChildren) {
      if (!proj.active) continue;
      ensureNetworkId(proj, this);
      projectiles.push({
        nid: proj._networkId,
        x: Math.round(proj.x),
        y: Math.round(proj.y),
        vx: Math.round(proj.body?.velocity?.x ?? 0),
        vy: Math.round(proj.body?.velocity?.y ?? 0),
        type: proj._type ?? proj.constructor?.name ?? 'Projectile',
      });
    }

    // --- Platforms (only those within camera view +/- 500px) ---
    const platforms: PlatformSnapshot[] = [];
    const platChildren: any[] = s.staticPlatforms?.getChildren?.() ?? [];
    for (const plat of platChildren) {
      if (plat.y < cameraTop || plat.y > cameraBottom) continue;
      platforms.push(serializePlatform(plat));
    }

    // --- Item drops ---
    const itemDrops: ItemDropSnapshot[] = [];
    const dropChildren: any[] = s.itemDrops?.getChildren?.() ?? [];
    for (const drop of dropChildren) {
      if (!drop.active) continue;
      ensureNetworkId(drop, this);
      itemDrops.push({
        nid: drop._networkId,
        x: Math.round(drop.x),
        y: Math.round(drop.y),
        itemId: drop._itemId ?? drop.itemId ?? '',
      });
    }

    // --- Combo ---
    const comboCount = ComboManager._count;
    const comboMultiplier = ComboManager._multiplier;

    this._frameCounter++;

    return {
      frame: this._frameCounter,
      timestamp: Date.now(),
      players,
      enemies,
      boss,
      projectiles,
      platforms,
      itemDrops,
      cameraY,
      altitude: s._currentAltitude ?? 0,
      biome: s._currentBiome ?? 'DEPTHS',
      essence: s._essence ?? 0,
      comboCount,
      comboMultiplier,
    };
  },

  // ------------------------------------------------------------ deserialise

  /**
   * Apply a received snapshot to a GuestScene, updating or creating sprites
   * as needed.  This is a stub — the GuestScene will handle rendering details.
   */
  deserializeToScene(_snapshot: GameStateSnapshot, _scene: Phaser.Scene): void {
    // Stub: GuestScene implements the full rendering logic.
    // This method is reserved for future shared deserialization helpers.
  },

  // ----------------------------------------------------------- network IDs

  /**
   * Assign a monotonically increasing `_networkId` to a game entity.
   * Call this whenever a new entity is spawned during a networked session.
   */
  assignNetworkId(entity: any): void {
    entity._networkId = this._nextNetworkId++;
  },

  /**
   * Reset the network ID counter to 1.
   * Called at the start of each new game / session.
   */
  resetNetworkIds(): void {
    this._nextNetworkId = 1;
    this._frameCounter = 0;
  },

  // --------------------------------------------------------------- metrics

  /**
   * Return the approximate byte size of a snapshot when JSON-stringified.
   * Useful for debugging and bandwidth monitoring.
   */
  getSnapshotSize(snapshot: GameStateSnapshot): number {
    return JSON.stringify(snapshot).length;
  },
};
