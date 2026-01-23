// import { generateWithRunware } from './runware.service.js';  // ВРЕМЕННО ОТКЛЮЧЕНО
import { generateWithGoogle } from './google.service.js';
import { config } from '../config/env.js';
import { log } from '../utils/logger.js';

/**
 * MODEL SELECTION MATRIX - Based on task requirements
 *
 * RULE 1: TEXT ON IMAGE
 *   - Long text (>4 words) or infographic: Google Nano Banana Pro
 *   - Short text (1-4 words): Google Nano Banana
 *   - No Google API: Fallback to Runware FLUX Dev (text will be imperfect)
 *
 * RULE 2: REFERENCE IMAGE
 *   - Edit/modify reference: Runware Kontext
 *   - Style transfer: Runware FLUX Dev with style reference
 *   - Character consistency: Google Nano Banana Pro (Identity Lock)
 *
 * RULE 3: SPEED vs QUALITY
 *   - Quick draft/meme: Runware Schnell
 *   - High quality: Runware FLUX Dev
 *   - Default balance: Runware FLUX Dev
 *
 * COMBINATION STRATEGY:
 *   - Claude ALWAYS analyzes the prompt first
 *   - Then routes to best generation model
 */

/**
 * Execution Strategies based on Universal Creative Engine
 */
export const STRATEGIES = {
  SEQUENTIAL: 'sequential',   // Step-by-step execution
  PARALLEL: 'parallel',       // Multiple variants at once
  ITERATIVE: 'iterative',     // Refine until quality
  COMPOSITE: 'composite',     // Multi-element composition
  STYLE_TRANSFER: 'style_transfer'
};

/**
 * Creative Types for routing
 */
export const CREATIVE_TYPES = {
  BANNER: 'banner',
  SOCIAL: 'social',
  PRODUCT: 'product',
  INFOGRAPHIC: 'infographic',
  BRANDING: 'branding',
  CHARACTER: 'character',
  UI: 'ui',
  MEME: 'meme',
  OTHER: 'other'
};

/**
 * Analyze creative task and determine type
 */
export function analyzeCreativeType(promptAnalysis) {
  const text = (promptAnalysis.task_understanding || promptAnalysis.enhanced_prompt || '').toLowerCase();

  // Infographic — always Nano Banana Pro
  if (text.includes('инфографик') || text.includes('infographic') ||
      text.includes('диаграмм') || text.includes('chart') ||
      text.includes('схем') || text.includes('diagram')) {
    return CREATIVE_TYPES.INFOGRAPHIC;
  }

  // Social media
  if (text.includes('instagram') || text.includes('tiktok') ||
      text.includes('youtube') || text.includes('twitter') ||
      text.includes('thumbnail') || text.includes('story') ||
      text.includes('stories') || text.includes('reels')) {
    return CREATIVE_TYPES.SOCIAL;
  }

  // Character/mascot
  if (text.includes('персонаж') || text.includes('character') ||
      text.includes('маскот') || text.includes('mascot') ||
      text.includes('аватар') || text.includes('avatar')) {
    return CREATIVE_TYPES.CHARACTER;
  }

  // Meme
  if (text.includes('мем') || text.includes('meme') ||
      text.includes('смешн') || text.includes('funny') ||
      text.includes('viral')) {
    return CREATIVE_TYPES.MEME;
  }

  // Product
  if (text.includes('продукт') || text.includes('product') ||
      text.includes('packshot') || text.includes('товар')) {
    return CREATIVE_TYPES.PRODUCT;
  }

  // Branding
  if (text.includes('лого') || text.includes('logo') ||
      text.includes('бренд') || text.includes('brand') ||
      text.includes('айдентик')) {
    return CREATIVE_TYPES.BRANDING;
  }

  // UI/UX
  if (text.includes('ui') || text.includes('ux') ||
      text.includes('interface') || text.includes('интерфейс') ||
      text.includes('иконк') || text.includes('icon')) {
    return CREATIVE_TYPES.UI;
  }

  // Default — advertising banner
  return CREATIVE_TYPES.BANNER;
}

/**
 * Determine optimal strategy based on task complexity
 */
