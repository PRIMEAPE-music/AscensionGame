export const PHYSICS = {
  GRAVITY: 1000,
  MOVE_SPEED: 200,
  JUMP_FORCE: -500,
  WALL_SLIDE_SPEED: 100,
  WALL_JUMP: { x: 300, y: -500 },
  COYOTE_TIME: 100,
  JUMP_BUFFER: 150,
  GROUND_DRAG: 1200,
  AIR_DRAG: 200,
  ACCELERATION: 1000,
  JUMP_HOLD_FORCE: -10,
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
