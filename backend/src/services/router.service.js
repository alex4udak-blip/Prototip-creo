import { generateWithRunware } from './runware.service.js';
import { generateWithGoogle } from './google.service.js';
import { config } from '../config/env.js';
import { log } from '../utils/logger.js';

/**
 * Автоматический выбор лучшей модели для задачи
 */
export function selectModel(promptAnalysis, options = {}) {
  const { hasReference = false, userPreference = 'auto' } = options;

  // Если пользователь выбрал конкретную модель — используем её
  if (userPreference && userPreference !== 'auto') {
    log.debug('Using user-selected model', { model: userPreference });
    return userPreference;
  }

  // Автоматический выбор на основе анализа

  // 1. Нужен точный текст на баннере? → Google Nano Banana (лучший text rendering)
  if (promptAnalysis.needs_text && promptAnalysis.text_content) {
    // Проверяем доступность Google API
    if (config.googleApiKey) {
      log.debug('Selected google-nano for text rendering', {
        textContent: promptAnalysis.text_content?.substring(0, 30)
      });
      return 'google-nano';
    }
    // Fallback на Runware если Google недоступен
    log.warn('Google API not available, falling back to Runware for text');
  }

  // 2. Есть референс для редактирования? → Runware Kontext
  if (hasReference) {
    if (promptAnalysis.suggested_model === 'kontext') {
      log.debug('Selected runware-kontext for reference editing');
      return 'runware-kontext';
    }
    // Для стилизации по референсу тоже используем Kontext
    log.debug('Selected runware-kontext for reference-based generation');
    return 'runware-kontext';
  }

  // 3. Рекомендация от Claude — flux-schnell (быстрый черновик)?
  if (promptAnalysis.suggested_model === 'flux-schnell') {
    log.debug('Selected runware-schnell for quick draft');
    return 'runware-schnell';
  }

  // 4. По умолчанию — Runware FLUX Dev (баланс качества и скорости)
  log.debug('Selected runware-flux-dev as default');
  return 'runware-flux-dev';
}

/**
 * Генерация изображения через выбранную модель
 */
export async function generateImage(prompt, options = {}) {
  const {
    model,
    negativePrompt = '',
    width = 1200,
    height = 628,
    numImages = 1,
    referenceUrl = null,
    textContent = null,
    textStyle = null
  } = options;

  log.info('Starting image generation', {
    model,
    width,
    height,
    hasReference: !!referenceUrl,
    hasText: !!textContent
  });

  const startTime = Date.now();

  try {
    let result;

    // Выбираем провайдера по модели
    if (model.startsWith('google')) {
      // Google Nano Banana
      result = await generateWithGoogle(prompt, {
        model,
        width,
        height,
        textContent,
        textStyle
      });
    } else {
      // Runware (FLUX)
      result = await generateWithRunware(prompt, {
        model,
        negativePrompt,
        width,
        height,
        numImages,
        referenceUrl
      });
    }

    const totalTime = Date.now() - startTime;

    log.info('Image generation complete', {
      model,
      totalTime,
      numImages: result.images.length
    });

    return {
      ...result,
      totalTime
    };

  } catch (error) {
    log.error('Image generation failed', {
      model,
      error: error.message
    });

    // Пробуем fallback если основная модель упала
    if (model !== 'runware-flux-dev') {
      log.info('Attempting fallback to runware-flux-dev');
      try {
        const fallbackResult = await generateWithRunware(prompt, {
          model: 'runware-flux-dev',
          negativePrompt,
          width,
          height,
          numImages
        });

        return {
          ...fallbackResult,
          totalTime: Date.now() - startTime,
          fallback: true,
          originalModel: model
        };
      } catch (fallbackError) {
        log.error('Fallback also failed', { error: fallbackError.message });
      }
    }

    throw error;
  }
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
        features: ['quality', 'details']
      },
      {
        id: 'runware-schnell',
        name: 'FLUX Schnell',
        description: 'Быстрый черновик, 2-3 сек',
        provider: 'runware',
        features: ['fast', 'draft']
      },
      {
        id: 'runware-kontext',
        name: 'FLUX Kontext',
        description: 'Редактирование с референсом',
        provider: 'runware',
        features: ['reference', 'edit']
      }
    );
  }

  // Google модели
  if (config.googleApiKey) {
    models.push({
      id: 'google-nano',
      name: 'Nano Banana Pro',
      description: 'Лучший для текста на баннерах',
      provider: 'google',
      features: ['text', 'quality']
    });
  }

  return models;
}
