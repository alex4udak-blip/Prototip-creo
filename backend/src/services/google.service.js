import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/env.js';
import { log } from '../utils/logger.js';

/**
 * Google Imagen 3 — Nano Banana Pro
 *
 * Модель: imagen-3.0-generate-002
 * API: REST через generativelanguage.googleapis.com
 *
 * ВАЖНО: imagen-3.0-capability-001 (для referenceImages) НЕ доступна через Gemini API!
 * Только через Vertex AI. Поэтому используем только generate-002 + детальное описание.
 *
 * Фичи:
 * - Высокое качество ($0.04/картинка)
 * - aspect_ratio: 1:1, 16:9, 9:16, 4:3, 3:4
 * - sampleCount до 4 картинок
 * - Identity Lock через детальное Vision описание
 *
 * Документация: https://ai.google.dev/gemini-api/docs/imagen
 */

const IMAGEN_MODEL = 'imagen-3.0-generate-002';
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
  const { aspectRatio } = options;

  const url = `${API_BASE}/${IMAGEN_MODEL}:predict?key=${config.googleApiKey}`;

  const requestBody = {
    instances: [{ prompt: prompt }],
    parameters: {
      aspectRatio: aspectRatio,
      sampleCount: 1,
      personGeneration: 'allow_adult',
      safetyFilterLevel: 'block_few'
    }
  };

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
 * Identity Lock через детальное Vision описание в промпте.
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
    onProgress = null,
    visionAnalysis = null  // Детальный анализ референса от Claude Vision
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

  // Если есть референс — добавляем ДЕТАЛЬНОЕ описание от Vision
  if (referenceUrl && visionAnalysis) {
    // Формируем детальное описание референса
    const parts = [];

    if (visionAnalysis.summary) {
      parts.push(`REFERENCE IMAGE DESCRIPTION:\n${visionAnalysis.summary}`);
    }

    if (visionAnalysis.character_description) {
      parts.push(`CHARACTER DETAILS: ${visionAnalysis.character_description}`);
    }

    if (visionAnalysis.style) {
      parts.push(`ART STYLE: ${visionAnalysis.style}`);
    }

    if (visionAnalysis.colors && visionAnalysis.colors.length > 0) {
      parts.push(`COLOR PALETTE: ${visionAnalysis.colors.join(', ')}`);
    }

    if (visionAnalysis.text_on_image) {
      parts.push(`TEXT ON REFERENCE: "${visionAnalysis.text_on_image}"`);
    }

    if (visionAnalysis.background) {
      parts.push(`BACKGROUND: ${visionAnalysis.background}`);
    }

    if (visionAnalysis.objects && visionAnalysis.objects.length > 0) {
      parts.push(`KEY ELEMENTS: ${visionAnalysis.objects.join(', ')}`);
    }

    const referenceDescription = parts.join('\n');

    // Identity Lock через детальное описание
    finalPrompt = `=== IDENTITY LOCK MODE ===

${referenceDescription}

STRICT REQUIREMENTS - MUST PRESERVE:
- Exact same character appearance, face, features
- Same art style, 3D rendering quality, lighting
- Same color palette and visual atmosphere
- Same clothing, accessories, proportions
- Same brand elements and UI style

TASK: ${finalPrompt}

Create a NEW VARIATION that looks like it belongs to the same advertising campaign.
The character must be 100% recognizable and consistent with the reference description above.`;

    log.info('Using Identity Lock with Vision analysis', {
      hasCharacter: !!visionAnalysis.character_description,
      hasStyle: !!visionAnalysis.style,
      descriptionLength: referenceDescription.length
    });
  } else if (referenceUrl) {
    // Есть референс, но нет Vision анализа — базовые инструкции
    finalPrompt = `Create an image in the same style as the reference.

TASK: ${finalPrompt}

Maintain consistent visual style, quality, and atmosphere.`;

    log.warn('Reference without Vision analysis - using basic instructions');
  }

  log.info('Imagen 3 parallel generation starting', {
    model: IMAGEN_MODEL,
    aspectRatio,
    numImages: requestedImages,
    hasReference: !!referenceUrl,
    hasVisionAnalysis: !!visionAnalysis,
    hasText: !!textContent,
    promptLength: finalPrompt.length
  });

  const startTime = Date.now();

  // ПАРАЛЛЕЛЬНАЯ генерация — все запросы одновременно!
  const generateOptions = { aspectRatio };

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
    aspectRatio
  });

  return {
    images,
    timeMs,
    model: IMAGEN_MODEL
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
    const url = `${API_BASE}/${IMAGEN_MODEL}:predict?key=${config.googleApiKey}`;
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
      return { available: true, model: IMAGEN_MODEL };
    } else {
      const error = await response.json().catch(() => ({}));
      return { available: false, reason: error.error?.message || response.statusText };
    }
  } catch (error) {
    return { available: false, reason: error.message };
  }
}
