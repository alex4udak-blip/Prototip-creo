import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/env.js';
import { log } from '../utils/logger.js';

/**
 * Google Imagen 3 — Настоящий Nano Banana Pro!
 *
 * Модель: imagen-3.0-generate-002
 * API: REST через generativelanguage.googleapis.com
 *
 * Преимущества:
 * - Высокое качество (не как flash-exp хуйня)
 * - Поддержка aspect_ratio (1:1, 16:9, 9:16, 4:3, 3:4)
 * - Несколько изображений за раз
 * - $0.03 за картинку
 *
 * Документация: https://ai.google.dev/gemini-api/docs/imagen
 */

const IMAGEN_MODEL = 'imagen-3.0-generate-002';
const IMAGEN_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGEN_MODEL}:predict`;

/**
 * Определение aspect ratio для Imagen 3
 * Поддерживаемые: 1:1, 16:9, 9:16, 4:3, 3:4
 */
function getAspectRatio(width, height) {
  const ratio = width / height;

  // 16:9 (широкий баннер)
  if (ratio >= 1.7) return '16:9';
  // 4:3 (классический)
  if (ratio >= 1.2) return '4:3';
  // 9:16 (stories, вертикальный)
  if (ratio <= 0.6) return '9:16';
  // 3:4 (портрет)
  if (ratio <= 0.85) return '3:4';
  // 1:1 (квадрат)
  return '1:1';
}

/**
 * Подготовка референса для Identity Lock (base64)
 */
async function prepareReferenceBase64(referenceUrl) {
  if (!referenceUrl) return null;

  let filePath = referenceUrl;

  // Извлекаем имя файла из URL типа /uploads/filename.png
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
 * Генерация изображения через Imagen 3 (Nano Banana Pro)
 *
 * ЭТО НАСТОЯЩЕЕ КАЧЕСТВО — не flash-exp хуйня!
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
    numImages = 1
  } = options;

  const aspectRatio = getAspectRatio(width, height);
  const requestedImages = Math.min(numImages || 1, 4); // Imagen 3 max 4 за раз

  // Формируем промпт
  let finalPrompt = prompt;

  // Добавляем текст если есть
  if (textContent) {
    finalPrompt = `${finalPrompt}

IMPORTANT: Include this exact text prominently in the image: "${textContent}"
Text style: ${textStyle || 'bold, high contrast, professional typography'}
Make the text clearly readable and a key visual element.`;
  }

  // Если есть референс — добавляем Identity Lock инструкции
  if (referenceUrl) {
    const refData = await prepareReferenceBase64(referenceUrl);
    if (refData) {
      // Imagen 3 не поддерживает image input напрямую в predict
      // Но мы добавляем детальное описание для Identity Lock
      finalPrompt = `=== IDENTITY LOCK MODE ===

Create a NEW VARIATION based on the reference image style.

PRESERVE EXACTLY:
- Character appearance, facial features, proportions
- Art style, 3D rendering quality
- Color palette and lighting
- Brand elements (treasure chests, coins, UI elements)
- Visual atmosphere (neon, casino, premium feel)

TASK:
${finalPrompt}

Generate a professional advertising banner that looks like it belongs to the same campaign.
Maintain 100% character consistency with the original reference.`;

      log.info('Added Identity Lock instructions', { referenceUrl });
    }
  }

  log.info('Imagen 3 generation starting', {
    aspectRatio,
    numImages: requestedImages,
    hasReference: !!referenceUrl,
    hasText: !!textContent,
    promptLength: finalPrompt.length
  });

  const startTime = Date.now();

  try {
    // REST API запрос к Imagen 3
    const response = await fetch(`${IMAGEN_API_URL}?key=${config.googleApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        instances: [{ prompt: finalPrompt }],
        parameters: {
          aspectRatio: aspectRatio,
          sampleCount: requestedImages,
          personGeneration: 'allow_adult',
          safetyFilterLevel: 'block_few'  // Менее строгий фильтр
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      log.error('Imagen 3 API error', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });

      if (response.status === 400) {
        throw new Error('Imagen 3 отклонил запрос. Попробуйте изменить описание.');
      }
      if (response.status === 403) {
        throw new Error('Нет доступа к Imagen 3 API. Проверьте API ключ и включен ли Imagen в консоли.');
      }
      if (response.status === 429) {
        throw new Error('Превышен лимит запросов. Попробуйте позже.');
      }

      throw new Error(`Imagen 3 API error: ${response.status}`);
    }

    const result = await response.json();

    // Извлекаем изображения из ответа
    const predictions = result.predictions || [];
    const images = [];

    for (const prediction of predictions) {
      if (prediction.bytesBase64Encoded) {
        const mimeType = prediction.mimeType || 'image/png';
        const imageUrl = await saveBase64Image(prediction.bytesBase64Encoded, mimeType);
        images.push(imageUrl);
      }
    }

    const timeMs = Date.now() - startTime;

    if (images.length === 0) {
      log.warn('Imagen 3 returned no images', { result });
      throw new Error('Imagen 3 не вернул изображения. Попробуйте изменить запрос.');
    }

    log.info('Imagen 3 generation complete', {
      timeMs,
      requestedImages,
      actualImages: images.length,
      aspectRatio
    });

    return {
      images,
      timeMs,
      model: 'imagen-3.0-generate-002'
    };

  } catch (error) {
    log.error('Imagen 3 generation failed', {
      error: error.message,
      hasReference: !!referenceUrl
    });

    // Улучшаем сообщения об ошибках
    if (error.message.includes('SAFETY') || error.message.includes('blocked')) {
      throw new Error('Imagen 3 отклонил запрос по соображениям безопасности. Измените описание.');
    }
    if (error.message.includes('quota') || error.message.includes('RESOURCE_EXHAUSTED')) {
      throw new Error('Превышен лимит запросов к Imagen 3. Попробуйте позже.');
    }

    throw error;
  }
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
    // Простой тест — генерируем минимальное изображение
    const response = await fetch(`${IMAGEN_API_URL}?key=${config.googleApiKey}`, {
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
      return { available: true, model: IMAGEN_MODEL };
    } else {
      const error = await response.json().catch(() => ({}));
      return { available: false, reason: error.error?.message || response.statusText };
    }
  } catch (error) {
    return { available: false, reason: error.message };
  }
}