export function selectStrategy(promptAnalysis, options = {}) {
  const { hasReference = false, numVariants = 1 } = options;
  const complexity = promptAnalysis.complexity || 'simple';

  // A/B test — parallel generation
  if (numVariants > 1 && !hasReference) {
    return STRATEGIES.PARALLEL;
  }

  // Has reference for editing — iterative refinement
  if (hasReference && promptAnalysis.suggested_model === 'kontext') {
    return STRATEGIES.ITERATIVE;
  }

  // Character consistency needed — sequential
  if (promptAnalysis.needs_character_consistency) {
    return STRATEGIES.SEQUENTIAL;
  }

  // Complex multi-element composition
  if (complexity === 'composite' || complexity === 'complex') {
    return STRATEGIES.COMPOSITE;
  }

  // Style transfer from reference
  if (hasReference && promptAnalysis.reference_purpose === 'style') {
    return STRATEGIES.STYLE_TRANSFER;
  }

  // Default — single generation
  return STRATEGIES.SEQUENTIAL;
}

/**
 * Автоматический выбор лучшей модели для задачи
 *
 * ВРЕМЕННО УПРОЩЕНО: Только Nano Banana Pro для всего!
 * Одна модель для всех задач — как у Genspark.
 */
export function selectModel(promptAnalysis, options = {}) {
  // ВРЕМЕННО: Только Nano Banana Pro для всего
  log.info('MODEL DECISION: google-nano-pro (simplified - single model)', { reason: 'simplified_nano_banana_pro' });
  return 'google-nano-pro';
}

/**
 * Create execution plan based on strategy
 */
export function createExecutionPlan(promptAnalysis, options = {}) {
  const strategy = selectStrategy(promptAnalysis, options);
  const model = selectModel(promptAnalysis, options);
  const creativeType = analyzeCreativeType(promptAnalysis);

  const plan = {
    strategy,
    creativeType,
    steps: [],
    qualityCheckpoints: []
  };

  switch (strategy) {
    case STRATEGIES.SEQUENTIAL:
      plan.steps.push({
        step: 1,
        model,
        purpose: 'Main generation',
        prompt: promptAnalysis.enhanced_prompt,
        parameters: options
      });
      break;

    case STRATEGIES.PARALLEL:
      // Generate multiple variants simultaneously
      const numVariants = options.numVariants || 3;
      for (let i = 0; i < numVariants; i++) {
        plan.steps.push({
          step: i + 1,
          model: i < numVariants - 1 ? 'runware-flux-dev' : model,
          purpose: `Variant ${i + 1}`,
          prompt: promptAnalysis.enhanced_prompt,
          parameters: { ...options, variant: i + 1 }
        });
      }
      break;

    case STRATEGIES.ITERATIVE:
      plan.steps.push(
        {
          step: 1,
          model: 'runware-flux-dev',
          purpose: 'Base image (80% quality)',
          prompt: promptAnalysis.enhanced_prompt,
          parameters: options
        },
        {
          step: 2,
          model: 'runware-kontext',
          purpose: 'Refine details',
          prompt: 'Improve lighting, sharpen details, enhance colors',
          parameters: { ...options, editStrength: 0.5 }
        }
      );
      break;

    case STRATEGIES.COMPOSITE:
      // Multi-element composition
      plan.steps.push(
        {
          step: 1,
          model: 'runware-flux-dev',
          purpose: 'Generate background',
          prompt: extractBackgroundPrompt(promptAnalysis.enhanced_prompt),
          parameters: options
        },
        {
          step: 2,
          model: config.googleApiKey ? 'google-nano-pro' : 'runware-flux-dev',
          purpose: 'Generate main element with text',
          prompt: promptAnalysis.enhanced_prompt,
          parameters: options
        },
        {
          step: 3,
          model: 'runware-kontext',
          purpose: 'Composite and finalize',
          prompt: 'Combine elements seamlessly, ensure text is readable',
          parameters: { ...options, editStrength: 0.7 }
        }
      );
      break;

    case STRATEGIES.STYLE_TRANSFER:
      plan.steps.push({
        step: 1,
        model: 'runware-flux-dev',
        purpose: 'Generate with style reference',
        prompt: promptAnalysis.enhanced_prompt,
        parameters: { ...options, useStyleReference: true }
      });
      break;
  }

  plan.qualityCheckpoints = [
    'Image generated successfully',
    'Text is readable (if any)',
    'Colors match brand/style',
    'Composition is balanced'
  ];

  return plan;
}

/**
 * Helper: extract background-related parts from prompt
 */
