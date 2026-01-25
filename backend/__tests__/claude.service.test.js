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
    anthropicApiKey: 'test-api-key',
    claude: {
      model: 'claude-sonnet-4-5-20250929',
      maxTokens: 8192,
      thinkingBudget: 2048
    }
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
const { analyzeRequest, generateLandingCode, generateLandingCodeStream, checkHealth } = await import('../src/services/claude.service.js');

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
        content: [
          {
            type: 'thinking',
            thinking: 'Analyzing the request for Gates of Olympus...'
          },
          {
            type: 'text',
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
          }
        ]
      });

      const result = await analyzeRequest('Gates of Olympus wheel landing');

      expect(result.slotName).toBe('Gates of Olympus');
      expect(result.mechanicType).toBe('wheel');
      expect(result.isRealSlot).toBe(true);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result._thinking).toBeDefined();
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should handle crash game requests', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              slotName: 'Chicken Road',
              mechanicType: 'crash',
              isRealSlot: false,
              prizes: ['x5', 'x10', 'x50'],
              language: 'en',
              theme: 'chicken road',
              confidence: 90
            })
          }
        ]
      });

      const result = await analyzeRequest('Chicken crash game landing');

      expect(result.mechanicType).toBe('crash');
    });

    it('should handle screenshot input', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              slotName: 'Sweet Bonanza',
              mechanicType: 'boxes',
              confidence: 75
            })
          }
        ]
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

      const result = await generateLandingCode(spec, assets, colors);

      expect(result.html).toContain('<!DOCTYPE html>');
      expect(result.html).toContain('wheel-container');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should clean up markdown code blocks', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{
          text: '```html\n<!DOCTYPE html>\n<html></html>\n```'
        }]
      });

      const result = await generateLandingCode({}, {}, {});

      expect(result.html).not.toContain('```');
      expect(result.html).toContain('<!DOCTYPE html>');
    });
  });

  describe('generateLandingCodeStream', () => {
    it('should stream HTML chunks', async () => {
      // Create an async generator that yields events
      async function* mockStreamGenerator() {
        yield { type: 'content_block_delta', delta: { text: '<!DOCTYPE html>' } };
        yield { type: 'content_block_delta', delta: { text: '<html>' } };
        yield { type: 'content_block_delta', delta: { text: '</html>' } };
      }

      mockStream.mockResolvedValueOnce(mockStreamGenerator());

      const chunks = [];
      const result = await generateLandingCodeStream({}, {}, {}, (chunk) => {
        chunks.push(chunk);
      });

      expect(chunks.length).toBe(3);
      expect(chunks[0]).toBe('<!DOCTYPE html>');
      expect(result.html).toContain('<!DOCTYPE html>');
      expect(result.html).toContain('<html>');
    });

    it('should clean markdown from streamed result', async () => {
      async function* mockStreamGenerator() {
        yield { type: 'content_block_delta', delta: { text: '```html\n' } };
        yield { type: 'content_block_delta', delta: { text: '<!DOCTYPE html>' } };
        yield { type: 'content_block_delta', delta: { text: '\n```' } };
      }

      mockStream.mockResolvedValueOnce(mockStreamGenerator());

      const result = await generateLandingCodeStream({}, {}, {}, () => {});

      expect(result.html).not.toContain('```');
      expect(result.html).toContain('<!DOCTYPE html>');
    });

    it('should handle stream errors gracefully', async () => {
      async function* mockStreamGenerator() {
        yield { type: 'content_block_delta', delta: { text: '<html>' } };
        throw new Error('Stream interrupted');
      }

      mockStream.mockResolvedValueOnce(mockStreamGenerator());

      await expect(generateLandingCodeStream({}, {}, {}, () => {}))
        .rejects
        .toThrow('Stream interrupted');
    });
  });

  describe('JSON extraction edge cases', () => {
    it('should handle JSON with special characters in strings', async () => {
      const jsonWithSpecialChars = JSON.stringify({
        slotName: 'Test "Slot" Name',
        description: 'Has {braces} and "quotes"',
        mechanicType: 'wheel',
        confidence: 80
      });

      mockCreate.mockResolvedValueOnce({
        content: [
          { type: 'text', text: `Some text before ${jsonWithSpecialChars} and after` }
        ]
      });

      const result = await analyzeRequest('test prompt');

      expect(result.slotName).toBe('Test "Slot" Name');
      expect(result.description).toBe('Has {braces} and "quotes"');
    });

    it('should handle JSON with escaped backslashes', async () => {
      const jsonWithEscapes = JSON.stringify({
        slotName: 'Test\\Path',
        path: 'C:\\Users\\test',
        mechanicType: 'wheel',
        confidence: 80
      });

      mockCreate.mockResolvedValueOnce({
        content: [
          { type: 'text', text: jsonWithEscapes }
        ]
      });

      const result = await analyzeRequest('test prompt');

      expect(result.slotName).toBe('Test\\Path');
    });

    it('should handle deeply nested JSON', async () => {
      const nestedJson = JSON.stringify({
        slotName: 'Nested Test',
        mechanicType: 'wheel',
        nested: {
          level1: {
            level2: {
              value: 'deep'
            }
          }
        },
        confidence: 90
      });

      mockCreate.mockResolvedValueOnce({
        content: [
          { type: 'text', text: `\`\`\`json\n${nestedJson}\n\`\`\`` }
        ]
      });

      const result = await analyzeRequest('test prompt');

      expect(result.nested.level1.level2.value).toBe('deep');
    });

    it('should handle empty thinking block', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          { type: 'thinking', thinking: '' },
          { type: 'text', text: JSON.stringify({ slotName: 'Test', confidence: 80 }) }
        ]
      });

      const result = await analyzeRequest('test prompt');

      expect(result.slotName).toBe('Test');
      expect(result._thinking).toBe('');
    });

    it('should handle response with only thinking block', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          { type: 'thinking', thinking: 'Thinking...' }
        ]
      });

      await expect(analyzeRequest('test prompt'))
        .rejects
        .toThrow();
    });
  });
});
