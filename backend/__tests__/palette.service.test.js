/**
 * Palette Service Tests
 *
 * Tests for color palette extraction and theme presets.
 * NOTE: Several functions were removed (analyzeColors, generateCssVariables,
 * getContrastingColor, generateGradient, detectTheme) as they were not used
 * in production. Tests for those functions were also removed.
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
});
