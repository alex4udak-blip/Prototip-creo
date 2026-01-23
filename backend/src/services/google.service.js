import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/env.js';
import { log } from '../utils/logger.js';

/**
 * Google Imagen 3 — Настоящий Nano Banana Pro!
 *
 * Модели:
 * - imagen-3.0-generate-002 — генерация
 * - imagen-3.0-capability-001 — с референсами (Subject/Style Customization)
 *
 * API: REST через generativelanguage.googleapis.com
 *
 * Фичи:
 * - Высокое качество
 * - aspect_ratio: 1:1, 16:9, 9:16, 4:3, 3:4
 * - referenceImages для Identity Lock
 * - sampleCount до 4 картинок
 *
 * Документация: https://ai.google.dev/gemini-api/docs/imagen
 */

const IMAGEN_GENERATE_MODEL = 'imagen-3.0-generate-002';
const IMAGEN_CAPABILITY_MODEL = 'imagen-3.0-capability-001';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Определение aspect ratio для Imagen 3
 */
function getAspectRatio(width, height) {
  const ratio = width / height;

  if (ratio >= 1.7) return '16:9';
  if (ratio >= 1.2) return '4:3';
  if (ratio <= 0.6) return '9:16';
  if (ratio <= 0.85) return '3:4';
  return '1:1';
}

/**
 * Подготовка референса (base64)
 */
async function prepareReferenceBase64(referenceUrl) {
  if (!referenceUrl) return null;

  let filePath = referenceUrl;

  if (referenceUrl.includes('/uploads/')) {
    const filename = referenceUrl.split('/uploads/').pop().split('?')[0];
    filePath = path.join(config.storagePath, filename);
  }

  if (!fs.existsSync(filePath)) {
    log.warn('Reference file not found', { referenceUrl, filePath });
    return null;
  }

  try {
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' :
                     ext === '.webp' ? 'image/webp' : 'image/jpeg';

    log.debug('Prepared reference for Imagen', {
      filePath,
      mimeType,
      sizeKB: Math.round(buffer.length / 1024)
    });

    return {
      base64: buffer.toString('base64'),
      mimeType
    };
  } catch (error) {
    log.error('Failed to prepare reference', { error: error.message });
    return null;
  }
}

/**
 * Сохранение base64 изображения в файл
 */
async function saveBase64Image(base64Data, mimeType = 'image/png') {
  const ext = mimeType === 'image/jpeg' ? '.jpg' : '.png';
  const filename = `${uuidv4()}${ext}`;
  const filepath = path.join(config.storagePath, filename);

  if (!fs.existsSync(config.storagePath)) {
    fs.mkdirSync(config.storagePath, { recursive: true });
  }

  const buffer = Buffer.from(base64Data, 'base64');
  fs.writeFileSync(filepath, buffer);

  log.debug('Saved generated image', { filename, sizeKB: Math.round(buffer.length / 1024) });

  return `/uploads/${filename}`;
}

/**
 * Генерация ОДНОГО изображения через Imagen 3
 * Возвращает URL или null если ошибка
 */
async function generateSingleImage(prompt, options, index, onProgress) {
  const {
    aspectRatio,
    referenceData,
    useCapabilityModel
  } = options;

  const model = useCapabilityModel ? IMAGEN_CAPABILITY_MODEL : IMAGEN_GENERATE_MODEL;
  const url = `${API_BASE}/${model}:predict?key=${config.googleApiKey}`;

  // Формируем тело запроса
  let requestBody;

  if (useCapabilityModel && referenceData) {
    // С референсом — используем capability model
    requestBody = {
      instances: [{
        prompt: prompt,
        referenceImages: [{
          referenceType: 'REFERENCE_TYPE_SUBJECT',
          referenceId: 1,
          referenceImage: {
            bytesBase64Encoded: referenceData.base64
          },
          subjectImageConfig: {
            subjectType: 'SUBJECT_TYPE_PERSON'
          }
        }]
      }],
      parameters: {
        aspectRatio: aspectRatio,
        sampleCount: 1,
        personGeneration: 'allow_adult',
        safetyFilterLevel: 'block_few'
      }
    };
  } else {
    // Без референса — обычная генерация
    requestBody = {
      instances: [{ prompt: prompt }],
      parameters: {
        aspectRatio: aspectRatio,
        sampleCount: 1,
        personGeneration: 'allow_adult',
        safetyFilterLevel: 'block_few'
      }
    };
  }

  try {
    if (onProgress) {
      onProgress({ index, status: 'generating', message: `Генерирую вариант ${index + 1}...` });
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      log.warn(`Imagen generation ${index + 1} failed`, {
        status: response.status,
        error: errorData?.error?.message || response.statusText
      });
      return null;
    }

    const result = await response.json();
    const predictions = result.predictions || [];

    if (predictions.length > 0 && predictions[0].bytesBase64Encoded) {
      const imageUrl = await saveBase64Image(
        predictions[0].bytesBase64Encoded,
        predictions[0].mimeType || 'image/png'
      );

      if (onProgress) {
        onProgress({ index, status: 'complete', imageUrl });
      }

      return imageUrl;
    }

    return null;

  } catch (error) {
    log.warn(`Imagen generation ${index + 1} error`, { error: error.message });
    return null;
  }
}

