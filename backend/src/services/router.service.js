import { generateWithRunware } from './runware.service.js';
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
 * Based on Universal Creative Engine rules
 *
 * DECISION TREE:
 * 1. User explicit choice → use it
 * 2. Infographic/diagram → Google Nano Pro (REQUIRED)
 * 3. Long text (>4 words) → Google Nano Pro
 * 4. Short text (1-4 words) → Google Nano
 * 5. Reference + edit needed → Runware Kontext
 * 6. Reference + character consistency → Google Nano Pro (Identity Lock)
 * 7. Reference + style transfer → Runware FLUX Dev
 * 8. Quick draft/meme → Runware Schnell
 * 9. Default → Runware FLUX Dev
 */
export function selectModel(promptAnalysis, options = {}) {
  const { hasReference = false, userPreference = 'auto' } = options;

  // Если пользователь выбрал конкретную модель — используем её
  if (userPreference && userPreference !== 'auto') {
    log.debug('Using user-selected model', { model: userPreference });
    return userPreference;
  }

  const creativeType = analyzeCreativeType(promptAnalysis);
  const hasGoogleApi = !!config.googleApiKey;
  const suggestedModel = promptAnalysis.suggested_model || '';

  // Логируем входные данные для отладки
  log.debug('Model selection input', {
    creativeType,
    suggestedModel,
    hasReference,
    needsText: promptAnalysis.needs_text,
    textContent: promptAnalysis.text_content?.substring(0, 20),
    referencePurpose: promptAnalysis.reference_purpose,
    needsCharacterConsistency: promptAnalysis.needs_character_consistency,
    hasGoogleApi
  });

  // PRIORITY 1: Infographic ALWAYS uses Nano Banana Pro
  if (creativeType === CREATIVE_TYPES.INFOGRAPHIC) {
    if (hasGoogleApi) {
      log.info('MODEL DECISION: google-nano-pro for infographic (REQUIRED)', { reason: 'infographic' });
      return 'google-nano-pro';
    }
    log.warn('Infographic requested but Google API not available! Using FLUX Dev fallback');
    return 'runware-flux-dev';
  }

  // PRIORITY 2: Text on image — critical for readability
  if (promptAnalysis.needs_text && promptAnalysis.text_content) {
    const textLength = (promptAnalysis.text_content || '').split(/\s+/).filter(w => w.length > 0).length;

    // Long text (>4 words) — Google Nano Pro is MUCH better
    if (textLength > 4) {
      if (hasGoogleApi) {
        log.info('MODEL DECISION: google-nano-pro for long text', {
          reason: 'long_text',
          wordCount: textLength,
          text: promptAnalysis.text_content?.substring(0, 30)
        });
        return 'google-nano-pro';
      }
      log.warn('Long text needs Google API for quality! Falling back to FLUX Dev');
      return 'runware-flux-dev';
    }

    // Short text (1-4 words) — Google Nano is good enough
    if (hasGoogleApi) {
      log.info('MODEL DECISION: google-nano for short text', {
        reason: 'short_text',
        wordCount: textLength,
        text: promptAnalysis.text_content?.substring(0, 30)
      });
      return 'google-nano';
    }

    log.warn('Text rendering needs Google API! Falling back to FLUX Dev (text may be imperfect)');
    return 'runware-flux-dev';
  }

  // PRIORITY 3: Reference image handling
  if (hasReference) {
    // Claude suggested Kontext — trust it for editing
    if (suggestedModel === 'kontext' || suggestedModel === 'flux-kontext') {
      log.info('MODEL DECISION: runware-kontext for reference editing', { reason: 'claude_suggested_kontext' });
      return 'runware-kontext';
    }

    // Character consistency with reference — Google Identity Lock
    if (promptAnalysis.needs_character_consistency && hasGoogleApi) {
      log.info('MODEL DECISION: google-nano-pro for character consistency', { reason: 'identity_lock' });
      return 'google-nano-pro';
    }

    // Reference purpose determines model
    const purpose = promptAnalysis.reference_purpose || 'edit';

    if (purpose === 'style') {
      log.info('MODEL DECISION: runware-flux-dev for style transfer', { reason: 'style_reference' });
      return 'runware-flux-dev';
    }

    if (purpose === 'edit' || purpose === 'modify' || purpose === 'composition') {
      log.info('MODEL DECISION: runware-kontext for reference editing', { reason: 'edit_reference' });
      return 'runware-kontext';
    }

    // Default for reference — Kontext
    log.info('MODEL DECISION: runware-kontext (default for reference)', { reason: 'has_reference' });
    return 'runware-kontext';
  }

  // PRIORITY 4: Speed requirements
  if (creativeType === CREATIVE_TYPES.MEME) {
    log.info('MODEL DECISION: runware-schnell for meme', { reason: 'meme_speed' });
    return 'runware-schnell';
  }

  if (suggestedModel === 'flux-schnell' || suggestedModel === 'schnell') {
    log.info('MODEL DECISION: runware-schnell for quick draft', { reason: 'claude_suggested_schnell' });
    return 'runware-schnell';
  }

  // PRIORITY 5: Claude's suggestion (if not handled above)
  if (suggestedModel === 'nano-banana-pro' && hasGoogleApi) {
    log.info('MODEL DECISION: google-nano-pro (Claude suggested)', { reason: 'claude_suggested' });
    return 'google-nano-pro';
  }

  if (suggestedModel === 'nano-banana' && hasGoogleApi) {
    log.info('MODEL DECISION: google-nano (Claude suggested)', { reason: 'claude_suggested' });
    return 'google-nano';
  }

  if (suggestedModel === 'flux-dev') {
    log.info('MODEL DECISION: runware-flux-dev (Claude suggested)', { reason: 'claude_suggested' });
    return 'runware-flux-dev';
  }

  // PRIORITY 6: Default — FLUX Dev for quality
  log.info('MODEL DECISION: runware-flux-dev (default)', { reason: 'default_quality' });
  return 'runware-flux-dev';
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
 * Генерация изображения через выбранную модель
 *
 * Routing logic:
 * - google-* models -> generateWithGoogle
 * - runware-* models -> generateWithRunware
 *
 * Reference handling:
 * - Google: может использовать для Identity Lock
 * - Runware Kontext: для редактирования
 * - Runware FLUX: для style transfer
 */
export async function generateImage(prompt, options = {}) {
  const {
    model,
    negativePrompt = 'blurry, low quality, distorted, ugly, amateur, deformed',
    width = 1200,
    height = 628,
    numImages = 1,
    referenceUrl = null,
    textContent = null,
    textStyle = null,
    useStyleReference = false,
    strength = 0.7  // Renamed from editStrength for clarity
  } = options;

  log.info('Starting image generation', {
    model,
    width,
    height,
    hasReference: !!referenceUrl,
    hasText: !!textContent,
    strength: referenceUrl ? strength : null
  });

  const startTime = Date.now();

  try {
    let result;

    // Выбираем провайдера по модели
    if (model && model.startsWith('google')) {
      // Google Nano Banana / Nano Banana Pro
      result = await generateWithGoogle(prompt, {
        model,
        width,
        height,
        textContent,
        textStyle,
        referenceUrl  // Google может использовать для Identity Lock
      });
    } else {
      // Runware (FLUX Schnell, FLUX Dev, Kontext)
      result = await generateWithRunware(prompt, {
        model: model || 'runware-flux-dev',
        negativePrompt,
        width,
        height,
        numImages,
        referenceUrl,
        strength,  // Для img2img и Kontext
        useStyleReference
      });
    }

    const totalTime = Date.now() - startTime;

    log.info('Image generation complete', {
      model,
      totalTime,
      numImages: result.images?.length || 0
    });

    return {
      ...result,
      totalTime
    };

  } catch (error) {
    log.error('Image generation failed', {
      model,
      error: error.message,
      stack: error.stack?.substring(0, 200)
    });

    const timeElapsed = Date.now() - startTime;

    // Fallback strategy: try alternative model
    const shouldFallback = model !== 'runware-flux-dev' && !model?.startsWith('google');

    if (shouldFallback) {
      log.info('Attempting fallback to runware-flux-dev', { originalModel: model, hasReference: !!referenceUrl });

      try {
        // Для fallback используем FLUX Dev, но если есть референс — пробуем Kontext
        const fallbackModel = referenceUrl ? 'runware-kontext' : 'runware-flux-dev';

        const fallbackResult = await generateWithRunware(prompt, {
          model: fallbackModel,
          negativePrompt,
          width,
          height,
          numImages,
          referenceUrl // Передаём референс в fallback
        });

        return {
          ...fallbackResult,
          totalTime: Date.now() - startTime,
          fallback: true,
          originalModel: model,
          fallbackReason: error.message
        };
      } catch (fallbackError) {
        log.error('Fallback also failed', {
          error: fallbackError.message,
          originalError: error.message
        });
      }
    }

    // If Google failed, try Runware as fallback
    if (model?.startsWith('google') && config.runwareApiKey) {
      log.info('Google failed, trying Runware fallback', { hasReference: !!referenceUrl });

      try {
        // Если был референс — используем Kontext, иначе FLUX Dev
        const fallbackModel = referenceUrl ? 'runware-kontext' : 'runware-flux-dev';

        const fallbackResult = await generateWithRunware(prompt, {
          model: fallbackModel,
          negativePrompt,
          width,
          height,
          numImages,
          referenceUrl // Передаём референс
        });

        return {
          ...fallbackResult,
          totalTime: Date.now() - startTime,
          fallback: true,
          originalModel: model,
          fallbackReason: `Google API error: ${error.message}`
        };
      } catch (fallbackError) {
        log.error('Runware fallback also failed', { error: fallbackError.message });
      }
    }

    throw error;
  }
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
 * Парсинг размера из строки "1200x628" или имени пресета
 */
export function parseSize(sizeInput, presets = []) {
  if (!sizeInput) {
    return { width: 1200, height: 628 }; // Default
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
  return { width: 1200, height: 628 };
}

/**
 * Получить информацию о доступных моделях
 */
export function getAvailableModels() {
  const models = [];

  // Runware модели (всегда доступны если есть ключ)
  if (config.runwareApiKey) {
    models.push(
      {
        id: 'runware-flux-dev',
        name: 'FLUX Dev',
        description: 'Высокое качество, 5-8 сек',
        provider: 'runware',
        features: ['quality', 'details'],
        costPer1k: 4 // $0.004
      },
      {
        id: 'runware-schnell',
        name: 'FLUX Schnell',
        description: 'Быстрый черновик, 2-3 сек',
        provider: 'runware',
        features: ['fast', 'draft'],
        costPer1k: 0.6 // $0.0006
      },
      {
        id: 'runware-kontext',
        name: 'FLUX Kontext',
        description: 'Редактирование с референсом',
        provider: 'runware',
        features: ['reference', 'edit'],
        costPer1k: 10 // $0.01
      }
    );
  }

  // Google модели
  if (config.googleApiKey) {
    models.push(
      {
        id: 'google-nano',
        name: 'Nano Banana',
        description: 'Быстрый, хороший текст',
        provider: 'google',
        features: ['text', 'fast'],
        costPer1k: 39 // $0.039
      },
      {
        id: 'google-nano-pro',
        name: 'Nano Banana Pro',
        description: 'Лучший для текста и инфографик',
        provider: 'google',
        features: ['text', 'quality', 'identity-lock'],
        costPer1k: 130 // $0.13
      }
    );
  }

  return models;
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
