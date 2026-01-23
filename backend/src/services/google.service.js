import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/env.js';
import { log } from '../utils/logger.js';

/**
 * Google Imagen 3 через Vertex AI
 *
 * ТОЛЬКО Vertex AI с imagen-3.0-capability-001!
 * Поддерживает референсы для Identity Lock.
 *
 * Переменные окружения:
 * - GOOGLE_CLOUD_PROJECT — ID проекта
 * - GOOGLE_APPLICATION_CREDENTIALS_JSON — JSON service account
 */

// Разные модели для разных задач!
const IMAGEN_MODEL_GENERATE = 'imagen-3.0-generate-002';  // Для обычной генерации
const IMAGEN_MODEL_CUSTOMIZE = 'imagen-3.0-capability-001';  // Для Identity Lock (с референсом)
const VERTEX_LOCATION = 'us-central1';

/**
 * Получить Access Token для Vertex AI через Service Account
 */
async function getVertexAccessToken() {
  const credentialsJson = config.googleCredentialsJson;
  if (!credentialsJson) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON не настроен');
  }

  try {
    const credentials = typeof credentialsJson === 'string'
      ? JSON.parse(credentialsJson)
      : credentialsJson;

    const { GoogleAuth } = await import('google-auth-library');
    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });

    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    return tokenResponse.token;
  } catch (error) {
    log.error('Failed to get Vertex AI access token', { error: error.message });
    throw new Error(`Vertex AI auth failed: ${error.message}`);
  }
}

/**
 * Формирует styleDescription из visionAnalysis
 * Используется для REFERENCE_TYPE_STYLE
 */
function buildStyleDescription(visionAnalysis) {
  if (!visionAnalysis) {
    return 'vibrant advertising banner style, professional quality, bold colors, high contrast';
  }

  const parts = [];

  // Стиль рендера (3D, cartoon, photorealistic)
  if (visionAnalysis.style) {
    parts.push(visionAnalysis.style);
  }

  // Цветовая палитра
  if (visionAnalysis.colors?.length > 0) {
    parts.push(`color palette: ${visionAnalysis.colors.join(', ')}`);
  }

  // Освещение
  if (visionAnalysis.lighting) {
    parts.push(visionAnalysis.lighting);
  }

  // Фон
  if (visionAnalysis.background_description) {
    parts.push(`background style: ${visionAnalysis.background_description}`);
  }

  // Ключевые объекты
  if (visionAnalysis.objects?.length > 0) {
    parts.push(`featuring: ${visionAnalysis.objects.join(', ')}`);
  }

  // Тип контента (casino, gaming, etc)
  if (visionAnalysis.content_type) {
    parts.push(`${visionAnalysis.content_type} aesthetic`);
  }

  const result = parts.join('. ');
  return result || 'vibrant advertising banner style, professional quality, bold colors';
}

/**
 * Определение aspect ratio для Imagen 3
 * Поддерживаемые: 1:1, 16:9, 9:16, 4:3, 3:4
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
    return buffer.toString('base64');
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
 * Генерация ОДНОГО изображения через Vertex AI
 */