/**
 * Генерация изображений через Imagen 3 (Nano Banana Pro)
 *
 * ПАРАЛЛЕЛЬНАЯ генерация — как у Genspark!
 * Каждое изображение генерится отдельным запросом параллельно.
 */
export async function generateWithGoogle(prompt, options = {}) {
  if (!config.googleApiKey) {
    throw new Error('GOOGLE_API_KEY не настроен');
  }

  const {
    width = 1024,
    height = 1024,
    textContent = null,
    textStyle = null,
    referenceUrl = null,
    numImages = 1,
    onProgress = null  // Callback для прогресса
  } = options;

  const aspectRatio = getAspectRatio(width, height);
  const requestedImages = Math.min(numImages || 1, 4);

  // Формируем промпт
  let finalPrompt = prompt;

  // Добавляем текст
  if (textContent) {
    finalPrompt = `${finalPrompt}

IMPORTANT: Include this exact text prominently in the image: "${textContent}"
Text style: ${textStyle || 'bold, high contrast, professional typography'}
Make the text clearly readable and a key visual element.`;
  }

  // Подготавливаем референс если есть
  let referenceData = null;
  let useCapabilityModel = false;

  if (referenceUrl) {
    referenceData = await prepareReferenceBase64(referenceUrl);
    if (referenceData) {
      useCapabilityModel = true;

      // Добавляем Identity Lock инструкции
      finalPrompt = `Create a variation using [1] as the reference subject.

IDENTITY LOCK - PRESERVE EXACTLY:
- This exact person's face, features, proportions
- Same character identity 100%
- Same art style and rendering quality
- Same clothing style and colors
- Same visual atmosphere

TASK: ${finalPrompt}

The new image must look like it belongs to the same campaign.
Reference subject [1] must be clearly recognizable.`;

      log.info('Using Imagen Capability model with reference', { referenceUrl });
    }
  }

  log.info('Imagen 3 parallel generation starting', {
    aspectRatio,
    numImages: requestedImages,
    hasReference: !!referenceData,
    useCapabilityModel,
    hasText: !!textContent
  });

  const startTime = Date.now();

  // ПАРАЛЛЕЛЬНАЯ генерация — все запросы одновременно!
  const generateOptions = {
    aspectRatio,
    referenceData,
    useCapabilityModel
  };

  const promises = Array.from({ length: requestedImages }, (_, i) =>
    generateSingleImage(finalPrompt, generateOptions, i, onProgress)
  );

  // Ждём все результаты параллельно
  const results = await Promise.all(promises);
  const images = results.filter(url => url !== null);

  const timeMs = Date.now() - startTime;

  if (images.length === 0) {
    log.error('Imagen 3 returned no images', { requestedImages });
    throw new Error('Imagen 3 не вернул изображения. Попробуйте изменить запрос.');
  }

  log.info('Imagen 3 generation complete', {
    timeMs,
    requestedImages,
    actualImages: images.length,
    aspectRatio,
    usedCapabilityModel: useCapabilityModel
  });

  return {
    images,
    timeMs,
    model: useCapabilityModel ? IMAGEN_CAPABILITY_MODEL : IMAGEN_GENERATE_MODEL
  };
}

/**
 * Проверка доступности Imagen 3 API
 */
export function isGoogleApiAvailable() {
  return !!config.googleApiKey;
}

/**
 * Health check для Imagen 3
 */
export async function checkGoogleHealth() {
  if (!config.googleApiKey) {
    return { available: false, reason: 'API key not configured' };
  }

  try {
    const url = `${API_BASE}/${IMAGEN_GENERATE_MODEL}:predict?key=${config.googleApiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt: 'A simple blue square' }],
        parameters: {
          aspectRatio: '1:1',
          sampleCount: 1
        }
      })
    });

    if (response.ok) {
      return { available: true, model: IMAGEN_GENERATE_MODEL };
    } else {
      const error = await response.json().catch(() => ({}));
      return { available: false, reason: error.error?.message || response.statusText };
    }
  } catch (error) {
    return { available: false, reason: error.message };
  }
}