function extractBackgroundPrompt(prompt) {
  // Simple extraction — in production would use Claude for this
  const bgKeywords = ['background', 'фон', 'environment', 'scene', 'setting'];
  const words = prompt.split(/[,.]/).filter(part =>
    bgKeywords.some(kw => part.toLowerCase().includes(kw))
  );

  return words.length > 0
    ? words.join(', ') + ', professional lighting, 4K quality'
    : 'Professional background, clean, modern, studio lighting';
}

/**
 * Генерация изображения через Nano Banana Pro
 *
 * ВРЕМЕННО УПРОЩЕНО: Только Google Nano Banana Pro!
 * Если Google упал — просто кидаем ошибку, не пытаемся Runware.
 */
export async function generateImage(prompt, options = {}) {
  const {
    model,
    width = 1200,
    height = 628,
    numImages = 1,
    referenceUrl = null,
    textContent = null,
    textStyle = null,
    visionAnalysis = null  // Vision анализ референса от Claude
  } = options;

  log.info('Starting image generation with Nano Banana Pro', {
    width,
    height,
    numImages,
    hasReference: !!referenceUrl,
    hasText: !!textContent,
    hasVisionAnalysis: !!visionAnalysis
  });

  const startTime = Date.now();

  // ТОЛЬКО Google Nano Banana Pro
  const result = await generateWithGoogle(prompt, {
    model: 'google-nano-pro',
    width,
    height,
    textContent,
    textStyle,
    referenceUrl,
    numImages,
    visionAnalysis  // Передаём Vision анализ в Google!
  });

  return {
    ...result,
    totalTime: Date.now() - startTime
  };
}

/**
 * Execute full generation plan (for complex strategies)
 */
export async function executePlan(plan, promptAnalysis, references = []) {
  const results = [];
  let previousResult = null;

  for (const step of plan.steps) {
    log.info(`Executing step ${step.step}: ${step.purpose}`, { model: step.model });

    try {
      const stepOptions = {
        ...step.parameters,
        referenceUrl: previousResult?.images?.[0] || references[0]?.url
      };

      const result = await generateImage(step.prompt, {
        model: step.model,
        ...stepOptions
      });

      results.push({
        step: step.step,
        purpose: step.purpose,
        model: step.model,
        ...result
      });

      previousResult = result;

    } catch (error) {
      log.error(`Step ${step.step} failed`, { error: error.message });

      // Continue with fallback
      if (step.step < plan.steps.length) {
        log.info('Continuing to next step with fallback');
        continue;
      }

      throw error;
    }
  }

  return {
    strategy: plan.strategy,
    creativeType: plan.creativeType,
    steps: results,
    finalImages: results[results.length - 1]?.images || [],
    totalTime: results.reduce((sum, r) => sum + (r.timeMs || 0), 0)
  };
}

/**
 * Парсинг размера из строки "1200x628", имени пресета, или 'auto'
 * @param {string} sizeInput - размер или 'auto'
 * @param {Array} presets - пресеты из БД
 * @param {string} prompt - промпт для извлечения размера (когда auto)
 */
export function parseSize(sizeInput, presets = [], prompt = '') {
  // Если 'auto' - пытаемся извлечь размер из промпта
  if (sizeInput === 'auto' && prompt) {
    const extracted = extractSizeFromPrompt(prompt);
    if (extracted) {
      log.debug('Size extracted from prompt', extracted);
      return extracted;
    }
    // Если не нашли - используем default
    log.debug('Auto size: no size in prompt, using default');
    return { width: 1024, height: 1024 }; // Default для auto
  }

  if (!sizeInput || sizeInput === 'auto') {
    return { width: 1024, height: 1024 }; // Default
  }

  // Если это строка вида "1200x628"
  const match = sizeInput.match(/^(\d+)x(\d+)$/i);
  if (match) {
    return {
      width: parseInt(match[1]),
      height: parseInt(match[2])
    };
  }

  // Ищем в пресетах по имени
  const preset = presets.find(p =>
    p.name.toLowerCase() === sizeInput.toLowerCase()
  );

  if (preset) {
    return { width: preset.width, height: preset.height };
  }

  // Default
  return { width: 1024, height: 1024 };
}

/**
 * Извлечение размера из промпта
 */
