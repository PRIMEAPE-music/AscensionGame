import { Enemy } from '../entities/Enemy';

/**
 * Elite affixes that can be randomly assigned to elite enemy variants.
 * Each affix grants a unique combat modifier to the enemy.
 */
export enum EliteAffix {
  SHIELDED = 'SHIELDED',
  TELEPORTING = 'TELEPORTING',
  VAMPIRIC = 'VAMPIRIC',
  BERSERKER = 'BERSERKER',
  SPLITTING = 'SPLITTING',
  REFLECTIVE = 'REFLECTIVE',
  FREEZING = 'FREEZING',
  EXPLOSIVE = 'EXPLOSIVE',
}

// All affixes in an array for random selection
const ALL_AFFIXES = Object.values(EliteAffix);

// ── Configuration ────────────────────────────────────────────────────────
const ELITE_MIN_ALTITUDE = 500;
const ELITE_BASE_CHANCE = 0.08;        // 8% base chance
const ELITE_CHANCE_PER_500M = 0.01;    // +1% per 500m
const ELITE_MAX_CHANCE = 0.20;          // Cap at 20%
const DOUBLE_AFFIX_ALTITUDE = 3000;    // 2 affixes at 3000m+

// Stat multipliers
const ELITE_HP_MULT = 3;
const ELITE_DAMAGE_MULT = 1.5;
const ELITE_SPEED_MULT = 1.25;
const ELITE_SCALE_MULT = 1.5;
const ELITE_TINT = 0xff4466;           // Reddish-purple glow

/**
 * Manages elite enemy variant spawning, affix assignment, and behavior.
 */
export const EliteManager = {
  /**
   * Determines whether a normal enemy spawn should be replaced with an elite.
   * - Only triggers at altitude 500m+
   * - 8% base chance, +1% per 500m above minimum, capped at 20%
   * - Never during boss fights
   */
  shouldSpawnElite(altitude: number, isBossFight: boolean): boolean {
    if (isBossFight) return false;
    if (altitude < ELITE_MIN_ALTITUDE) return false;

    const altitudeAboveMin = altitude - ELITE_MIN_ALTITUDE;
    const bonusChance = Math.floor(altitudeAboveMin / 500) * ELITE_CHANCE_PER_500M;
    const totalChance = Math.min(ELITE_BASE_CHANCE + bonusChance, ELITE_MAX_CHANCE);

    return Math.random() < totalChance;
  },

  /**
   * Rolls random affixes for an elite enemy.
   * - 1 affix normally
   * - 2 affixes at altitude 3000m+
   * - No duplicate affixes
   */
  rollAffixes(altitude: number): EliteAffix[] {
    const count = altitude >= DOUBLE_AFFIX_ALTITUDE ? 2 : 1;
    const available = [...ALL_AFFIXES];
    const result: EliteAffix[] = [];

    for (let i = 0; i < count && available.length > 0; i++) {
      const idx = Math.floor(Math.random() * available.length);
      result.push(available[idx]);
      available.splice(idx, 1);
    }

    return result;
  },

  /**
   * Applies elite status and affixes to an enemy instance.
   * Boosts stats, adds visual effects, and stores affix data on the enemy.
   */
  applyEliteStatus(enemy: Enemy, affixes: EliteAffix[]): void {
    // Mark as elite and store affixes
    enemy.isElite = true;
    enemy.eliteAffixes = affixes;

    // Stat boosts: 3x HP, 1.5x damage, 1.25x speed
    enemy.health = Math.ceil(enemy.health * ELITE_HP_MULT);
    enemy.maxHealth = Math.ceil(enemy.maxHealth * ELITE_HP_MULT);
    enemy.setEliteDamageMultiplier(ELITE_DAMAGE_MULT);
    enemy.setEliteSpeedMultiplier(ELITE_SPEED_MULT);

    // Scale up by 1.5x
    enemy.setScale(enemy.scaleX * ELITE_SCALE_MULT, enemy.scaleY * ELITE_SCALE_MULT);

    // Reddish-purple glow
    enemy.setTint(ELITE_TINT);
    enemy.setEliteDefaultTint(ELITE_TINT);

    // Pulsing shimmer effect
    if (enemy.scene) {
      enemy.scene.tweens.add({
        targets: enemy,
        alpha: { from: 1.0, to: 0.7 },
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // Initialize affix-specific timers
    if (affixes.includes(EliteAffix.TELEPORTING)) {
      enemy.setAffixTimer('teleport', 4000);
    }
    if (affixes.includes(EliteAffix.BERSERKER)) {
      enemy.setAffixTimer('berserkerActivated', 0); // 0 = not yet triggered
    }

    // Create nameplate text showing affix names
    if (enemy.scene) {
      const affixLabel = affixes.join(' ');
      const nameplate = enemy.scene.add.text(enemy.x, enemy.y - 40, affixLabel, {
        fontSize: '10px',
        color: '#ff4466',
        fontFamily: 'monospace',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5);
      nameplate.setDepth(200);
      enemy.setEliteNameplate(nameplate);
    }
  },
};
