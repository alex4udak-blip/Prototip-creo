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

// NOTE: The following functions were removed as they are not used in production:
// - analyzeColors() - exported but never imported
// - generateCssVariables() - exported but never imported
// - getContrastingColor() - exported but never imported
// - generateGradient() - exported but never imported
// - detectTheme() - exported but never imported
// They remain available in git history if needed for future features.

/**
 * Theme presets based on common slot themes
 * Kept for reference - Claude uses these names in analysis
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

export default {
  extractPalette,
  THEME_PRESETS,
  DEFAULT_PALETTE
};
