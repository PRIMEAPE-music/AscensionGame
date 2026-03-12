/**
 * ColorblindFilter — applies CSS SVG filter overlays to the game canvas
 * to correct/simulate colorblindness, and provides programmatic color
 * adjustment utilities.
 */

export type ColorblindMode = 'NONE' | 'DEUTERANOPIA' | 'PROTANOPIA' | 'TRITANOPIA';

// ── Color correction matrices ────────────────────────────────────────
// These are 5x4 feColorMatrix values that shift the colour space so that
// colours that would otherwise be indistinguishable become differentiable.
// Values sourced from established colorblind simulation/correction research.

const COLOR_MATRICES: Record<Exclude<ColorblindMode, 'NONE'>, string> = {
  // Deuteranopia — red-green (most common, ~6% of males)
  // Shifts greens toward blue so they separate from reds
  DEUTERANOPIA: [
    0.625, 0.375, 0,     0, 0,
    0.7,   0.3,   0,     0, 0,
    0,     0.3,   0.7,   0, 0,
    0,     0,     0,     1, 0,
  ].join(' '),

  // Protanopia — red-green (less common, ~1% of males)
  // Shifts reds toward yellow/blue
  PROTANOPIA: [
    0.567, 0.433, 0,     0, 0,
    0.558, 0.442, 0,     0, 0,
    0,     0.242, 0.758, 0, 0,
    0,     0,     0,     1, 0,
  ].join(' '),

  // Tritanopia — blue-yellow (rare, <0.01%)
  // Shifts blues toward red/green
  TRITANOPIA: [
    0.95,  0.05,  0,     0, 0,
    0,     0.433, 0.567, 0, 0,
    0,     0.475, 0.525, 0, 0,
    0,     0,     0,     1, 0,
  ].join(' '),
};

// ── SVG filter ID management ─────────────────────────────────────────
const SVG_FILTER_ID = 'ascension-colorblind-filter';
const SVG_CONTAINER_ID = 'ascension-colorblind-svg';

function ensureSVGFilter(mode: Exclude<ColorblindMode, 'NONE'>): string {
  // Remove any existing SVG container
  const existing = document.getElementById(SVG_CONTAINER_ID);
  if (existing) existing.remove();

  const matrix = COLOR_MATRICES[mode];
  const svgNS = 'http://www.w3.org/2000/svg';

  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('id', SVG_CONTAINER_ID);
  svg.setAttribute('xmlns', svgNS);
  svg.style.position = 'absolute';
  svg.style.width = '0';
  svg.style.height = '0';
  svg.style.overflow = 'hidden';
  svg.style.pointerEvents = 'none';

  const defs = document.createElementNS(svgNS, 'defs');
  const filter = document.createElementNS(svgNS, 'filter');
  filter.setAttribute('id', SVG_FILTER_ID);
  filter.setAttribute('color-interpolation-filters', 'linearRGB');

  const feColorMatrix = document.createElementNS(svgNS, 'feColorMatrix');
  feColorMatrix.setAttribute('type', 'matrix');
  feColorMatrix.setAttribute('values', matrix);

  filter.appendChild(feColorMatrix);
  defs.appendChild(filter);
  svg.appendChild(defs);
  document.body.appendChild(svg);

  return `url(#${SVG_FILTER_ID})`;
}

// ── Safe color palettes per mode ─────────────────────────────────────
// These provide replacement colors that remain distinguishable under
// each type of colorblindness.

interface SafePalette {
  healthBar: number;        // Health bar fill
  damageNumber: number;     // Floating damage text
  critDamageNumber: number; // Critical hit damage text
  bossWarning: number;      // Boss warning flash / text
  rarityGold: number;       // Gold item rarity
  raritySilver: number;     // Silver item rarity
  rarityDamaged: number;    // Damaged item rarity
}

const DEFAULT_PALETTE: SafePalette = {
  healthBar: 0xff3333,
  damageNumber: 0xffffff,
  critDamageNumber: 0xffff00,
  bossWarning: 0xff0000,
  rarityGold: 0xffd700,
  raritySilver: 0xc0c0c0,
  rarityDamaged: 0x8b4513,
};

const SAFE_PALETTES: Record<ColorblindMode, SafePalette> = {
  NONE: DEFAULT_PALETTE,

  DEUTERANOPIA: {
    healthBar: 0xff6644,      // Orange-red (avoids green confusion)
    damageNumber: 0xffffff,
    critDamageNumber: 0x44ddff, // Cyan instead of yellow (distinguishable from red)
    bossWarning: 0xff6644,
    rarityGold: 0xffaa00,      // Deeper orange-gold
    raritySilver: 0xaaccff,    // Light blue-silver (distinct from gold)
    rarityDamaged: 0x886644,
  },

  PROTANOPIA: {
    healthBar: 0xee7722,      // Orange (since reds appear darker)
    damageNumber: 0xffffff,
    critDamageNumber: 0x44ddff, // Cyan
    bossWarning: 0xee7722,
    rarityGold: 0xffbb22,
    raritySilver: 0xaaccff,
    rarityDamaged: 0x997755,
  },

  TRITANOPIA: {
    healthBar: 0xff4444,      // Red stays visible
    damageNumber: 0xffffff,
    critDamageNumber: 0xff88cc, // Pink instead of yellow (blue-yellow confused)
    bossWarning: 0xff4444,
    rarityGold: 0xffcc44,
    raritySilver: 0xdddddd,
    rarityDamaged: 0xcc6644,   // Reddish-brown (distinct from blue-shifted items)
  },
};

