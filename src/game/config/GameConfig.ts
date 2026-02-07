export const PHYSICS = {
  GRAVITY: 1000,
  MOVE_SPEED: 350,
  JUMP_FORCE: -580,
  WALL_SLIDE_SPEED: 80,
  WALL_JUMP: { x: 350, y: -520 },
  COYOTE_TIME: 100,
  JUMP_BUFFER: 150,
  GROUND_DRAG: 600,
  AIR_DRAG: 100,
  ACCELERATION: 1500,
  JUMP_HOLD_FORCE: -15,
  JUMP_HOLD_DURATION: 250,
  DOUBLE_JUMP_MULTIPLIER: 0.8,
} as const;

export const COMBAT = {
  COMBO_WINDOW: 500,
  ATTACK_STUCK_TIMEOUT: 2000,
  HIT_FLASH_DURATION: 200,
  INVINCIBILITY_DURATION: 1000,
  INVINCIBILITY_FLASH_RATE: 100,
  KNOCKBACK_PLAYER: { x: 300, y: -300 },
  KNOCKBACK_ENEMY: { x: 200, y: -200 },
  BASE_DAMAGE: 10,
} as const;

export const WORLD = {
  WIDTH: 1920,
  HEIGHT: 1080,
  WALL_WIDTH: 50,
  BASE_PLATFORM_Y: 1050,
  PLAYER_SPAWN: { x: 960, y: 950 },
  DEATH_PLANE_OFFSET: 1000,
  PLATFORM_CLEANUP_BUFFER: 1500,
  GENERATION_LOOKAHEAD: 1200,
  ALTITUDE_SCALE: 10,
} as const;

export const SPAWNING = {
  MIN_INTERVAL: 5000,
  MAX_INTERVAL: 15000,
  MIN_DISTANCE_FROM_PLAYER: 300,
  MAX_ENEMIES_ON_SCREEN: 8,
  CLEANUP_BUFFER: 2000,
  COMPOSITION: {
    TIER_1: {
      maxAltitude: 1000,
      basic: 0.9,
      intermediate: 0.1,
      advanced: 0,
      elite: 0,
    },
    TIER_2: {
      maxAltitude: 3000,
      basic: 0.7,
      intermediate: 0.25,
      advanced: 0.05,
      elite: 0,
    },
    TIER_3: {
      maxAltitude: 6000,
      basic: 0.4,
      intermediate: 0.4,
      advanced: 0.15,
      elite: 0.05,
    },
    TIER_4: {
      maxAltitude: 9000,
      basic: 0.1,
      intermediate: 0.4,
      advanced: 0.4,
      elite: 0.1,
    },
    TIER_5: {
      maxAltitude: Infinity,
      basic: 0,
      intermediate: 0,
      advanced: 0.5,
      elite: 0.5,
    },
  },
} as const;

export const SLOPES = {
  UPHILL_SPEED_MULT: 0.7,
  DOWNHILL_SPEED_MULT: 1.4,
  LAUNCH_FORCE_MULT: 0.6,
  MIN_LAUNCH_SPEED: 200,
  SLIDE_GRAVITY_MULT: 0.5,
  MAX_SLOPE_ANGLE: 45,
  SNAP_TOLERANCE: 8,
} as const;

export const PLATFORM_CONFIG = {
  ICE_FRICTION: 0.05,
  ICE_ACCEL_MULT: 0.3,
  STICKY_SPEED_MULT: 0.4,
  STICKY_JUMP_MULT: 1.3,
  BOUNCE_FORCE: -800,
  BOUNCE_HORIZONTAL_MULT: 0.3,
} as const;

export const STYLE = {
  DECAY_RATE: 5,
  DECAY_DELAY: 2000,
  MAX_METER: 100,
  SPEED_THRESHOLD: 250,
  SPEED_GAIN: 0.3,
  AIRBORNE_KILL_BONUS: 15,
  MULTI_KILL_BONUS: 25,
  WALL_JUMP_CHAIN_BONUS: 10,
  SLOPE_LAUNCH_BONUS: 20,
  TIER_THRESHOLDS: [0, 25, 50, 75, 90] as readonly number[],
  TIER_NAMES: ["D", "C", "B", "A", "S"] as readonly string[],
  TIER_MULTIPLIERS: [1.0, 1.2, 1.5, 2.0, 3.0] as readonly number[],
} as const;

export const BIOMES = {
  DEPTHS: {
    maxAltitude: 500,
    bg: 0x0a0a1a,
    platform: 0x334455,
    name: "The Depths",
  },
  CAVERNS: {
    maxAltitude: 2000,
    bg: 0x1a0a0a,
    platform: 0x553333,
    name: "Infernal Caverns",
  },
  SPIRE: {
    maxAltitude: 5000,
    bg: 0x0a1a0a,
    platform: 0x335533,
    name: "The Spire",
  },
  SUMMIT: {
    maxAltitude: Infinity,
    bg: 0x1a1a2a,
    platform: 0x555577,
    name: "The Summit",
  },
} as const;
