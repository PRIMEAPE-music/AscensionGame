export enum PlatformType {
  STANDARD = "standard",
  MOVING = "moving",
  BREAKABLE = "breakable",
  ICE = "ice",
  STICKY = "sticky",
  BOUNCE = "bounce",
  SLOPE_LEFT = "slope_left",
  SLOPE_RIGHT = "slope_right",
}

export interface PlatformDef {
  type: PlatformType;
  color: number;
  friction?: number;
  speedMult?: number;
  jumpMult?: number;
  breakable?: boolean;
  slopeAngle?: number;
}

export const PLATFORM_DEFS: Record<PlatformType, PlatformDef> = {
  [PlatformType.STANDARD]: {
    type: PlatformType.STANDARD,
    color: 0x00ff00,
  },
  [PlatformType.MOVING]: {
    type: PlatformType.MOVING,
    color: 0x00ffff,
  },
  [PlatformType.BREAKABLE]: {
    type: PlatformType.BREAKABLE,
    color: 0xff4444,
    breakable: true,
  },
  [PlatformType.ICE]: {
    type: PlatformType.ICE,
    color: 0x88ccff,
    friction: 0.05,
    speedMult: 1.0,
  },
  [PlatformType.STICKY]: {
    type: PlatformType.STICKY,
    color: 0x88ff44,
    speedMult: 0.4,
    jumpMult: 1.3,
  },
  [PlatformType.BOUNCE]: {
    type: PlatformType.BOUNCE,
    color: 0xff88ff,
    jumpMult: 2.0,
  },
  [PlatformType.SLOPE_LEFT]: {
    type: PlatformType.SLOPE_LEFT,
    color: 0xffaa44,
    slopeAngle: 30,
  },
  [PlatformType.SLOPE_RIGHT]: {
    type: PlatformType.SLOPE_RIGHT,
    color: 0xffaa44,
    slopeAngle: 30,
  },
};

export interface BiomePlatformWeights {
  standard: number;
  moving: number;
  breakable: number;
  ice: number;
  sticky: number;
  bounce: number;
  slope: number;
}

export const BIOME_PLATFORM_WEIGHTS: Record<string, BiomePlatformWeights> = {
  DEPTHS: {
    standard: 0.6,
    moving: 0.1,
    breakable: 0.1,
    ice: 0,
    sticky: 0.1,
    bounce: 0.05,
    slope: 0.05,
  },
  CAVERNS: {
    standard: 0.3,
    moving: 0.15,
    breakable: 0.15,
    ice: 0.1,
    sticky: 0.1,
    bounce: 0.05,
    slope: 0.15,
  },
  SPIRE: {
    standard: 0.2,
    moving: 0.2,
    breakable: 0.1,
    ice: 0.15,
    sticky: 0.05,
    bounce: 0.1,
    slope: 0.2,
  },
  SUMMIT: {
    standard: 0.1,
    moving: 0.25,
    breakable: 0.15,
    ice: 0.2,
    sticky: 0.05,
    bounce: 0.1,
    slope: 0.15,
  },
};
