/**
 * Serper Service Tests
 *
 * Tests for the Serper.dev image search integration.
 * Mocks fetch to avoid actual API calls.
 */

import { jest } from '@jest/globals';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock config
jest.unstable_mockModule('../src/config/env.js', () => ({
  config: {
    serperApiKey: 'test-serper-key'
  }
}));

// Mock logger
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
  searchImages,
  searchSlotImages,
  searchSlotInfo,
  downloadImage,
  checkHealth
} = await import('../src/services/serper.service.js');

describe('Serper Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkHealth', () => {
    it('should return configured status', () => {
      const health = checkHealth();
      expect(health.configured).toBe(true);
      expect(health.endpoint).toBe('https://google.serper.dev');
    });
  });

  describe('searchImages', () => {
    it('should search for images', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          images: [
            {
              imageUrl: 'https://example.com/image1.jpg',
              thumbnailUrl: 'https://example.com/thumb1.jpg',
              title: 'Gates of Olympus',
              link: 'https://example.com',
              imageWidth: 1920,
              imageHeight: 1080
            },
            {
              imageUrl: 'https://example.com/image2.jpg',
              thumbnailUrl: 'https://example.com/thumb2.jpg',
              title: 'Zeus Slot',
              link: 'https://example.com',
              imageWidth: 1280,
              imageHeight: 720
            }
          ]
        })
      });

      const images = await searchImages('Gates of Olympus slot', { num: 5 });

      expect(images).toHaveLength(2);
      expect(images[0].imageUrl).toBe('https://example.com/image1.jpg');
      expect(images[0].width).toBe(1920);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Verify API call
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://google.serper.dev/images');
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body).q).toBe('Gates of Olympus slot');
    });

    it('should handle empty results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ images: [] })
      });

      const images = await searchImages('nonexistent slot');
      expect(images).toHaveLength(0);
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: () => Promise.resolve('Rate limited')
      });

      const images = await searchImages('test query');
      expect(images).toHaveLength(0);
    });
  });

  describe('searchSlotImages', () => {
    it('should filter quality images', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          images: [
            { imageUrl: 'url1', imageWidth: 1920, imageHeight: 1080, title: 'Good' },
            { imageUrl: 'url2', imageWidth: 200, imageHeight: 100, title: 'Small' },
            { imageUrl: 'url3', imageWidth: 800, imageHeight: 600, title: 'Medium' }
          ]
        })
      });

      const images = await searchSlotImages('Sweet Bonanza');

      // Should filter out small images (< 400x300)
      expect(images).toHaveLength(2);
      expect(images[0].width).toBe(1920); // Sorted by size
    });

    it('should include provider in query', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ images: [] })
      });

      await searchSlotImages('Sweet Bonanza', 'Pragmatic Play');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.q).toContain('Pragmatic Play');
    });
  });

  describe('searchSlotInfo', () => {
    it('should return slot info with provider detection', async () => {
      // Web search response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          organic: [
            {
              title: 'Gates of Olympus by Pragmatic Play',
              snippet: 'Play the popular slot game...',
              link: 'https://example.com'
            }
          ]
        })
      });

      // Image search response (called by searchSlotImages)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          images: [
            { imageUrl: 'url1', imageWidth: 1920, imageHeight: 1080 }
          ]
        })
      });

      const info = await searchSlotInfo('Gates of Olympus');

      expect(info.slotName).toBe('Gates of Olympus');
      expect(info.provider).toMatch(/pragmatic\s*play/i);
      expect(info.images).toHaveLength(1);
    });
  });

  describe('downloadImage', () => {
    it('should download image and return buffer', async () => {
      const imageData = Buffer.from('fake image data');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(imageData)
      });

      const buffer = await downloadImage('https://example.com/image.jpg');

      expect(Buffer.isBuffer(buffer)).toBe(true);
    });

    it('should throw on download failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      await expect(downloadImage('https://example.com/missing.jpg'))
        .rejects
        .toThrow('Failed to download image: 404');
    });
  });
});
