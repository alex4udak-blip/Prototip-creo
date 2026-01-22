import { config } from '../config/env.js';
import { log } from '../utils/logger.js';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

const RUNWARE_API = 'https://api.runware.ai/v1';

// Модели Runware
const RUNWARE_MODELS = {
  'runware-schnell': 'runware:101@1',     // FLUX Schnell - быстрый (2-3 сек)
  'runware-flux-dev': 'runware:100@1',    // FLUX Dev - качество (5-8 сек)
  'runware-kontext': 'runware:106@1',     // FLUX Kontext - редактирование с референсом
};

/**
 * Поддерживаемые размеры Runware API
 * Из ошибки API: 1024x1024, 1568x672, 1504x688, 1472x704, 1440x720,
 * 1408x736, 1344x768, 1312x784, 1280x800, 1248x832, 1216x864, etc.
 *
 * Все размеры кратны 16 и общая площадь ~ 1 мегапиксель
 */
/**
 * АКТУАЛЬНЫЙ список поддерживаемых размеров Runware API
 * Взято из ошибки API (allowedValues):
 * '1568x672', '1504x688', '1456x720', '1392x752', '1328x800',
 * '1248x832', '1184x880', '1104x944', '1024x1024', '944x1104',
 * '880x1184', '832x1248', '800x1328', '752x1392', '720x1456',
 * '688x1504', '672x1568'
 */
const RUNWARE_SUPPORTED_SIZES = [
  // Квадрат
  { width: 1024, height: 1024 },

  // Широкие (landscape) - для баннеров
  { width: 1568, height: 672 },
  { width: 1504, height: 688 },
  { width: 1456, height: 720 },
  { width: 1392, height: 752 },
  { width: 1328, height: 800 },
  { width: 1248, height: 832 },
  { width: 1184, height: 880 },
  { width: 1104, height: 944 },

  // Вертикальные (portrait) - для stories
  { width: 944, height: 1104 },
  { width: 880, height: 1184 },
  { width: 832, height: 1248 },
  { width: 800, height: 1328 },
  { width: 752, height: 1392 },
  { width: 720, height: 1456 },
  { width: 688, height: 1504 },
  { width: 672, height: 1568 },
];

/**
 * Находит ближайший поддерживаемый размер Runware
 * @param {number} targetWidth - желаемая ширина
 * @param {number} targetHeight - желаемая высота
 * @returns {{ adjustedWidth: number, adjustedHeight: number }}
 */
function findNearestRunwareSize(targetWidth, targetHeight) {
  const targetRatio = targetWidth / targetHeight;

  let bestMatch = RUNWARE_SUPPORTED_SIZES[0];
  let bestScore = Infinity;

  for (const size of RUNWARE_SUPPORTED_SIZES) {
    const sizeRatio = size.width / size.height;

    // Score = разница в aspect ratio + разница в площади (нормализованная)
    const ratioDiff = Math.abs(sizeRatio - targetRatio);
    const areaDiff = Math.abs(
      (size.width * size.height) - (targetWidth * targetHeight)
    ) / 1000000; // Нормализуем

    const score = ratioDiff * 10 + areaDiff; // Приоритет на aspect ratio

    if (score < bestScore) {
      bestScore = score;
      bestMatch = size;
    }
  }

  return {
    adjustedWidth: bestMatch.width,
    adjustedHeight: bestMatch.height
  };
}

/**
 * Конвертирует локальный URL или путь к файлу в base64
 * Runware API требует либо публичный URL, либо base64 data URI
 */
