/**
 * Pixabay Service Tests
 *
 * Tests for sound fetching, downloading, and fallback logic.
 * CRITICAL: These tests catch async/await syntax errors that would crash at runtime.
 */

import { jest } from '@jest/globals';

// Mock fetch globally
global.fetch = jest.fn();

// Mock fs/promises for path tests
jest.unstable_mockModule('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  access: jest.fn().mockResolvedValue(undefined),
  default: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
    access: jest.fn().mockResolvedValue(undefined)
  }
}));

// Import service AFTER mocks
const pixabayService = await import('../src/services/pixabay.service.js');

describe('Pixabay Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getFallbackSounds', () => {
    it('should be an async function (CRITICAL - catches await in non-async bug)', async () => {
      // This test catches the bug where getFallbackSounds was not async
      // but used await inside, which would cause a SyntaxError at runtime
      expect(pixabayService.getFallbackSounds).toBeDefined();

      // Must be callable as async
      const result = await pixabayService.getFallbackSounds();

      // Should return object with paths
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
      expect(result).toHaveProperty('spin');
      expect(result).toHaveProperty('win');
    });

    it('should return absolute paths for sound files', async () => {
      const sounds = await pixabayService.getFallbackSounds();

      // Paths should be absolute (start with / on Unix or drive letter on Windows)
      expect(sounds.spin).toMatch(/^(\/|[A-Z]:)/);
      expect(sounds.win).toMatch(/^(\/|[A-Z]:)/);
    });

    it('should return null for optional sounds', async () => {
      const sounds = await pixabayService.getFallbackSounds();

      // click, coins, ambient are optional
      expect(sounds.click).toBeNull();
      expect(sounds.coins).toBeNull();
      expect(sounds.ambient).toBeNull();
    });
  });

  describe('searchSounds', () => {
    it('should return empty array when API key not configured', async () => {
      // API key is not set in test environment
      const results = await pixabayService.searchSounds('test query');
      expect(results).toEqual([]);
    });
  });

  describe('findGameSounds', () => {
    it('should return object with sound categories', async () => {
      const sounds = await pixabayService.findGameSounds('classic');

      expect(sounds).toBeDefined();
      expect(typeof sounds).toBe('object');
      // Should have standard categories (even if null)
      expect('spin' in sounds).toBe(true);
      expect('win' in sounds).toBe(true);
    });

    it('should handle different themes', async () => {
      const themes = ['epic', 'cartoon', 'neon', 'classic'];

      for (const theme of themes) {
        const sounds = await pixabayService.findGameSounds(theme);
        expect(sounds).toBeDefined();
      }
    });
  });

  describe('downloadSound', () => {
    it('should download sound from URL', async () => {
      const mockBuffer = new ArrayBuffer(100);
      global.fetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockBuffer)
      });

      const result = await pixabayService.downloadSound('https://example.com/sound.mp3');

      expect(result).toBeInstanceOf(Buffer);
      expect(global.fetch).toHaveBeenCalledWith('https://example.com/sound.mp3');
    });

    it('should throw on download failure', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      await expect(
        pixabayService.downloadSound('https://example.com/notfound.mp3')
      ).rejects.toThrow('Failed to download sound: 404');
    });
  });

  describe('getGameSoundsWithFallback', () => {
    it('should return fallback sounds when Pixabay returns empty', async () => {
      // Pixabay returns nothing, should fallback to local sounds
      const sounds = await pixabayService.getGameSoundsWithFallback('classic', '/tmp/sounds');

      // Should have at least spin and win from fallback
      expect(sounds).toBeDefined();
      expect(typeof sounds).toBe('object');
    });

    it('should handle null outputDir gracefully', async () => {
      // When outputDir is null, should still return fallback sounds
      const sounds = await pixabayService.getGameSoundsWithFallback('classic', null);

      expect(sounds).toBeDefined();
    });
  });

  describe('Module exports', () => {
    it('should export all required functions', () => {
      const exports = [
        'searchSounds',
        'findGameSounds',
        'downloadSound',
        'getFallbackSounds',
        'downloadAndSaveSounds',
        'getGameSoundsWithFallback'
      ];

      for (const fn of exports) {
        expect(typeof pixabayService[fn]).toBe('function');
      }
    });

    it('should have default export with all functions', () => {
      expect(pixabayService.default).toBeDefined();
      expect(typeof pixabayService.default.getFallbackSounds).toBe('function');
    });
  });
});