// ── Programmatic color adjustment ────────────────────────────────────
// Applies the color matrix to a single hex color (0xRRGGBB) and returns
// the adjusted color.

function matrixMultiplyColor(r: number, g: number, b: number, matrixStr: string): [number, number, number] {
  const m = matrixStr.split(/\s+/).map(Number);
  // Matrix is 4 rows x 5 cols (feColorMatrix format)
  // [r'] = m[0]*r + m[1]*g + m[2]*b + m[3]*a + m[4]
  // [g'] = m[5]*r + m[6]*g + m[7]*b + m[8]*a + m[9]
  // [b'] = m[10]*r + m[11]*g + m[12]*b + m[13]*a + m[14]
  // We assume a = 1 for opaque colours
  const rr = Math.min(1, Math.max(0, m[0] * r + m[1] * g + m[2] * b + m[3] * 1 + m[4]));
  const gg = Math.min(1, Math.max(0, m[5] * r + m[6] * g + m[7] * b + m[8] * 1 + m[9]));
  const bb = Math.min(1, Math.max(0, m[10] * r + m[11] * g + m[12] * b + m[13] * 1 + m[14]));
  return [rr, gg, bb];
}

// ── Public API ───────────────────────────────────────────────────────

export const ColorblindFilter = {
  /**
   * Apply the colorblind correction filter to an HTML element (typically the game canvas).
   * If mode is 'NONE', any existing filter is removed.
   */
  applyFilter(element: HTMLElement, mode: ColorblindMode): void {
    if (mode === 'NONE') {
      this.removeFilter(element);
      return;
    }
    const filterUrl = ensureSVGFilter(mode);
    element.style.filter = filterUrl;
  },

  /**
   * Remove any colorblind filter from the given element.
   */
  removeFilter(element: HTMLElement): void {
    element.style.filter = '';
    const svg = document.getElementById(SVG_CONTAINER_ID);
    if (svg) svg.remove();
  },

  /**
   * Get a programmatically adjusted color for the given mode.
   * Input and output are Phaser-style hex numbers (0xRRGGBB).
   */
  getAdjustedColor(hexColor: number, mode: ColorblindMode): number {
    if (mode === 'NONE') return hexColor;

    const r = ((hexColor >> 16) & 0xff) / 255;
    const g = ((hexColor >> 8) & 0xff) / 255;
    const b = (hexColor & 0xff) / 255;

    const matrix = COLOR_MATRICES[mode];
    const [rr, gg, bb] = matrixMultiplyColor(r, g, b, matrix);

    const ri = Math.round(rr * 255);
    const gi = Math.round(gg * 255);
    const bi = Math.round(bb * 255);

    return (ri << 16) | (gi << 8) | bi;
  },

  /**
   * Get the safe color palette for a given mode.
   */
  getSafePalette(mode: ColorblindMode): SafePalette {
    return SAFE_PALETTES[mode];
  },

  /**
   * Get all available colorblind modes.
   */
  getModes(): ColorblindMode[] {
    return ['NONE', 'DEUTERANOPIA', 'PROTANOPIA', 'TRITANOPIA'];
  },

  /**
   * Get a human-readable label for each mode.
   */
  getModeLabel(mode: ColorblindMode): string {
    const labels: Record<ColorblindMode, string> = {
      NONE: 'None',
      DEUTERANOPIA: 'Deuteranopia',
      PROTANOPIA: 'Protanopia',
      TRITANOPIA: 'Tritanopia',
    };
    return labels[mode];
  },

  /**
   * Get a short description for each mode.
   */
  getModeDescription(mode: ColorblindMode): string {
    const descriptions: Record<ColorblindMode, string> = {
      NONE: 'No color correction',
      DEUTERANOPIA: 'Red-green (most common)',
      PROTANOPIA: 'Red-green',
      TRITANOPIA: 'Blue-yellow',
    };
    return descriptions[mode];
  },

  /**
   * Get a set of preview colors for displaying a swatch strip.
   * Returns an array of { label, defaultHex, adjustedHex } for the current mode.
   */
  getPreviewSwatches(mode: ColorblindMode): { label: string; hex: string }[] {
    const palette = SAFE_PALETTES[mode];
    return [
      { label: 'Health', hex: '#' + palette.healthBar.toString(16).padStart(6, '0') },
      { label: 'Damage', hex: '#' + palette.damageNumber.toString(16).padStart(6, '0') },
      { label: 'Crit', hex: '#' + palette.critDamageNumber.toString(16).padStart(6, '0') },
      { label: 'Warning', hex: '#' + palette.bossWarning.toString(16).padStart(6, '0') },
      { label: 'Gold', hex: '#' + palette.rarityGold.toString(16).padStart(6, '0') },
      { label: 'Silver', hex: '#' + palette.raritySilver.toString(16).padStart(6, '0') },
      { label: 'Damaged', hex: '#' + palette.rarityDamaged.toString(16).padStart(6, '0') },
    ];
  },
};
