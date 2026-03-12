const COOP_ENEMY_HP_MULT = 1.5;
const COOP_BOSS_HP_MULT = 1.75;

export const CoopManager = {
  _active: false,
  _player2Class: '' as string,

  activate(player2Class: string): void {
    this._active = true;
    this._player2Class = player2Class;
  },

  deactivate(): void {
    this._active = false;
    this._player2Class = '';
  },

  isActive(): boolean {
    return this._active;
  },

  getPlayer2Class(): string {
    return this._player2Class;
  },

  getEnemyHPMultiplier(): number {
    return this._active ? COOP_ENEMY_HP_MULT : 1.0;
  },

  getBossHPMultiplier(): number {
    return this._active ? COOP_BOSS_HP_MULT : 1.0;
  },

  /** Respawn delay in ms */
  getRespawnDelay(): number {
    return 5000;
  },

  /** Invincibility after respawn in ms */
  getRespawnInvincibility(): number {
    return 3000;
  },
};