async function generateSingleImage(prompt, options, index, onProgress) {
  const { aspectRatio, referenceBase64, visionAnalysis, accessToken, projectId } = options;

  try {
    if (onProgress) {
      onProgress({ index, status: 'generating', message: `Генерирую вариант ${index + 1}...` });
    }

    // Выбираем модель в зависимости от наличия референса
    const model = referenceBase64 ? IMAGEN_MODEL_CUSTOMIZE : IMAGEN_MODEL_GENERATE;
    const url = `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${VERTEX_LOCATION}/publishers/google/models/${model}:predict`;

    // Формируем запрос
    let requestBody;

    if (referenceBase64) {
      // НОВОЕ: Используем REFERENCE_TYPE_STYLE для сохранения визуального стиля
      // Это работает для любых объектов (рыбы, слоты, вертолёты), не только для людей!

      // Формируем описание стиля
      const styleDescription = buildStyleDescription(visionAnalysis);

      // Формируем промпт
      let finalPrompt = prompt;

      // Добавляем recreation_prompt если есть (детальное описание что воссоздать)
      if (visionAnalysis?.recreation_prompt) {
        finalPrompt = `${visionAnalysis.recreation_prompt}. ${finalPrompt}`;
      }

      // Добавляем описание персонажа/объектов если есть
      if (visionAnalysis?.character_description) {
        if (!finalPrompt.toLowerCase().includes(visionAnalysis.character_description.toLowerCase().substring(0, 20))) {
          finalPrompt = `${visionAnalysis.character_description}. ${finalPrompt}`;
        }
      }

      finalPrompt += '. High quality, professional advertising, sharp details, 4K.';

      log.info('Style customization request', {
        styleDescriptionLength: styleDescription.length,
        promptLength: finalPrompt.length,
        hasVisionAnalysis: !!visionAnalysis,
        contentType: visionAnalysis?.content_type,
        referenceType: 'REFERENCE_TYPE_STYLE',
        promptPreview: finalPrompt.substring(0, 200)
      });

      requestBody = {
        instances: [{
          prompt: finalPrompt,
          referenceImages: [{
            referenceType: 'REFERENCE_TYPE_STYLE',
            referenceId: 1,
            referenceImage: {
              bytesBase64Encoded: referenceBase64
            },
            styleImageConfig: {
              styleDescription: styleDescription
            }
          }]
        }],
        parameters: {
          aspectRatio,
          sampleCount: 1,
          personGeneration: 'ALLOW_ALL',
          safetyFilterLevel: 'BLOCK_ONLY_HIGH',
          addWatermark: false
        }
      };
    } else {
      // Без референса — обычная генерация
      let finalPrompt = prompt;

      // Если есть visionAnalysis (от предыдущего референса) — используем recreation_prompt
      if (visionAnalysis?.recreation_prompt) {
        finalPrompt = `${visionAnalysis.recreation_prompt}. ${finalPrompt}`;
      } else if (visionAnalysis) {
        // Fallback на старую логику
        const parts = [];
        if (visionAnalysis.summary) parts.push(visionAnalysis.summary);
        if (visionAnalysis.character_description) parts.push(`Character: ${visionAnalysis.character_description}`);
        if (visionAnalysis.style) parts.push(`Style: ${visionAnalysis.style}`);
        if (visionAnalysis.colors?.length) parts.push(`Colors: ${visionAnalysis.colors.join(', ')}`);
        if (visionAnalysis.lighting) parts.push(`Lighting: ${visionAnalysis.lighting}`);

        if (parts.length > 0) {
          finalPrompt = `${parts.join('. ')}. ${finalPrompt}`;
        }
      }

      finalPrompt += '. High quality, professional, 4K.';

      requestBody = {
        instances: [{
          prompt: finalPrompt
        }],
        parameters: {
          aspectRatio,
          sampleCount: 1,
          personGeneration: 'ALLOW_ALL',
          safetyFilterLevel: 'BLOCK_ONLY_HIGH',
          addWatermark: false
        }
      };
    }

    log.info(`Image ${index + 1}: Calling Vertex AI`, {
      hasReference: !!referenceBase64,
      referenceType: referenceBase64 ? 'REFERENCE_TYPE_STYLE' : 'none',
      aspectRatio,
      promptPreview: requestBody.instances[0].prompt.substring(0, 150)
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      log.error(`Vertex AI error for image ${index + 1}`, {
        status: response.status,
        error: errorData?.error?.message || JSON.stringify(errorData)
      });
      throw new Error(`Vertex AI error: ${response.status} - ${errorData?.error?.message || 'Unknown'}`);
    }

    const result = await response.json();
    const predictions = result.predictions || [];

    if (predictions.length > 0 && predictions[0].bytesBase64Encoded) {
      const imageUrl = await saveBase64Image(predictions[0].bytesBase64Encoded, 'image/png');

      if (onProgress) {
        onProgress({ index, status: 'complete', imageUrl });
      }

      return imageUrl;
    }

    log.warn(`Image ${index + 1}: No image in response`, { predictions: predictions.length });
    return null;

  } catch (error) {
    log.warn(`Generation ${index + 1} error`, { error: error.message });
    if (onProgress) {
      onProgress({ index, status: 'error', error: error.message });
    }
    return null;
  }
}

/**
 * Главная функция генерации через Vertex AI Imagen 3
 *
 * ПАРАЛЛЕЛЬНАЯ генерация + Identity Lock!
 */
export async function generateWithGoogle(prompt, options = {}) {
  // Проверяем credentials
  if (!config.googleCloudProject || !config.googleCredentialsJson) {
    throw new Error('Vertex AI не настроен. Добавьте GOOGLE_CLOUD_PROJECT и GOOGLE_APPLICATION_CREDENTIALS_JSON');
  }

  const {
    width = 1024,
    height = 1024,
    textContent = null,
    textStyle = null,
    referenceUrl = null,
    numImages = 1,
    onProgress = null,
    visionAnalysis = null
  } = options;

  const aspectRatio = getAspectRatio(width, height);
  const requestedImages = Math.min(numImages || 1, 4);

  // Получаем токен один раз для всех запросов
  const accessToken = await getVertexAccessToken();
  const projectId = config.googleCloudProject;

  // Формируем базовый промпт
  let finalPrompt = prompt;

  if (textContent) {
    finalPrompt = `${finalPrompt}

IMPORTANT: Include this exact text prominently: "${textContent}"
Text style: ${textStyle || 'bold, high contrast, professional'}`;
  }

  // Подготавливаем референс
  let referenceBase64 = null;
  if (referenceUrl) {
    referenceBase64 = await prepareReferenceBase64(referenceUrl);
    log.info('Reference prepared', { hasBase64: !!referenceBase64 });
  }

  // Выбираем модель
  const selectedModel = referenceBase64 ? IMAGEN_MODEL_CUSTOMIZE : IMAGEN_MODEL_GENERATE;

  log.info('Imagen 3 generation starting', {
    model: selectedModel,
    aspectRatio,
    numImages: requestedImages,
    hasReference: !!referenceBase64,
    hasVisionAnalysis: !!visionAnalysis
  });

  const startTime = Date.now();

  // ПОСЛЕДОВАТЕЛЬНАЯ генерация (квота 1 req/min, ждём увеличения)
  const generateOptions = {
    aspectRatio,
    referenceBase64,
    visionAnalysis,
    accessToken,
    projectId
  };

  const images = [];
  for (let i = 0; i < requestedImages; i++) {
    const result = await generateSingleImage(finalPrompt, generateOptions, i, onProgress);
    if (result) {
      images.push(result);
    }
    // Пауза между запросами чтобы не превышать квоту (убрать когда квота увеличится)
    if (i < requestedImages - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 сек пауза
    }
  }

  const timeMs = Date.now() - startTime;

  if (images.length === 0) {
    throw new Error('Imagen 3 не вернул изображения. Попробуйте изменить запрос или проверьте Vertex AI credentials.');
  }

  log.info('Imagen 3 generation complete', {
    timeMs,
    requestedImages,
    actualImages: images.length,
    model: selectedModel
  });

  return {
    images,
    timeMs,
    model: selectedModel
  };
}

/**
 * Проверка доступности API
 */
export function isGoogleApiAvailable() {
  return !!(config.googleCloudProject && config.googleCredentialsJson);
}

/**
 * Health check
 */
export async function checkGoogleHealth() {
  const hasCredentials = !!(config.googleCloudProject && config.googleCredentialsJson);

  if (!hasCredentials) {
    return {
      available: false,
      reason: 'Vertex AI credentials not configured (GOOGLE_CLOUD_PROJECT, GOOGLE_APPLICATION_CREDENTIALS_JSON)'
    };
  }

  // Проверяем токен
  try {
    await getVertexAccessToken();
    return {
      available: true,
      model: `${IMAGEN_MODEL_GENERATE} / ${IMAGEN_MODEL_CUSTOMIZE}`,
      features: ['text-to-image', 'identity-lock', 'reference-images']
    };
  } catch (error) {
    return {
      available: false,
      reason: `Auth failed: ${error.message}`
    };
  }
}