async function prepareImageForRunware(imageUrl) {
  if (!imageUrl) return null;

  // Если уже base64 data URI — возвращаем как есть
  if (imageUrl.startsWith('data:')) {
    return imageUrl;
  }

  // Если это публичный URL (https://) — возвращаем как есть
  if (imageUrl.startsWith('https://') && !imageUrl.includes('localhost')) {
    return imageUrl;
  }

  // Если это локальный путь или localhost URL — конвертируем в base64
  let filePath = imageUrl;

  // Извлекаем имя файла из URL типа /uploads/filename.png или http://localhost/uploads/filename.png
  if (imageUrl.includes('/uploads/')) {
    const filename = imageUrl.split('/uploads/').pop().split('?')[0];
    filePath = path.join(config.storagePath, filename);
  }

  // Проверяем существование файла
  if (!fs.existsSync(filePath)) {
    log.warn('Reference file not found locally, trying URL as-is', { imageUrl, filePath });
    return imageUrl;
  }

  try {
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' :
                     ext === '.webp' ? 'image/webp' :
                     ext === '.gif' ? 'image/gif' : 'image/jpeg';

    const base64 = buffer.toString('base64');
    const dataUri = `data:${mimeType};base64,${base64}`;

    log.debug('Converted local image to base64', {
      filePath,
      mimeType,
      sizeKB: Math.round(buffer.length / 1024)
    });

    return dataUri;
  } catch (error) {
    log.error('Failed to convert image to base64', { error: error.message, filePath });
    throw new Error(`Cannot prepare reference image: ${error.message}`);
  }
}

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
    strength = 0.35  // Сила влияния референса (0-1). 0.35 = вдохновение, 0.65+ = редактирование
  } = options;

  const modelId = RUNWARE_MODELS[model] || RUNWARE_MODELS['runware-flux-dev'];
  const isKontext = model === 'runware-kontext';

  // Подготавливаем референс если есть
  let preparedReference = null;
  if (referenceUrl) {
    preparedReference = await prepareImageForRunware(referenceUrl);
    log.debug('Reference prepared', {
      originalUrl: referenceUrl?.substring(0, 50),
      isBase64: preparedReference?.startsWith('data:'),
      model
    });
  }

  // ВАЖНО: Runware API имеет КОНКРЕТНЫЙ список поддерживаемых размеров!
  // Список из документации: 1024x1024, 1568x672, 1504x688, 1472x704, etc.
  // Нужно найти ближайший поддерживаемый размер
  const { adjustedWidth, adjustedHeight } = findNearestRunwareSize(width, height);

  log.debug('Size adjustment for Runware', {
    originalWidth: width,
    originalHeight: height,
    adjustedWidth,
    adjustedHeight
  });

  // Базовый payload для обычной генерации
  const payload = {
    positivePrompt: prompt,
    negativePrompt: negativePrompt || 'blurry, low quality, distorted, ugly, amateur',
    model: modelId,
    width: adjustedWidth,
    height: adjustedHeight,
    numberResults: Math.min(numImages, 4),
    outputFormat: 'PNG',
    CFGScale: isKontext ? 3.5 : 7.5,
    steps: model === 'runware-schnell' ? 4 : isKontext ? 24 : 28,
    scheduler: 'euler',
    seed: Math.floor(Math.random() * 1000000)
  };

  // Kontext использует специальный формат для редактирования
  if (isKontext && preparedReference) {
    // FLUX Kontext требует inputImages массив для редактирования
    // Kontext = редактирование, нужна высокая strength
    payload.inputImages = [preparedReference];
    payload.strength = 0.7;
    log.debug('Using Kontext edit mode', { strength: 0.7 });
  } else if (preparedReference) {
    // Обычный img2img для FLUX Dev = style reference
    // Низкая strength = референс как вдохновение, а не копирование
    payload.inputImage = preparedReference;
    payload.strength = strength; // 0.35 по умолчанию
    log.debug('Using img2img style mode', { strength });
  }

  log.debug('Runware request', {
    model,
    width,
    height,
    hasReference: !!preparedReference,
    isKontext
  });

  const startTime = Date.now();

  try {
    // Runware API требует массив задач с уникальным taskUUID
    const taskUUID = randomUUID();

    const requestPayload = [{
      taskType: 'imageInference',
      taskUUID: taskUUID,
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

    const responseText = await response.text();

    if (!response.ok) {
      log.error('Runware API error', { status: response.status, error: responseText });

      // Парсим ошибку для лучшей диагностики
      try {
        const errorData = JSON.parse(responseText);
        const errorMessage = errorData.errors?.[0]?.message || errorData.message || responseText;
        throw new Error(`Runware API: ${errorMessage}`);
      } catch (parseError) {
        throw new Error(`Runware API error: ${response.status} - ${responseText}`);
      }
    }

    const data = JSON.parse(responseText);
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

    if (imageUrls.length === 0) {
      log.error('Runware returned no images', { response: data });
      throw new Error('Runware API вернул пустой результат');
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
 * Использует imageUpload task type
 */
export async function uploadToRunware(imageBuffer, filename) {
  if (!config.runwareApiKey) {
    throw new Error('RUNWARE_API_KEY не настроен');
  }

  try {
    // Конвертируем в base64 data URI
    const base64 = imageBuffer.toString('base64');
    const ext = path.extname(filename).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' :
                     ext === '.webp' ? 'image/webp' :
                     ext === '.gif' ? 'image/gif' : 'image/jpeg';

    const dataUri = `data:${mimeType};base64,${base64}`;

    // Runware использует task-based API для всего
    const requestPayload = [{
      taskType: 'imageUpload',
      image: dataUri
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
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const results = data.data || data || [];

    // Ищем URL загруженного изображения
    for (const item of results) {
      if (item.imageURL) {
        log.debug('Image uploaded to Runware', { url: item.imageURL });
        return item.imageURL;
      }
    }

    throw new Error('Runware upload returned no URL');

  } catch (error) {
    log.error('Runware upload failed', { error: error.message });
    throw error;
  }
}

/**
 * Конвертация локального файла в base64 для Runware
 */
export async function convertLocalFileToBase64(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' :
                   ext === '.webp' ? 'image/webp' :
                   ext === '.gif' ? 'image/gif' : 'image/jpeg';

  return `data:${mimeType};base64,${buffer.toString('base64')}`;
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
