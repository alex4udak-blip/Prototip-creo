import { config } from '../config/env.js';
import { log } from '../utils/logger.js';

const RUNWARE_API = 'https://api.runware.ai/v1';

// Модели Runware
const RUNWARE_MODELS = {
  'runware-schnell': 'runware:101@1',     // FLUX Schnell - быстрый (2-3 сек)
  'runware-flux-dev': 'runware:100@1',    // FLUX Dev - качество (5-8 сек)
  'runware-kontext': 'runware:106@1',     // FLUX Kontext - редактирование с референсом
};

/**
 * Генерация изображения через Runware API
 */
export async function generateWithRunware(prompt, options = {}) {
  if (!config.runwareApiKey) {
    throw new Error('RUNWARE_API_KEY не настроен');
  }

  const {
    model = 'runware-flux-dev',
    negativePrompt = '',
    width = 1200,
    height = 628,
    numImages = 1,
    referenceUrl = null,
    strength = 0.65  // Сила влияния референса (0-1)
  } = options;

  const modelId = RUNWARE_MODELS[model] || RUNWARE_MODELS['runware-flux-dev'];

  // Базовый payload
  const payload = {
    positivePrompt: prompt,
    negativePrompt: negativePrompt || 'blurry, low quality, distorted, ugly, amateur',
    model: modelId,
    width: Math.min(width, 1920),  // Ограничиваем максимум
    height: Math.min(height, 1920),
    numberResults: Math.min(numImages, 4),
    outputFormat: 'PNG',
    CFGScale: 7.5,
    steps: model === 'runware-schnell' ? 4 : 28,  // Schnell быстрее с меньшим кол-вом шагов
    scheduler: 'euler',
    seed: Math.floor(Math.random() * 1000000)  // Случайный seed для разнообразия
  };

  // Если есть референс — используем image-to-image
  if (referenceUrl) {
    payload.inputImage = referenceUrl;
    payload.strength = strength;
    log.debug('Using reference image', { referenceUrl, strength });
  }

  log.debug('Runware request', { model, width, height, hasReference: !!referenceUrl });

  const startTime = Date.now();

  try {
    // Runware API требует массив объектов
    const requestPayload = [{
      taskType: 'imageInference',
      ...payload
    }];

    const response = await fetch(`${RUNWARE_API}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.runwareApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestPayload)
    });

    if (!response.ok) {
      const error = await response.text();
      log.error('Runware API error', { status: response.status, error });
      throw new Error(`Runware API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const timeMs = Date.now() - startTime;

    // Извлекаем URL изображений из массива результатов
    const results = data.data || data || [];
    const imageUrls = [];

    for (const item of results) {
      if (item.imageURL) {
        imageUrls.push(item.imageURL);
      } else if (item.images) {
        imageUrls.push(...item.images.map(img => img.imageURL || img.url));
      }
    }

    log.info('Runware generation complete', {
      model,
      timeMs,
      numImages: imageUrls.length
    });

    return {
      images: imageUrls,
      timeMs,
      model: model,
      seed: payload.seed
    };

  } catch (error) {
    log.error('Runware generation failed', { error: error.message });
    throw error;
  }
}

/**
 * Загрузка изображения в Runware (для референсов)
 */
export async function uploadToRunware(imageBuffer, filename) {
  if (!config.runwareApiKey) {
    throw new Error('RUNWARE_API_KEY не настроен');
  }

  try {
    // Конвертируем в base64
    const base64 = imageBuffer.toString('base64');
    const mimeType = filename.endsWith('.png') ? 'image/png' : 'image/jpeg';

    const response = await fetch(`${RUNWARE_API}/image/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.runwareApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image: `data:${mimeType};base64,${base64}`
      })
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }

    const data = await response.json();
    return data.imageURL || data.url;

  } catch (error) {
    log.error('Runware upload failed', { error: error.message });
    throw error;
  }
}

/**
 * Проверка доступности Runware API
 */
export async function checkRunwareHealth() {
  if (!config.runwareApiKey) {
    return { available: false, reason: 'API key not configured' };
  }

  try {
    // Простой тест - получаем баланс или делаем минимальный запрос
    const response = await fetch(`${RUNWARE_API}/account`, {
      headers: {
        'Authorization': `Bearer ${config.runwareApiKey}`
      }
    });

    return {
      available: response.ok,
      status: response.status
    };
  } catch (error) {
    return { available: false, reason: error.message };
  }
}
