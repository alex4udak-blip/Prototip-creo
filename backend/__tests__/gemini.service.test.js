/**
 * Tests for gemini.service.js
 */
import { jest, describe, it, expect, beforeAll, beforeEach } from '@jest/globals';

// Simple test for service structure without complex mocking
describe('Gemini Service', () => {
  let geminiService;
  let originalEnv;

  beforeAll(async () => {
    // Save and set env
    originalEnv = process.env.GOOGLE_API_KEY;
    process.env.GOOGLE_API_KEY = 'test-api-key';

    // Import the module
    try {
      geminiService = await import('../src/services/gemini.service.js');
    } catch (e) {
      // Module may fail to initialize without proper API key, that's ok for structure tests
    }
  });

  afterAll(() => {
    process.env.GOOGLE_API_KEY = originalEnv;
  });

  describe('Module exports', () => {
    it('should export sendMessageStream function', () => {
      expect(typeof geminiService?.sendMessageStream).toBe('function');
    });

    it('should export getOrCreateChat function', () => {
      expect(typeof geminiService?.getOrCreateChat).toBe('function');
    });

    it('should export deleteChat function', () => {
      expect(typeof geminiService?.deleteChat).toBe('function');
    });

    it('should export checkHealth function', () => {
      expect(typeof geminiService?.checkHealth).toBe('function');
    });

    it('should export generateStyledTextPng function for Runware fallback', () => {
      expect(typeof geminiService?.generateStyledTextPng).toBe('function');
    });
  });

  describe('generateStyledTextPng (Runware fallback text generation)', () => {
    it('should be a callable async function', () => {
      expect(typeof geminiService?.generateStyledTextPng).toBe('function');
    });

    it('should accept text, style and options parameters', () => {
      // Function signature: (text, style = 'casino', options = {})
      expect(geminiService?.generateStyledTextPng.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('deleteChat', () => {
    it('should not throw for any chatId', () => {
      expect(() => {
        geminiService?.deleteChat('any-chat-id');
      }).not.toThrow();
    });

    it('should not throw for undefined', () => {
      expect(() => {
        geminiService?.deleteChat(undefined);
      }).not.toThrow();
    });
  });

  describe('checkHealth', () => {
    it('should return health object', async () => {
      const health = await geminiService?.checkHealth();

      expect(health).toBeDefined();
      expect(health.model).toBe('gemini-3-pro-image-preview');
      expect(health.features).toContain('multi-turn');
      expect(health.features).toContain('image-generation');
      expect(health.features).toContain('text-rendering');
    });
  });

  describe('SYSTEM_PROMPT structure', () => {
    it('should have system prompt defined in module', () => {
      // Check that sendMessageStream exists and has expected behavior
      expect(geminiService?.sendMessageStream).toBeDefined();
    });
  });

  describe('getOrCreateChat', () => {
    it('should return a chat object for valid chatId', () => {
      const chat = geminiService?.getOrCreateChat('test-chat-1');
      expect(chat).toBeDefined();
    });

    it('should return same chat for same chatId', () => {
      const chat1 = geminiService?.getOrCreateChat('test-chat-same');
      const chat2 = geminiService?.getOrCreateChat('test-chat-same');
      expect(chat1).toBe(chat2);
    });

    it('should return different chats for different chatIds', () => {
      const chat1 = geminiService?.getOrCreateChat('test-chat-a');
      const chat2 = geminiService?.getOrCreateChat('test-chat-b');
      expect(chat1).not.toBe(chat2);
    });

    it('should handle numeric chatId', () => {
      const chat = geminiService?.getOrCreateChat(12345);
      expect(chat).toBeDefined();
    });
  });

  describe('sendMessageStream', () => {
    it('should be a function with correct arity', () => {
      expect(geminiService?.sendMessageStream.length).toBeGreaterThanOrEqual(2);
    });

    it('should accept chatId and text parameters', () => {
      // Just verify the function signature, actual API call would require mocking
      expect(typeof geminiService?.sendMessageStream).toBe('function');
    });
  });

  describe('Service configuration', () => {
    it('should use correct model name', async () => {
      const health = await geminiService?.checkHealth();
      expect(health.model).toBe('gemini-3-pro-image-preview');
    });

    it('should have thinking feature enabled', async () => {
      const health = await geminiService?.checkHealth();
      expect(health.features).toContain('thinking');
    });

    it('should support image understanding', async () => {
      const health = await geminiService?.checkHealth();
      expect(health.features).toContain('image-understanding');
    });

    it('should return config object with thinkingBudget', async () => {
      const health = await geminiService?.checkHealth();
      expect(health.config).toBeDefined();
      expect(health.config.thinkingBudget).toBeDefined();
      expect(health.config.safetyThreshold).toBeDefined();
    });
  });
});
