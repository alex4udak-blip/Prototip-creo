/**
 * Palette Service Tests
 *
 * Tests for color palette extraction and theme detection.
 */

import { jest } from '@jest/globals';

// Mock node-vibrant
jest.unstable_mockModule('node-vibrant', () => ({
  default: {
    from: jest.fn(() => ({
      getPalette: jest.fn().mockResolvedValue({
        Vibrant: { hex: '#FF0000' },
        DarkVibrant: { hex: '#880000' },
        LightVibrant: { hex: '#FF8888' },
        DarkMuted: { hex: '#1a1a1a' },
        Muted: { hex: '#666666' },
        LightMuted: { hex: '#cccccc' }
      })
    }))
  }
}));

jest.unstable_mockModule('../src/utils/logger.js', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

// Import after mocking
const {
  extractPalette,
  generateCssVariables,
  getContrastingColor,
  generateGradient,
  detectTheme,
  THEME_PRESETS,
  DEFAULT_PALETTE
} = await import('../src/services/landing/palette.service.js');

describe('Palette Service', () => {
  describe('DEFAULT_PALETTE', () => {
    it('should have all required colors', () => {
      expect(DEFAULT_PALETTE.primary).toBeDefined();
      expect(DEFAULT_PALETTE.secondary).toBeDefined();
      expect(DEFAULT_PALETTE.accent).toBeDefined();
      expect(DEFAULT_PALETTE.background).toBeDefined();
    });
  });

  describe('THEME_PRESETS', () => {
    it('should have multiple presets', () => {
      expect(Object.keys(THEME_PRESETS).length).toBeGreaterThan(5);
      expect(THEME_PRESETS.egyptian).toBeDefined();
      expect(THEME_PRESETS.greek).toBeDefined();
      expect(THEME_PRESETS.asian).toBeDefined();
    });

    it('should have valid hex colors in each preset', () => {
      const hexRegex = /^#[0-9A-Fa-f]{6}$/;

      for (const [name, preset] of Object.entries(THEME_PRESETS)) {
        expect(preset.primary).toMatch(hexRegex);
        expect(preset.secondary).toMatch(hexRegex);
        expect(preset.accent).toMatch(hexRegex);
        expect(preset.background).toMatch(hexRegex);
      }
    });
  });

  describe('extractPalette', () => {
    it('should extract palette from image buffer', async () => {
      const fakeBuffer = Buffer.from('fake image data');
      const palette = await extractPalette(fakeBuffer);

      expect(palette.primary).toBe('#FF0000');
      expect(palette.secondary).toBe('#880000');
      expect(palette.background).toBe('#1a1a1a');
    });
  });

  describe('generateCssVariables', () => {
    it('should generate valid CSS custom properties', () => {
      const css = generateCssVariables(DEFAULT_PALETTE);

      expect(css).toContain(':root {');
      expect(css).toContain('--color-primary:');
      expect(css).toContain('--color-secondary:');
      expect(css).toContain('--color-accent:');
      expect(css).toContain('--color-background:');
      expect(css).toContain('}');
    });
  });

  describe('getContrastingColor', () => {
    it('should return white for dark backgrounds', () => {
      expect(getContrastingColor('#000000')).toBe('#FFFFFF');
      expect(getContrastingColor('#1a1a1a')).toBe('#FFFFFF');
      expect(getContrastingColor('#333333')).toBe('#FFFFFF');
    });

    it('should return black for light backgrounds', () => {
      expect(getContrastingColor('#FFFFFF')).toBe('#000000');
      expect(getContrastingColor('#EEEEEE')).toBe('#000000');
      expect(getContrastingColor('#CCCCCC')).toBe('#000000');
    });

    it('should handle mid-range colors', () => {
      const result = getContrastingColor('#808080');
      expect(['#000000', '#FFFFFF']).toContain(result);
    });
  });

  describe('generateGradient', () => {
    it('should generate valid CSS gradient', () => {
      const gradient = generateGradient(DEFAULT_PALETTE);

      expect(gradient).toContain('linear-gradient');
      expect(gradient).toContain(DEFAULT_PALETTE.primary);
      expect(gradient).toContain(DEFAULT_PALETTE.secondary);
    });

    it('should respect custom direction', () => {
      const gradient = generateGradient(DEFAULT_PALETTE, 'to right');

      expect(gradient).toContain('to right');
    });
  });

  describe('detectTheme', () => {
    it('should detect Egyptian theme', () => {
      expect(detectTheme('Egyptian Riches')).toEqual(THEME_PRESETS.egyptian);
      expect(detectTheme('Cleopatra Slots')).toEqual(THEME_PRESETS.egyptian);
      expect(detectTheme('Pharaohs Fortune')).toEqual(THEME_PRESETS.egyptian);
    });

    it('should detect Greek theme', () => {
      expect(detectTheme('Gates of Olympus')).toEqual(THEME_PRESETS.greek);
      expect(detectTheme('Rise of Zeus')).toEqual(THEME_PRESETS.greek);
      expect(detectTheme('Greek Gods Slot')).toEqual(THEME_PRESETS.greek);
    });

    it('should detect Asian theme', () => {
      expect(detectTheme('Dragon King')).toEqual(THEME_PRESETS.asian);
      expect(detectTheme('Fortune Tiger')).toEqual(THEME_PRESETS.asian);
      expect(detectTheme('Lucky Money')).toEqual(THEME_PRESETS.asian);
    });

    it('should detect Candy theme', () => {
      expect(detectTheme('Sweet Bonanza')).toEqual(THEME_PRESETS.candy);
      expect(detectTheme('Candy Land')).toEqual(THEME_PRESETS.candy);
      expect(detectTheme('Fruit Party')).toEqual(THEME_PRESETS.candy);
    });

    it('should detect Jungle theme', () => {
      expect(detectTheme('Gorilla Gold')).toEqual(THEME_PRESETS.jungle);
      expect(detectTheme('Amazon Safari')).toEqual(THEME_PRESETS.jungle);
      expect(detectTheme('Jungle Spirit')).toEqual(THEME_PRESETS.jungle);
    });

    it('should detect Ocean theme', () => {
      expect(detectTheme('Pearl Dive')).toEqual(THEME_PRESETS.ocean);
      expect(detectTheme('Ocean Treasure')).toEqual(THEME_PRESETS.ocean);
      expect(detectTheme('Sea Fishing')).toEqual(THEME_PRESETS.ocean);
    });

    it('should return classic for unknown themes', () => {
      expect(detectTheme('Random Unknown Slot')).toEqual(THEME_PRESETS.classic);
      expect(detectTheme('')).toEqual(THEME_PRESETS.classic);
    });

    it('should be case insensitive', () => {
      expect(detectTheme('GATES OF OLYMPUS')).toEqual(THEME_PRESETS.greek);
      expect(detectTheme('gates of olympus')).toEqual(THEME_PRESETS.greek);
      expect(detectTheme('GaTeS oF OlYmPuS')).toEqual(THEME_PRESETS.greek);
    });
  });
});
