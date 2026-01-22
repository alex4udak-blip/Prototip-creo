/**
 * Tests for prompt.service.js
 * Testing prompt analysis and enhancement
 */

// Mock Anthropic
const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => ({
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: mockCreate
    }
  }))
}));

// Mock config
jest.mock('../src/config/env.js', () => ({
  config: {
    anthropicApiKey: 'test-key'
  }
}));

// Mock logger
jest.mock('../src/utils/logger.js', () => ({
  log: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

import { analyzeAndEnhancePrompt, extractTextContent, detectLanguage, SYSTEM_PROMPT } from '../src/services/prompt.service.js';

describe('Prompt Service', () => {

  beforeEach(() => {
    mockCreate.mockClear();
  });

  describe('analyzeAndEnhancePrompt', () => {
    test('should enhance prompt with Claude API', async () => {
      const mockResponse = {
        enhanced_prompt: 'A luxurious casino banner with golden accents',
        needs_text: true,
        text_content: 'WELCOME BONUS 500€',
        suggested_model: 'flux-dev',
        reference_purpose: null,
        complexity: 'simple'
      };

      mockCreate.mockResolvedValueOnce({
        content: [{ text: JSON.stringify(mockResponse) }]
      });

      const result = await analyzeAndEnhancePrompt('баннер казино с бонусом 500€');

      expect(result).toHaveProperty('enhanced_prompt');
      expect(result.enhanced_prompt).toBe(mockResponse.enhanced_prompt);
      expect(result.needs_text).toBe(true);
      expect(result.text_content).toBe('WELCOME BONUS 500€');
    });

    test('should return fallback on API error', async () => {
      mockCreate.mockRejectedValueOnce(new Error('API Error'));

      const result = await analyzeAndEnhancePrompt('test prompt');

      expect(result).toHaveProperty('enhanced_prompt');
      expect(result.enhanced_prompt).toContain('test prompt');
      expect(result).toHaveProperty('needs_text');
      expect(result).toHaveProperty('suggested_model');
    });

    test('should handle options with reference', async () => {
      const mockResponse = {
        enhanced_prompt: 'Enhanced with reference',
        needs_text: false,
        suggested_model: 'kontext',
        reference_purpose: 'style'
      };

      mockCreate.mockResolvedValueOnce({
        content: [{ text: JSON.stringify(mockResponse) }]
      });

      const result = await analyzeAndEnhancePrompt('style transfer', {
        hasReference: true
      });

      expect(mockCreate).toHaveBeenCalled();
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('Reference provided: YES');
    });

    test('should include size in analysis when provided', async () => {
      const mockResponse = {
        enhanced_prompt: 'Banner optimized for 1200x628',
        needs_text: false,
        suggested_model: 'flux-dev'
      };

      mockCreate.mockResolvedValueOnce({
        content: [{ text: JSON.stringify(mockResponse) }]
      });

      const result = await analyzeAndEnhancePrompt('facebook banner', {
        width: 1200,
        height: 628
      });

      expect(mockCreate).toHaveBeenCalled();
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain('1200x628');
    });
  });

  describe('extractTextContent', () => {
    test('should extract text in quotes', () => {
      expect(extractTextContent('banner with "WELCOME BONUS"'))
        .toBe('WELCOME BONUS');

      expect(extractTextContent("text: 'Hello World'"))
        .toBe('Hello World');
    });

    test('should extract text after keywords', () => {
      expect(extractTextContent('баннер текст: BONUS 500'))
        .toContain('BONUS');

      expect(extractTextContent('banner with text SALE 50% OFF'))
        .toContain('SALE');
    });

    test('should return null for no text', () => {
      expect(extractTextContent('beautiful landscape'))
        .toBeNull();

      expect(extractTextContent('abstract art'))
        .toBeNull();
    });
  });

  describe('detectLanguage', () => {
    test('should detect Russian', () => {
      expect(detectLanguage('привет мир')).toBe('ru');
      expect(detectLanguage('создай баннер')).toBe('ru');
    });

    test('should detect English', () => {
      expect(detectLanguage('hello world')).toBe('en');
      expect(detectLanguage('create banner')).toBe('en');
    });

    test('should default to English for mixed/unknown', () => {
      expect(detectLanguage('123456')).toBe('en');
      expect(detectLanguage('')).toBe('en');
    });
  });

  describe('SYSTEM_PROMPT', () => {
    test('should contain Creative Director role', () => {
      expect(SYSTEM_PROMPT).toContain('Creative Director');
    });

    test('should contain model selection rules', () => {
      expect(SYSTEM_PROMPT).toContain('nano-banana');
      expect(SYSTEM_PROMPT).toContain('flux-dev');
      expect(SYSTEM_PROMPT).toContain('flux-schnell');
      expect(SYSTEM_PROMPT).toContain('kontext');
    });

    test('should contain JSON output format', () => {
      expect(SYSTEM_PROMPT).toContain('JSON');
      expect(SYSTEM_PROMPT).toContain('enhanced_prompt');
    });
  });
});
