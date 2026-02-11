export interface AnimConfig {
  key: string;
  textureKey: string;
  frameCount: number;
  frameRate: number;
  repeat: number; // -1 = loop, 0 = play once
}

export const SPRITE_CONFIG = {
  FRAME_WIDTH: 92,
  FRAME_HEIGHT: 128,
  BODY_WIDTH: 32,
  BODY_HEIGHT: 48,
  /** Horizontal offset to center 32px body within 92px frame */
  BODY_OFFSET_X: (92 - 32) / 2, // 30
  /** Vertical offset to place body near bottom of 128px frame (8px feet padding) */
  BODY_OFFSET_Y: 128 - 48 - 8, // 72
};

export const ANIMATIONS: AnimConfig[] = [
  {
    key: "monk_idle",
    textureKey: "monk_idle",
    frameCount: 6,
    frameRate: 6,
    repeat: -1,
  },
  {
    key: "monk_run",
    textureKey: "monk_run",
    frameCount: 8,
    frameRate: 12,
    repeat: -1,
  },
  {
    key: "monk_jump",
    textureKey: "monk_jump",
    frameCount: 3,
    frameRate: 8,
    repeat: 0,
  },
  {
    key: "monk_fall",
    textureKey: "monk_fall",
    frameCount: 3,
    frameRate: 6,
    repeat: -1,
  },
  {
    key: "monk_land",
    textureKey: "monk_land",
    frameCount: 3,
    frameRate: 10,
    repeat: 0,
  },
  {
    key: "monk_wall_slide",
    textureKey: "monk_wall_slide",
    frameCount: 3,
    frameRate: 6,
    repeat: -1,
  },
];
