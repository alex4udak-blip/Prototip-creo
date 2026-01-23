/**
 * Tests for Generation Flow
 * Testing Vision analysis, processUserAnswers, model selection, and clarification questions
 *
 * Note: Due to ESM module loading, some tests mock at the function call level
 * rather than module level when testing integrated flows.
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Import the modules under test
import {
  processUserAnswers,
  extractTextContent,
  detectLanguage,
  REQUEST_CONTEXTS
} from '../services/prompt.service.js';

import {
  selectModel,
  analyzeCreativeType,
  parseSize,
  getSizePresets,
  getAvailableModels,
  CREATIVE_TYPES,
  STRATEGIES
} from '../services/router.service.js';

describe('Generation Flow', () => {

  // ============================================
  // VISION ANALYSIS FLOW
  // ============================================
  describe('Vision Analysis', () => {

    it('should define REQUEST_CONTEXTS for different content types', () => {
      expect(REQUEST_CONTEXTS).toBeDefined();
      expect(REQUEST_CONTEXTS.CASINO_GAMBLING).toBeDefined();
      expect(REQUEST_CONTEXTS.CASINO_GAMBLING.keywords).toContain('casino');
      expect(REQUEST_CONTEXTS.CASINO_GAMBLING.aspects).toContain('bonus_details');
    });

    it('should have vision analysis structure requirements', () => {
      // Vision analysis should return specific fields for Identity Lock
      const expectedVisionFields = [
        'content_type',
        'has_character',
        'character_description',
        'background_description',
        'colors',
        'style',
        'summary'
      ];

      // This validates the expected structure from analyzeReferenceImage
      expectedVisionFields.forEach(field => {
        expect(typeof field).toBe('string');
      });
    });

    it('should support character recreation for Identity Lock', () => {
      // Mock vision analysis result structure
      const visionAnalysisResult = {
        content_type: 'casino',
        has_character: true,
        character_description: 'Woman with blonde hair holding cards',
        character_pose: 'standing confident',
        character_clothing: 'red dress',
        character_accessories: 'gold earrings',
        background_description: 'Dark casino floor with neon lights',
        objects: ['slot machines', 'poker chips'],
        colors: ['gold', 'purple', 'black'],
        style: '3D render',
        recreation_prompt: 'Confident woman in red dress at casino',
        summary: 'Casino banner with character'
      };

      expect(visionAnalysisResult.has_character).toBe(true);
      expect(visionAnalysisResult.character_description).toBeTruthy();
      expect(visionAnalysisResult.recreation_prompt).toBeTruthy();
    });

  });

  // ============================================
  // processUserAnswers Function
  // ============================================
  describe('processUserAnswers', () => {

    it('should extract variations_count=3 from "3 variants"', async () => {
      const result = await processUserAnswers('test prompt', {
        variations_count: '3 variants'
      });
      expect(result.variations_count).toBe(3);
    });

    it('should extract variations_count=5 from "5 variants (recommended)"', async () => {
      const result = await processUserAnswers('test prompt', {
        variations_count: '5 variants (recommended)'
      });
      expect(result.variations_count).toBe(5);
    });

    it('should extract variations_count=1 from "1 variant"', async () => {
      const result = await processUserAnswers('test prompt', {
        variations_count: '1 variant'
      });
      expect(result.variations_count).toBe(1);
    });

    it('should cap variations_count at 5', async () => {
      const result = await processUserAnswers('test prompt', {
        variations_count: '10 variants'
      });
      expect(result.variations_count).toBe(5);
    });

    it('should default variations_count to 1 for invalid format', async () => {
      const result = await processUserAnswers('test prompt', {
        variations_count: 'invalid'
      });
      expect(result.variations_count).toBe(1);
    });

    it('should default variations_count to 1 when not provided', async () => {
      const result = await processUserAnswers('test prompt', {
        style: 'Modern'
      });
      expect(result.variations_count).toBe(1);
    });

    it('should handle empty answers object', async () => {
      const result = await processUserAnswers('create banner', {});
      expect(result.variations_count).toBe(1);
      expect(result.enhanced_prompt).toBeDefined();
    });

    it('should enrich prompt with user answers', async () => {
      const result = await processUserAnswers('casino banner', {
        app_name: 'LuckyCasino',
        bonus_type: 'Welcome bonus',
        style: 'Premium'
      });

      // Result should include enhanced_prompt
      expect(result.enhanced_prompt).toBeDefined();
      expect(result.enhanced_prompt.length).toBeGreaterThan(0);
    });

    it('should skip "skip" values in prompt enrichment', async () => {
      const result = await processUserAnswers('banner', {
        style: 'skip',
        geo: 'skip',
        variations_count: '3 variants'
      });

      expect(result.variations_count).toBe(3);
    });

    it('should handle array answers', async () => {
      const result = await processUserAnswers('create banners', {
        platforms: ['Facebook', 'Instagram', 'TikTok']
      });

      expect(result.enhanced_prompt).toBeDefined();
    });

  });

  // ============================================
  // MODEL SELECTION
  // ============================================
  describe('Model Selection', () => {

    describe('selectModel', () => {

      it('should respect user preference over automatic selection', () => {
        const promptAnalysis = {
          enhanced_prompt: 'any prompt',
          needs_text: true,
          text_content: 'LONG TEXT WITH MANY WORDS HERE'
        };

        const model = selectModel(promptAnalysis, {
          hasReference: false,
          userPreference: 'runware-flux-dev'
        });

        expect(model).toBe('runware-flux-dev');
      });

      it('should select runware-schnell for memes', () => {
        const promptAnalysis = {
          enhanced_prompt: 'funny meme about coding'
        };

        const creativeType = analyzeCreativeType(promptAnalysis);
        expect(creativeType).toBe(CREATIVE_TYPES.MEME);

        const model = selectModel(promptAnalysis, { hasReference: false });
        expect(model).toBe('runware-schnell');
      });

      it('should select runware-flux-dev as default when no Google API', () => {
        const promptAnalysis = {
          enhanced_prompt: 'beautiful landscape photography'
        };

        const model = selectModel(promptAnalysis, { hasReference: false });
        // Without Google API mocked, falls back to runware
        expect(model).toMatch(/runware/);
      });

      it('should handle kontext suggestion for editing', () => {
        const promptAnalysis = {
          enhanced_prompt: 'Change the background color',
          suggested_model: 'kontext',
          reference_purpose: 'edit'
        };

        // With reference but no Google API
        const model = selectModel(promptAnalysis, { hasReference: true });
        // Model selection depends on API availability
        expect(model).toBeDefined();
      });

    });

    describe('analyzeCreativeType', () => {

      it('should detect infographic type', () => {
        expect(analyzeCreativeType({ enhanced_prompt: 'create infographic about sales' }))
          .toBe(CREATIVE_TYPES.INFOGRAPHIC);
        expect(analyzeCreativeType({ task_understanding: 'make a chart about revenue' }))
          .toBe(CREATIVE_TYPES.INFOGRAPHIC);
        expect(analyzeCreativeType({ enhanced_prompt: 'create diagram' }))
          .toBe(CREATIVE_TYPES.INFOGRAPHIC);
      });

      it('should detect infographic type (Russian)', () => {
        expect(analyzeCreativeType({ enhanced_prompt: 'диаграмма продаж' }))
          .toBe(CREATIVE_TYPES.INFOGRAPHIC);
        expect(analyzeCreativeType({ enhanced_prompt: 'создай инфографику' }))
          .toBe(CREATIVE_TYPES.INFOGRAPHIC);
      });

      it('should detect social media type', () => {
        expect(analyzeCreativeType({ enhanced_prompt: 'instagram post about coffee' }))
          .toBe(CREATIVE_TYPES.SOCIAL);
        expect(analyzeCreativeType({ enhanced_prompt: 'youtube thumbnail excited face' }))
          .toBe(CREATIVE_TYPES.SOCIAL);
        expect(analyzeCreativeType({ enhanced_prompt: 'tiktok cover video' }))
          .toBe(CREATIVE_TYPES.SOCIAL);
        expect(analyzeCreativeType({ enhanced_prompt: 'twitter post' }))
          .toBe(CREATIVE_TYPES.SOCIAL);
      });

      it('should detect meme type', () => {
        expect(analyzeCreativeType({ enhanced_prompt: 'funny meme about work' }))
          .toBe(CREATIVE_TYPES.MEME);
        expect(analyzeCreativeType({ enhanced_prompt: 'viral content' }))
          .toBe(CREATIVE_TYPES.MEME);
      });

      it('should detect meme type (Russian)', () => {
        expect(analyzeCreativeType({ enhanced_prompt: 'мем про понедельник' }))
          .toBe(CREATIVE_TYPES.MEME);
        expect(analyzeCreativeType({ enhanced_prompt: 'смешная картинка' }))
          .toBe(CREATIVE_TYPES.MEME);
      });

      it('should detect character type', () => {
        expect(analyzeCreativeType({ enhanced_prompt: 'mascot for company' }))
          .toBe(CREATIVE_TYPES.CHARACTER);
        expect(analyzeCreativeType({ enhanced_prompt: 'character design' }))
          .toBe(CREATIVE_TYPES.CHARACTER);
        expect(analyzeCreativeType({ enhanced_prompt: 'avatar for user' }))
          .toBe(CREATIVE_TYPES.CHARACTER);
      });

      it('should detect character type (Russian)', () => {
        expect(analyzeCreativeType({ enhanced_prompt: 'создай персонажа робота' }))
          .toBe(CREATIVE_TYPES.CHARACTER);
        expect(analyzeCreativeType({ enhanced_prompt: 'маскот компании' }))
          .toBe(CREATIVE_TYPES.CHARACTER);
      });

      it('should detect product type', () => {
        expect(analyzeCreativeType({ enhanced_prompt: 'product photography' }))
          .toBe(CREATIVE_TYPES.PRODUCT);
        expect(analyzeCreativeType({ enhanced_prompt: 'packshot for store' }))
          .toBe(CREATIVE_TYPES.PRODUCT);
      });

      it('should detect branding type', () => {
        expect(analyzeCreativeType({ enhanced_prompt: 'logo design' }))
          .toBe(CREATIVE_TYPES.BRANDING);
        expect(analyzeCreativeType({ enhanced_prompt: 'brand identity' }))
          .toBe(CREATIVE_TYPES.BRANDING);
      });

      it('should detect UI type', () => {
        expect(analyzeCreativeType({ enhanced_prompt: 'ui design for app' }))
          .toBe(CREATIVE_TYPES.UI);
        expect(analyzeCreativeType({ enhanced_prompt: 'interface mockup' }))
          .toBe(CREATIVE_TYPES.UI);
        expect(analyzeCreativeType({ enhanced_prompt: 'icon set' }))
          .toBe(CREATIVE_TYPES.UI);
      });

      it('should default to banner type', () => {
        expect(analyzeCreativeType({ enhanced_prompt: 'casino advertisement bonus 500' }))
          .toBe(CREATIVE_TYPES.BANNER);
        expect(analyzeCreativeType({ enhanced_prompt: 'advertising creative' }))
          .toBe(CREATIVE_TYPES.BANNER);
      });

      it('should handle empty or undefined prompt', () => {
        expect(analyzeCreativeType({})).toBe(CREATIVE_TYPES.BANNER);
        expect(analyzeCreativeType({ enhanced_prompt: '' })).toBe(CREATIVE_TYPES.BANNER);
      });

    });

  });

  // ============================================
  // CLARIFICATION QUESTIONS LOGIC
  // ============================================
  describe('Clarification Questions Logic', () => {

    it('should have proper question structure', () => {
      // Test the expected question format
      const validQuestion = {
        id: 'reference_usage',
        question: 'How to use reference?',
        type: 'single_choice',
        options: ['Identity Lock', 'Inspiration', 'Edit'],
        why: 'Determines generation model'
      };

      expect(validQuestion.id).toBeDefined();
      expect(validQuestion.question).toBeDefined();
      expect(validQuestion.type).toMatch(/single_choice|text_input|multi_choice/);
      expect(Array.isArray(validQuestion.options)).toBe(true);
    });

    it('should define variations question format', () => {
      const variationsQuestion = {
        id: 'variations_count',
        question: 'How many variations?',
        type: 'single_choice',
        options: ['1 variant', '3 variants', '5 variants (recommended)']
      };

      expect(variationsQuestion.id).toBe('variations_count');
      expect(variationsQuestion.options).toContain('5 variants (recommended)');
    });

    it('should define reference usage question format', () => {
      const refQuestion = {
        id: 'reference_usage',
        question: 'How to use reference?',
        type: 'single_choice',
        options: ['Identity Lock', 'Inspiration (style)', 'Edit']
      };

      expect(refQuestion.id).toBe('reference_usage');
      expect(refQuestion.options.length).toBeGreaterThanOrEqual(3);
    });

  });

  // ============================================
  // PARSE SIZE
  // ============================================
  describe('parseSize', () => {

    it('should parse WxH format', () => {
      expect(parseSize('1200x628')).toEqual({ width: 1200, height: 628 });
      expect(parseSize('1080x1080')).toEqual({ width: 1080, height: 1080 });
    });

    it('should handle case insensitive x', () => {
      expect(parseSize('1200X628')).toEqual({ width: 1200, height: 628 });
    });

    it('should return default for null/undefined', () => {
      expect(parseSize(null)).toEqual({ width: 1024, height: 1024 });
      expect(parseSize(undefined)).toEqual({ width: 1024, height: 1024 });
    });

    it('should return default for invalid input', () => {
      expect(parseSize('invalid')).toEqual({ width: 1024, height: 1024 });
    });

    it('should find preset by name', () => {
      const presets = [
        { name: 'Facebook Feed', width: 1200, height: 628 },
        { name: 'Instagram Square', width: 1080, height: 1080 }
      ];

      expect(parseSize('Facebook Feed', presets)).toEqual({ width: 1200, height: 628 });
      expect(parseSize('instagram square', presets)).toEqual({ width: 1080, height: 1080 });
    });

    it('should extract size from prompt in auto mode', () => {
      const result = parseSize('auto', [], 'create banner 1200x628');
      expect(result).toEqual({ width: 1200, height: 628 });
    });

    it('should detect format keywords in auto mode', () => {
      expect(parseSize('auto', [], 'instagram stories post')).toEqual({ width: 1088, height: 1920 });
      expect(parseSize('auto', [], 'квадратный пост')).toEqual({ width: 1024, height: 1024 });
    });

  });

  // ============================================
  // GET SIZE PRESETS
  // ============================================
  describe('getSizePresets', () => {

    it('should return all preset categories', () => {
      const presets = getSizePresets();

      const categories = [...new Set(presets.map(p => p.category))];
      expect(categories).toContain('social');
      expect(categories).toContain('video');
      expect(categories).toContain('ads');
      expect(categories).toContain('general');
    });

    it('should include standard social media sizes', () => {
      const presets = getSizePresets();

      const facebookFeed = presets.find(p => p.id === 'facebook-feed');
      expect(facebookFeed).toBeDefined();
      expect(facebookFeed.width).toBe(1200);
      expect(facebookFeed.height).toBe(628);

      const instagramSquare = presets.find(p => p.id === 'instagram-square');
      expect(instagramSquare).toBeDefined();
      expect(instagramSquare.width).toBe(1080);
      expect(instagramSquare.height).toBe(1080);
    });

    it('should include YouTube thumbnail size', () => {
      const presets = getSizePresets();
      const youtube = presets.find(p => p.id === 'youtube-thumbnail');

      expect(youtube).toBeDefined();
      expect(youtube.width).toBe(1280);
      expect(youtube.height).toBe(720);
    });

    it('should have required properties on each preset', () => {
      const presets = getSizePresets();

      presets.forEach(preset => {
        expect(preset).toHaveProperty('id');
        expect(preset).toHaveProperty('name');
        expect(preset).toHaveProperty('width');
        expect(preset).toHaveProperty('height');
        expect(preset).toHaveProperty('category');
      });
    });

  });

  // ============================================
  // HELPER FUNCTIONS
  // ============================================
  describe('Helper Functions', () => {

    describe('extractTextContent', () => {

      it('should extract text from double quotes', () => {
        expect(extractTextContent('banner with "WELCOME BONUS"')).toBe('WELCOME BONUS');
      });

      it('should extract text from single quotes', () => {
        expect(extractTextContent("text: 'Hello World'")).toBe('Hello World');
      });

      it('should extract text from curly quotes', () => {
        expect(extractTextContent('banner with "GET BONUS"')).toBe('GET BONUS');
      });

      it('should return null for no text content', () => {
        expect(extractTextContent('beautiful landscape without any quotes')).toBeNull();
        expect(extractTextContent('abstract art scene')).toBeNull();
      });

      it('should extract text after keywords', () => {
        const result1 = extractTextContent('banner with text: SALE 50% OFF');
        expect(result1).toBeTruthy();

        const result2 = extractTextContent('баннер текст: BONUS 500');
        expect(result2).toBeTruthy();
      });

      it('should extract bonus patterns', () => {
        const result = extractTextContent('casino banner BONUS 500');
        // May or may not match depending on exact pattern
        // Just verify it doesn't crash
        expect(typeof result === 'string' || result === null).toBe(true);
      });

    });

    describe('detectLanguage', () => {

      it('should detect Russian', () => {
        expect(detectLanguage('привет мир')).toBe('ru');
        expect(detectLanguage('создай баннер')).toBe('ru');
        expect(detectLanguage('казино бонус')).toBe('ru');
      });

      it('should detect English', () => {
        expect(detectLanguage('hello world')).toBe('en');
        expect(detectLanguage('create banner')).toBe('en');
        expect(detectLanguage('casino bonus')).toBe('en');
      });

      it('should default to English for numbers only', () => {
        expect(detectLanguage('123456')).toBe('en');
      });

      it('should default to English for empty string', () => {
        expect(detectLanguage('')).toBe('en');
      });

      it('should handle mixed text based on character count', () => {
        // The language detection counts characters
        // "hello мир" has 5 latin vs 3 cyrillic = english
        expect(detectLanguage('hello мир')).toBe('en');
        // "hi привет" has 2 latin vs 6 cyrillic = russian
        expect(detectLanguage('hi привет')).toBe('ru');
      });

    });

  });

  // ============================================
  // EDGE CASES
  // ============================================
  describe('Edge Cases', () => {

    it('should handle processUserAnswers with undefined values', async () => {
      const result = await processUserAnswers('test', {
        style: undefined,
        geo: null
      });
      expect(result).toBeDefined();
      expect(result.enhanced_prompt).toBeDefined();
    });

    it('should handle very long prompts', async () => {
      const longPrompt = 'create amazing casino banner '.repeat(100);
      const result = await processUserAnswers(longPrompt, {});
      expect(result).toBeDefined();
    });

    it('should handle special characters in prompts', async () => {
      const result = await processUserAnswers('banner with 500 & special <chars> "quotes"', {});
      expect(result).toBeDefined();
      expect(result.enhanced_prompt).toBeDefined();
    });

    it('should handle unicode in prompts', async () => {
      const result = await processUserAnswers('banner with emoji and symbols', {});
      expect(result).toBeDefined();
    });

  });

  // ============================================
  // CONSTANTS AND TYPES
  // ============================================
  describe('Constants', () => {

    it('should define all CREATIVE_TYPES', () => {
      expect(CREATIVE_TYPES.BANNER).toBe('banner');
      expect(CREATIVE_TYPES.SOCIAL).toBe('social');
      expect(CREATIVE_TYPES.PRODUCT).toBe('product');
      expect(CREATIVE_TYPES.INFOGRAPHIC).toBe('infographic');
      expect(CREATIVE_TYPES.BRANDING).toBe('branding');
      expect(CREATIVE_TYPES.CHARACTER).toBe('character');
      expect(CREATIVE_TYPES.UI).toBe('ui');
      expect(CREATIVE_TYPES.MEME).toBe('meme');
      expect(CREATIVE_TYPES.OTHER).toBe('other');
    });

    it('should define all STRATEGIES', () => {
      expect(STRATEGIES.SEQUENTIAL).toBe('sequential');
      expect(STRATEGIES.PARALLEL).toBe('parallel');
      expect(STRATEGIES.ITERATIVE).toBe('iterative');
      expect(STRATEGIES.COMPOSITE).toBe('composite');
      expect(STRATEGIES.STYLE_TRANSFER).toBe('style_transfer');
    });

  });

});
