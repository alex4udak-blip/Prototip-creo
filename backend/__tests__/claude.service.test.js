/**
 * Claude Service Tests
 *
 * Tests for the Claude API integration for landing page generation.
 * These tests mock the Anthropic SDK to avoid API calls.
 */

import { jest } from '@jest/globals';

// Mock the Anthropic SDK
const mockCreate = jest.fn();
const mockStream = jest.fn();

jest.unstable_mockModule('@anthropic-ai/sdk', () => ({
  default: class Anthropic {
    constructor() {
      this.messages = {
        create: mockCreate,
        stream: mockStream
      };
    }
  }
}));

// Mock config
jest.unstable_mockModule('../src/config/env.js', () => ({
  config: {
    anthropicApiKey: 'test-api-key'
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
const { analyzeRequest, generateLandingCode, checkHealth } = await import('../src/services/claude.service.js');

describe('Claude Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkHealth', () => {
    it('should return configured status when API key is set', () => {
      const health = checkHealth();
      expect(health.configured).toBe(true);
      expect(health.model).toBeDefined();
    });
  });

  describe('analyzeRequest', () => {
    it('should analyze a simple prompt', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{
          text: JSON.stringify({
            slotName: 'Gates of Olympus',
            isRealSlot: true,
            mechanicType: 'wheel',
            prizes: ['€500', '€200', '100 FS'],
            language: 'en',
            theme: 'greek mythology',
            style: 'vibrant',
            offerUrl: null,
            assetsNeeded: [
              { type: 'background', description: 'Greek temple background' }
            ],
            soundsNeeded: ['spin', 'win'],
            confidence: 85
          })
        }]
      });

      const result = await analyzeRequest('Gates of Olympus wheel landing');

      expect(result.slotName).toBe('Gates of Olympus');
      expect(result.mechanicType).toBe('wheel');
      expect(result.isRealSlot).toBe(true);
      expect(result.confidence).toBeGreaterThan(0);
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should handle crash game requests', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{
          text: JSON.stringify({
            slotName: 'Chicken Road',
            mechanicType: 'crash',
            isRealSlot: false,
            prizes: ['x5', 'x10', 'x50'],
            language: 'en',
            theme: 'chicken road',
            confidence: 90
          })
        }]
      });

      const result = await analyzeRequest('Chicken crash game landing');

      expect(result.mechanicType).toBe('crash');
    });

    it('should handle screenshot input', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{
          text: JSON.stringify({
            slotName: 'Sweet Bonanza',
            mechanicType: 'boxes',
            confidence: 75
          })
        }]
      });

      const base64Screenshot = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const result = await analyzeRequest('Create landing', base64Screenshot);

      expect(result).toBeDefined();
      expect(mockCreate).toHaveBeenCalledTimes(1);

      // Check that image was included in the request
      const call = mockCreate.mock.calls[0][0];
      expect(call.messages[0].content).toContainEqual(
        expect.objectContaining({ type: 'image' })
      );
    });

    it('should throw error on API failure', async () => {
      mockCreate.mockRejectedValueOnce(new Error('API rate limited'));

      await expect(analyzeRequest('test prompt'))
        .rejects
        .toThrow('API rate limited');
    });
  });

  describe('generateLandingCode', () => {
    it('should generate HTML code for wheel mechanic', async () => {
      const htmlResponse = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Win Big!</title>
</head>
<body>
  <div class="wheel-container"></div>
</body>
</html>`;

      mockCreate.mockResolvedValueOnce({
        content: [{ text: htmlResponse }]
      });

      const spec = {
        mechanicType: 'wheel',
        slotName: 'Gates of Olympus',
        prizes: ['€500', '€200'],
        language: 'en'
      };

      const assets = {
        background: 'assets/bg.webp',
        wheel: 'assets/wheel.png'
      };

      const colors = {
        primary: '#FFD700',
        secondary: '#1E3A5F'
      };

      const html = await generateLandingCode(spec, assets, colors);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('wheel-container');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should clean up markdown code blocks', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{
          text: '```html\n<!DOCTYPE html>\n<html></html>\n```'
        }]
      });

      const html = await generateLandingCode({}, {}, {});

      expect(html).not.toContain('```');
      expect(html).toContain('<!DOCTYPE html>');
    });
  });
});