function extractSizeFromPrompt(prompt) {
  // Паттерн 1: "100x600", "100×600", "100X600"
  const xPattern = prompt.match(/(\d{2,4})\s*[xXхХ×]\s*(\d{2,4})/);
  if (xPattern) {
    return { width: parseInt(xPattern[1]), height: parseInt(xPattern[2]) };
  }

  // Паттерн 2: "100 на 600", "100 by 600"
  const naPattern = prompt.match(/(\d{2,4})\s*(?:на|by)\s*(\d{2,4})/i);
  if (naPattern) {
    return { width: parseInt(naPattern[1]), height: parseInt(naPattern[2]) };
  }

  // Паттерн 3: "размер 100 600", "size 100 600"
  const sizePattern = prompt.match(/(?:размер|size)\s*[:\s]*(\d{2,4})\s+(\d{2,4})/i);
  if (sizePattern) {
    return { width: parseInt(sizePattern[1]), height: parseInt(sizePattern[2]) };
  }

  // Паттерн 4: "100*600"
  const starPattern = prompt.match(/(\d{2,4})\s*\*\s*(\d{2,4})/);
  if (starPattern) {
    return { width: parseInt(starPattern[1]), height: parseInt(starPattern[2]) };
  }

  // Паттерн 5: ключевые слова для форматов
  const lowerPrompt = prompt.toLowerCase();

  if (lowerPrompt.includes('stories') || lowerPrompt.includes('сторис')) {
    return { width: 1088, height: 1920 };
  }
  if (lowerPrompt.includes('квадрат') || lowerPrompt.includes('square') || lowerPrompt.includes('пост')) {
    return { width: 1024, height: 1024 };
  }
  if (lowerPrompt.includes('баннер') || lowerPrompt.includes('banner')) {
    return { width: 1216, height: 640 };
  }
  if (lowerPrompt.includes('wide') || lowerPrompt.includes('широк') || lowerPrompt.includes('landscape')) {
    return { width: 1920, height: 1088 };
  }
  if (lowerPrompt.includes('portrait') || lowerPrompt.includes('портрет') || lowerPrompt.includes('vertical')) {
    return { width: 768, height: 1024 };
  }

  return null;
}

/**
 * Получить информацию о доступных моделях
 * ВРЕМЕННО УПРОЩЕНО: Только Nano Banana Pro
 */
export function getAvailableModels() {
  return [
    {
      id: 'google-nano-pro',
      name: 'Nano Banana Pro',
      description: 'Лучшая модель для текста и картинок',
      provider: 'google',
      features: ['text', 'quality', 'identity-lock'],
      costPer1k: 130
    }
  ];
}

/**
 * Get size presets based on Universal Creative Engine
 */
export function getSizePresets() {
  return [
    // Social Media
    { id: 'facebook-feed', name: 'Facebook Feed', width: 1200, height: 628, category: 'social' },
    { id: 'facebook-story', name: 'Facebook Story', width: 1080, height: 1920, category: 'social' },
    { id: 'instagram-square', name: 'Instagram Square', width: 1080, height: 1080, category: 'social' },
    { id: 'instagram-portrait', name: 'Instagram Portrait', width: 1080, height: 1350, category: 'social' },
    { id: 'instagram-story', name: 'Instagram Story', width: 1080, height: 1920, category: 'social' },
    { id: 'twitter-post', name: 'Twitter Post', width: 1200, height: 675, category: 'social' },
    { id: 'linkedin-post', name: 'LinkedIn Post', width: 1200, height: 627, category: 'social' },

    // Video
    { id: 'youtube-thumbnail', name: 'YouTube Thumbnail', width: 1280, height: 720, category: 'video' },
    { id: 'tiktok-cover', name: 'TikTok Cover', width: 1080, height: 1920, category: 'video' },

    // Display Ads
    { id: 'display-leaderboard', name: 'Leaderboard', width: 728, height: 90, category: 'ads' },
    { id: 'display-rectangle', name: 'Medium Rectangle', width: 300, height: 250, category: 'ads' },
    { id: 'display-skyscraper', name: 'Skyscraper', width: 160, height: 600, category: 'ads' },
    { id: 'display-billboard', name: 'Billboard', width: 970, height: 250, category: 'ads' },

    // General
    { id: 'square-1k', name: 'Square 1K', width: 1024, height: 1024, category: 'general' },
    { id: 'square-2k', name: 'Square 2K', width: 2048, height: 2048, category: 'general' },
    { id: 'wide-hd', name: 'Wide HD', width: 1920, height: 1080, category: 'general' },
    { id: 'portrait-hd', name: 'Portrait HD', width: 1080, height: 1920, category: 'general' }
  ];
}
