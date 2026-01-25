import { log } from '../../utils/logger.js';

/**
 * Color palette extraction service
 * Uses node-vibrant for extracting dominant colors from images
 */

// Lazy import vibrant to avoid issues if not installed
let Vibrant = null;

async function getVibrant() {
  if (!Vibrant) {
    try {
      const module = await import('node-vibrant');
      Vibrant = module.default || module.Vibrant;
    } catch {
      log.warn('node-vibrant not installed, using fallback colors');
      return null;
    }
  }
  return Vibrant;
}

/**
 * Default color palette
 */
export const DEFAULT_PALETTE = {
  primary: '#FFD700',      // Gold
  secondary: '#1E3A5F',    // Dark blue
  accent: '#FF6B6B',       // Coral
  background: '#0D1117',   // Dark
  muted: '#6B7280',        // Gray
  light: '#F3F4F6'         // Light gray
};

/**
 * Extract color palette from image buffer
 * @param {Buffer} imageBuffer - Image data
 * @returns {Promise<Object>} Color palette
 */
export async function extractPalette(imageBuffer) {
  const VibrantClass = await getVibrant();

  if (!VibrantClass) {
    log.info('Using default palette (vibrant not available)');
    return DEFAULT_PALETTE;
  }

  try {
    const palette = await VibrantClass.from(imageBuffer).getPalette();

    const result = {
      primary: palette.Vibrant?.hex || DEFAULT_PALETTE.primary,
      secondary: palette.DarkVibrant?.hex || DEFAULT_PALETTE.secondary,
      accent: palette.LightVibrant?.hex || DEFAULT_PALETTE.accent,
      background: palette.DarkMuted?.hex || DEFAULT_PALETTE.background,
      muted: palette.Muted?.hex || DEFAULT_PALETTE.muted,
      light: palette.LightMuted?.hex || DEFAULT_PALETTE.light
    };

    log.info('Palette extracted', { result });

    return result;
  } catch (error) {
    log.error('Palette extraction failed', { error: error.message });
    return DEFAULT_PALETTE;
  }
}

/**
 * Analyze image and extract detailed color information
 * @param {Buffer} imageBuffer - Image data
 * @returns {Promise<Object>} Detailed color analysis
 */
export async function analyzeColors(imageBuffer) {
  const VibrantClass = await getVibrant();

  if (!VibrantClass) {
    return {
      palette: DEFAULT_PALETTE,
      swatches: [],
      dominantColor: DEFAULT_PALETTE.primary
    };
  }

  try {
    const palette = await VibrantClass.from(imageBuffer).getPalette();

    const swatches = Object.entries(palette)
      .filter(([_, swatch]) => swatch)
      .map(([name, swatch]) => ({
        name,
        hex: swatch.hex,
        population: swatch.population,
        rgb: swatch.rgb,
        hsl: swatch.hsl,
        bodyTextColor: swatch.bodyTextColor,
        titleTextColor: swatch.titleTextColor
      }))
      .sort((a, b) => b.population - a.population);

    const dominantColor = swatches[0]?.hex || DEFAULT_PALETTE.primary;

    return {
      palette: await extractPalette(imageBuffer),
      swatches,
      dominantColor
    };
  } catch (error) {
    log.error('Color analysis failed', { error: error.message });
    return {
      palette: DEFAULT_PALETTE,
      swatches: [],
      dominantColor: DEFAULT_PALETTE.primary
    };
  }
}

/**
 * Generate CSS custom properties from palette
 * @param {Object} palette - Color palette
 * @returns {string} CSS custom properties
 */
export function generateCssVariables(palette) {
  return `:root {
  --color-primary: ${palette.primary};
  --color-secondary: ${palette.secondary};
  --color-accent: ${palette.accent};
  --color-background: ${palette.background};
  --color-muted: ${palette.muted};
  --color-light: ${palette.light};
}`;
}

/**
 * Get contrasting text color for background
 * @param {string} hexColor - Background color
 * @returns {string} Text color (black or white)
 */
export function getContrastingColor(hexColor) {
  // Convert hex to RGB
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

/**
 * Generate gradient from palette
 * @param {Object} palette - Color palette
 * @param {string} direction - Gradient direction
 * @returns {string} CSS gradient
 */
export function generateGradient(palette, direction = 'to bottom right') {
  return `linear-gradient(${direction}, ${palette.primary}, ${palette.secondary})`;
}

/**
 * Theme presets based on common slot themes
 */
export const THEME_PRESETS = {
  egyptian: {
    primary: '#C9A227',
    secondary: '#1B1464',
    accent: '#E6C200',
    background: '#0A0A1A'
  },
  greek: {
    primary: '#FFD700',
    secondary: '#1E3A5F',
    accent: '#87CEEB',
    background: '#0D1117'
  },
  asian: {
    primary: '#E31C23',
    secondary: '#C9A227',
    accent: '#FFD700',
    background: '#1A0000'
  },
  jungle: {
    primary: '#FFD700',
    secondary: '#1B4D3E',
    accent: '#8B4513',
    background: '#0A1F0A'
  },
  candy: {
    primary: '#FF69B4',
    secondary: '#4B0082',
    accent: '#FFB6C1',
    background: '#1A0A1A'
  },
  neon: {
    primary: '#00F0FF',
    secondary: '#FF00FF',
    accent: '#FFFF00',
    background: '#0A0A0A'
  },
  classic: {
    primary: '#FF0000',
    secondary: '#000000',
    accent: '#FFD700',
    background: '#1A0A0A'
  },
  ocean: {
    primary: '#00CED1',
    secondary: '#006994',
    accent: '#20B2AA',
    background: '#001A2C'
  }
};

/**
 * Get theme preset by name or detect from slot name
 * @param {string} slotName - Slot name
 * @returns {Object} Theme preset
 */
export function detectTheme(slotName) {
  const name = (slotName || '').toLowerCase();

  if (name.includes('egypt') || name.includes('pharaoh') || name.includes('cleopatra')) {
    return THEME_PRESETS.egyptian;
  }
  if (name.includes('zeus') || name.includes('olympus') || name.includes('greek') || name.includes('god')) {
    return THEME_PRESETS.greek;
  }
  if (name.includes('dragon') || name.includes('fortune') || name.includes('lucky') || name.includes('china')) {
    return THEME_PRESETS.asian;
  }
  if (name.includes('jungle') || name.includes('amazon') || name.includes('safari') || name.includes('gorilla')) {
    return THEME_PRESETS.jungle;
  }
  if (name.includes('candy') || name.includes('sweet') || name.includes('bonanza') || name.includes('fruit')) {
    return THEME_PRESETS.candy;
  }
  if (name.includes('neon') || name.includes('cyber') || name.includes('retro') || name.includes('laser')) {
    return THEME_PRESETS.neon;
  }
  if (name.includes('ocean') || name.includes('fish') || name.includes('sea') || name.includes('pearl')) {
    return THEME_PRESETS.ocean;
  }

  return THEME_PRESETS.classic;
}

export default {
  extractPalette,
  analyzeColors,
  generateCssVariables,
  getContrastingColor,
  generateGradient,
  detectTheme,
  THEME_PRESETS,
  DEFAULT_PALETTE
};
