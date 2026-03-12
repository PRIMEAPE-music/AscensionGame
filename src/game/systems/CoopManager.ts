import type { Player } from "../entities/Player";

const COOP_ENEMY_HP_MULT = 1.5;
const COOP_BOSS_HP_MULT = 1.75;
const BATTLE_BOND_RANGE = 200;
const BATTLE_BOND_DAMAGE_BONUS = 0.15;

export const CoopManager = {
  _active: false,
  _player2Class: '' as string,
  _players: null as Player[] | null,

  activate(player2Class: string): void {
    this._active = true;
    this._player2Class = player2Class;
  },

  deactivate(): void {
    this._active = false;
    this._player2Class = '';
    this._players = null;
  },

  isActive(): boolean {
    return this._active;
  },

  getPlayer2Class(): string {
    return this._player2Class;
  },

  /** Store player references for co-op item checks */
  setPlayers(players: Player[]): void {
    this._players = players;
  },

  getPlayers(): Player[] | null {
    return this._players;
  },

  getEnemyHPMultiplier(): number {
    return this._active ? COOP_ENEMY_HP_MULT : 1.0;
  },

  getBossHPMultiplier(): number {
    return this._active ? COOP_BOSS_HP_MULT : 1.0;
  },

  /**
   * Respawn delay in ms.
   * If either player has rescue_rush, use 2000ms instead of 5000ms.
   */
  getRespawnDelay(): number {
    if (this._players) {
      for (const p of this._players) {
        if (p.abilities.has('rescue_rush')) {
          return 2000;
        }
      }
    }
    return 5000;
  },

  /** Invincibility after respawn in ms */
  getRespawnInvincibility(): number {
    return 3000;
  },

  /**
   * Check if Battle Bond is active for a given player.
   * Returns the damage bonus multiplier (1.0 if not active, 1.15 if active).
   */
  getBattleBondMultiplier(player: Player): number {
    if (!this._active || !this._players || this._players.length < 2) return 1.0;

    // Check if either player has battle_bond
    const hasBattleBond = this._players.some(p => p.abilities.has('battle_bond'));
    if (!hasBattleBond) return 1.0;

    // Check distance between the two players
    const p1 = this._players[0];
    const p2 = this._players[1];
    if (!p1.active || !p2.active) return 1.0;

    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= BATTLE_BOND_RANGE) {
      return 1 + BATTLE_BOND_DAMAGE_BONUS;
    }

    return 1.0;
  },

  /**
   * Get the partner player for a given player.
   */
  getPartner(player: Player): Player | null {
    if (!this._active || !this._players || this._players.length < 2) return null;
    return this._players[0] === player ? this._players[1] : this._players[0];
  },
};
