export interface SubclassDef {
  id: string;
  name: string;
  className: string; // parent class: 'PALADIN' | 'MONK' | 'PRIEST'
  description: string;
  statBonuses: Record<string, number>; // e.g., { attackDamage: 0.25 }
  passiveDescription: string;
  abilityName: string;
  abilityDescription: string;
  abilityCooldown: number; // ms
  icon: string; // emoji or character for UI display
}

export const SUBCLASSES: Record<string, SubclassDef> = {
  crusader: {
    id: 'crusader',
    name: 'Crusader',
    className: 'PALADIN',
    description: 'Offense-focused Paladin who channels holy power into devastating attacks.',
    statBonuses: { attackDamage: 0.25 },
    passiveDescription: 'Attacks have 15% chance to smite (2x damage holy burst).',
    abilityName: 'Holy Charge',
    abilityDescription: 'Dash forward dealing damage to all enemies in path.',
    abilityCooldown: 8000,
    icon: '\u2694',
  },
  templar: {
    id: 'templar',
    name: 'Templar',
    className: 'PALADIN',
    description: 'Defense-focused Paladin with unbreakable faith and iron resolve.',
    statBonuses: {},
    passiveDescription: '+50% block effectiveness. Blocking heals 1 HP.',
    abilityName: 'Divine Shield',
    abilityDescription: '3 seconds of complete invulnerability. 60s cooldown.',
    abilityCooldown: 60000,
    icon: '\uD83D\uDEE1',
  },
  shadow_dancer: {
    id: 'shadow_dancer',
    name: 'Shadow Dancer',
    className: 'MONK',
    description: 'Evasion-focused Monk who fights from the shadows.',
    statBonuses: {},
    passiveDescription: 'Dodge grants 1s invisibility. +30% crit chance from stealth.',
    abilityName: 'Shadow Step',
    abilityDescription: 'Teleport behind the nearest enemy.',
    abilityCooldown: 5000,
    icon: '\uD83C\uDF11',
  },
  iron_fist: {
    id: 'iron_fist',
    name: 'Iron Fist',
    className: 'MONK',
    description: 'Power-focused Monk who channels raw force into every blow.',
    statBonuses: { attackDamage: 0.50 },
    passiveDescription: 'Each consecutive hit deals +10% more damage (stacking).',
    abilityName: 'Quake Punch',
    abilityDescription: 'Ground pound that stuns all grounded enemies.',
    abilityCooldown: 12000,
    icon: '\u270A',
  },
  oracle: {
    id: 'oracle',
    name: 'Oracle',
    className: 'PRIEST',
    description: 'Support-focused Priest who peers beyond the veil of reality.',
    statBonuses: {},
    passiveDescription: 'Sacred Ground radius doubled. Reveals hidden items nearby.',
    abilityName: 'Prophecy',
    abilityDescription: 'Preview the next 3 item choices before they appear.',
    abilityCooldown: 45000,
    icon: '\uD83D\uDD2E',
  },
  inquisitor: {
    id: 'inquisitor',
    name: 'Inquisitor',
    className: 'PRIEST',
    description: 'Damage-focused Priest who delivers divine judgment upon the wicked.',
    statBonuses: { attackDamage: 0.40 },
    passiveDescription: 'Smite enemies below 20% HP (instant kill). Holy damage +40%.',
    abilityName: 'Judgment',
    abilityDescription: 'Beam of light that pierces all enemies in a line.',
    abilityCooldown: 15000,
    icon: '\u2604',
  },
};

export const CLASS_SUBCLASSES: Record<string, [string, string]> = {
  PALADIN: ['crusader', 'templar'],
  MONK: ['shadow_dancer', 'iron_fist'],
  PRIEST: ['oracle', 'inquisitor'],
};
