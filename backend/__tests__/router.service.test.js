/**
 * Tests for router.service.js
 * Testing model selection and strategy determination
 */

// Mock config
jest.mock('../src/config/env.js', () => ({
  config: {
    googleApiKey: 'test-google-key',
    runwareApiKey: 'test-runware-key',
    anthropicApiKey: 'test-anthropic-key'
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

import {
  selectModel,
  analyzeCreativeType,
  selectStrategy,
  createExecutionPlan,
  parseSize,
  getAvailableModels,
  getSizePresets,
  STRATEGIES,
  CREATIVE_TYPES
} from '../src/services/router.service.js';

describe('Router Service', () => {

  describe('analyzeCreativeType', () => {
    test('should detect infographic type', () => {
      expect(analyzeCreativeType({ enhanced_prompt: 'создай инфографику про продажи' }))
        .toBe(CREATIVE_TYPES.INFOGRAPHIC);

      expect(analyzeCreativeType({ task_understanding: 'make a chart about revenue' }))
        .toBe(CREATIVE_TYPES.INFOGRAPHIC);

      expect(analyzeCreativeType({ enhanced_prompt: 'диаграмма воронки продаж' }))
        .toBe(CREATIVE_TYPES.INFOGRAPHIC);
    });

    test('should detect social media type', () => {
      expect(analyzeCreativeType({ enhanced_prompt: 'instagram post about coffee' }))
        .toBe(CREATIVE_TYPES.SOCIAL);

      expect(analyzeCreativeType({ enhanced_prompt: 'youtube thumbnail excited face' }))
        .toBe(CREATIVE_TYPES.SOCIAL);

      expect(analyzeCreativeType({ enhanced_prompt: 'tiktok cover video' }))
        .toBe(CREATIVE_TYPES.SOCIAL);
    });

    test('should detect meme type', () => {
      expect(analyzeCreativeType({ enhanced_prompt: 'мем про понедельник' }))
        .toBe(CREATIVE_TYPES.MEME);

      expect(analyzeCreativeType({ enhanced_prompt: 'funny meme about work' }))
        .toBe(CREATIVE_TYPES.MEME);
    });

    test('should detect character type', () => {
      expect(analyzeCreativeType({ enhanced_prompt: 'создай персонажа робота' }))
        .toBe(CREATIVE_TYPES.CHARACTER);

      expect(analyzeCreativeType({ enhanced_prompt: 'mascot for company' }))
        .toBe(CREATIVE_TYPES.CHARACTER);
    });

    test('should default to banner type', () => {
      expect(analyzeCreativeType({ enhanced_prompt: 'casino advertisement bonus 500' }))
        .toBe(CREATIVE_TYPES.BANNER);

      expect(analyzeCreativeType({ enhanced_prompt: 'рекламный креатив' }))
        .toBe(CREATIVE_TYPES.BANNER);
    });
  });

  describe('selectModel', () => {
    test('should respect user preference', () => {
      expect(selectModel({}, { userPreference: 'runware-schnell' }))
        .toBe('runware-schnell');
    });

    test('should select google-nano-pro for infographics', () => {
      expect(selectModel({
        enhanced_prompt: 'create infographic about sales'
      })).toBe('google-nano-pro');
    });

    test('should select google-nano for text with less than 5 words', () => {
      expect(selectModel({
        needs_text: true,
        text_content: 'BONUS 500€'
      })).toBe('google-nano');
    });

    test('should select google-nano-pro for text with 5+ words', () => {
      expect(selectModel({
        needs_text: true,
        text_content: 'Get your welcome bonus today now'
      })).toBe('google-nano-pro');
    });

    test('should select runware-kontext for reference editing', () => {
      expect(selectModel({
        suggested_model: 'kontext'
      }, { hasReference: true })).toBe('runware-kontext');
    });

    test('should select runware-schnell for memes', () => {
      expect(selectModel({
        enhanced_prompt: 'funny meme about coding'
      })).toBe('runware-schnell');
    });

    test('should select runware-flux-dev as default', () => {
      expect(selectModel({
        enhanced_prompt: 'beautiful landscape photography'
      })).toBe('runware-flux-dev');
    });

    test('should select runware-schnell when Claude suggests it', () => {
      expect(selectModel({
        suggested_model: 'flux-schnell',
        enhanced_prompt: 'quick draft banner'
      })).toBe('runware-schnell');
    });

    test('should select google-nano-pro for character consistency with reference', () => {
      expect(selectModel({
        needs_character_consistency: true,
        enhanced_prompt: 'character in new scene'
      }, { hasReference: true })).toBe('google-nano-pro');
    });
  });

  describe('selectStrategy', () => {
    test('should select PARALLEL for A/B testing', () => {
      expect(selectStrategy({}, { numVariants: 3 }))
        .toBe(STRATEGIES.PARALLEL);
    });

    test('should select ITERATIVE for reference editing', () => {
      expect(selectStrategy({ suggested_model: 'kontext' }, { hasReference: true }))
        .toBe(STRATEGIES.ITERATIVE);
    });

    test('should select SEQUENTIAL for character consistency', () => {
      expect(selectStrategy({ needs_character_consistency: true }))
        .toBe(STRATEGIES.SEQUENTIAL);
    });

    test('should select COMPOSITE for complex tasks', () => {
      expect(selectStrategy({ complexity: 'composite' }))
        .toBe(STRATEGIES.COMPOSITE);
    });

    test('should select STYLE_TRANSFER for style reference', () => {
      expect(selectStrategy({ reference_purpose: 'style' }, { hasReference: true }))
        .toBe(STRATEGIES.STYLE_TRANSFER);
    });

    test('should default to SEQUENTIAL', () => {
      expect(selectStrategy({}))
        .toBe(STRATEGIES.SEQUENTIAL);
    });
  });

  describe('createExecutionPlan', () => {
    test('should create single-step plan for SEQUENTIAL', () => {
      const plan = createExecutionPlan({
        enhanced_prompt: 'test prompt'
      });

      expect(plan.strategy).toBe(STRATEGIES.SEQUENTIAL);
      expect(plan.steps.length).toBe(1);
      expect(plan.steps[0].step).toBe(1);
    });

    test('should create multi-step plan for PARALLEL', () => {
      const plan = createExecutionPlan(
        { enhanced_prompt: 'test prompt' },
        { numVariants: 3 }
      );

      expect(plan.strategy).toBe(STRATEGIES.PARALLEL);
      expect(plan.steps.length).toBe(3);
    });

    test('should create 2-step plan for ITERATIVE', () => {
      const plan = createExecutionPlan(
        { enhanced_prompt: 'test', suggested_model: 'kontext' },
        { hasReference: true }
      );

      expect(plan.strategy).toBe(STRATEGIES.ITERATIVE);
      expect(plan.steps.length).toBe(2);
      expect(plan.steps[0].model).toBe('runware-flux-dev');
      expect(plan.steps[1].model).toBe('runware-kontext');
    });

    test('should create 3-step plan for COMPOSITE', () => {
      const plan = createExecutionPlan(
        { enhanced_prompt: 'complex image', complexity: 'composite' }
      );

      expect(plan.strategy).toBe(STRATEGIES.COMPOSITE);
      expect(plan.steps.length).toBe(3);
    });

    test('should include quality checkpoints', () => {
      const plan = createExecutionPlan({ enhanced_prompt: 'test' });
      expect(plan.qualityCheckpoints).toBeDefined();
      expect(plan.qualityCheckpoints.length).toBeGreaterThan(0);
    });
  });

  describe('parseSize', () => {
    test('should parse WxH format', () => {
      expect(parseSize('1200x628')).toEqual({ width: 1200, height: 628 });
      expect(parseSize('1080x1080')).toEqual({ width: 1080, height: 1080 });
    });

    test('should return default for invalid input', () => {
      expect(parseSize(null)).toEqual({ width: 1200, height: 628 });
      expect(parseSize(undefined)).toEqual({ width: 1200, height: 628 });
      expect(parseSize('invalid')).toEqual({ width: 1200, height: 628 });
    });

    test('should find preset by name', () => {
      const presets = [
        { name: 'Facebook Feed', width: 1200, height: 628 },
        { name: 'Instagram Square', width: 1080, height: 1080 }
      ];

      expect(parseSize('Facebook Feed', presets)).toEqual({ width: 1200, height: 628 });
      expect(parseSize('instagram square', presets)).toEqual({ width: 1080, height: 1080 });
    });
  });

  describe('getAvailableModels', () => {
    test('should return all models when all APIs configured', () => {
      const models = getAvailableModels();

      expect(models.length).toBeGreaterThanOrEqual(5);

      const runwareModels = models.filter(m => m.provider === 'runware');
      const googleModels = models.filter(m => m.provider === 'google');

      expect(runwareModels.length).toBe(3);
      expect(googleModels.length).toBe(2);
    });

    test('should include required model properties', () => {
      const models = getAvailableModels();

      models.forEach(model => {
        expect(model).toHaveProperty('id');
        expect(model).toHaveProperty('name');
        expect(model).toHaveProperty('description');
        expect(model).toHaveProperty('provider');
        expect(model).toHaveProperty('features');
        expect(model).toHaveProperty('costPer1k');
      });
    });
  });

  describe('getSizePresets', () => {
    test('should return all preset categories', () => {
      const presets = getSizePresets();

      const categories = [...new Set(presets.map(p => p.category))];
      expect(categories).toContain('social');
      expect(categories).toContain('video');
      expect(categories).toContain('ads');
      expect(categories).toContain('general');
    });

    test('should include standard social media sizes', () => {
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

    test('should include YouTube thumbnail size', () => {
      const presets = getSizePresets();
      const youtube = presets.find(p => p.id === 'youtube-thumbnail');

      expect(youtube).toBeDefined();
      expect(youtube.width).toBe(1280);
      expect(youtube.height).toBe(720);
    });
  });
});
