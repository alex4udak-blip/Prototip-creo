import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/env.js';
import { log } from '../utils/logger.js';

/**
 * Google Imagen 3 — Nano Banana Pro
 *
 * ДВА РЕЖИМА:
 * 1. Gemini API (простой API Key) — imagen-3.0-generate-002
 * 2. Vertex AI (Service Account) — imagen-3.0-capability-001 с референсами!
 *
 * Vertex AI нужен для НАСТОЯЩЕГО Identity Lock с передачей изображения.
 *
 * Переменные окружения:
 * - GOOGLE_API_KEY — для Gemini API
 * - GOOGLE_CLOUD_PROJECT — для Vertex AI
 * - GOOGLE_APPLICATION_CREDENTIALS_JSON — JSON service account
 */

const IMAGEN_GENERATE_MODEL = 'imagen-3.0-generate-002';
const IMAGEN_CAPABILITY_MODEL = 'imagen-3.0-capability-001';

// API URLs
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Vertex AI endpoint: https://{LOCATION}-aiplatform.googleapis.com/v1/projects/{PROJECT}/locations/{LOCATION}/publishers/google/models/{MODEL}:predict
const VERTEX_LOCATION = 'us-central1';

/**
 * Получить Access Token для Vertex AI через Service Account
 */
async function getVertexAccessToken() {
  const credentialsJson = config.googleCredentialsJson;
  if (!credentialsJson) return null;

  try {
    const credentials = typeof credentialsJson === 'string'
      ? JSON.parse(credentialsJson)
      : credentialsJson;

    // Используем google-auth-library для получения токена
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
    return null;
  }
}

/**
 * Проверка доступности Vertex AI
 */
function isVertexAvailable() {
  return !!(config.googleCloudProject && config.googleCredentialsJson);
}

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
 * Генерация через Vertex AI (с референсами!)
 */
async function generateWithVertexAI(prompt, options) {
  const { aspectRatio, referenceBase64, visionAnalysis } = options;

  const accessToken = await getVertexAccessToken();
  if (!accessToken) {
    throw new Error('Failed to get Vertex AI access token');
  }

  const projectId = config.googleCloudProject;
  const url = `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${VERTEX_LOCATION}/publishers/google/models/${IMAGEN_CAPABILITY_MODEL}:predict`;

  // Формируем промпт с Identity Lock
  let finalPrompt = prompt;

  if (visionAnalysis) {
    const parts = [];
    if (visionAnalysis.summary) parts.push(visionAnalysis.summary);
    if (visionAnalysis.character_description) parts.push(`Character: ${visionAnalysis.character_description}`);
    if (visionAnalysis.style) parts.push(`Style: ${visionAnalysis.style}`);
    if (visionAnalysis.colors?.length) parts.push(`Colors: ${visionAnalysis.colors.join(', ')}`);

    finalPrompt = `Create a variation of [1] (reference subject).

${parts.join('\n')}

TASK: ${prompt}

Keep the exact same character identity, style, and visual quality as [1].`;
  } else {
    finalPrompt = `Create a variation of [1] (reference subject).

TASK: ${prompt}

Keep the exact same character identity as [1].`;
  }

  const requestBody = {
    instances: [{
      prompt: finalPrompt,
      referenceImages: [{
        referenceType: 'REFERENCE_TYPE_SUBJECT',
        referenceId: 1,
        referenceImage: {
          bytesBase64Encoded: referenceBase64
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
    log.error('Vertex AI error', { status: response.status, error: errorData });
    throw new Error(`Vertex AI error: ${response.status}`);
  }

  const result = await response.json();
  const predictions = result.predictions || [];

  if (predictions.length > 0 && predictions[0].bytesBase64Encoded) {
    return await saveBase64Image(predictions[0].bytesBase64Encoded, 'image/png');
  }

  return null;
}

/**
 * Генерация через Gemini API (без референсов)
 */
async function generateWithGeminiAPI(prompt, options) {
  const { aspectRatio } = options;

  const url = `${GEMINI_API_BASE}/${IMAGEN_GENERATE_MODEL}:predict?key=${config.googleApiKey}`;

  const requestBody = {
    instances: [{ prompt: prompt }],
    parameters: {
      aspectRatio: aspectRatio,
      sampleCount: 1,
      personGeneration: 'allow_adult',
      safetyFilterLevel: 'block_few'
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    log.warn('Gemini API error', { status: response.status, error: errorData?.error?.message });
    return null;
  }

  const result = await response.json();
  const predictions = result.predictions || [];

  if (predictions.length > 0 && predictions[0].bytesBase64Encoded) {
    return await saveBase64Image(predictions[0].bytesBase64Encoded, 'image/png');
  }

  return null;
}

/**
 * Генерация ОДНОГО изображения
 */
async function generateSingleImage(prompt, options, index, onProgress) {
  const { aspectRatio, referenceBase64, visionAnalysis, useVertex } = options;

  try {
    if (onProgress) {
      onProgress({ index, status: 'generating', message: `Генерирую вариант ${index + 1}...` });
    }

    let imageUrl = null;

    // Если есть референс И Vertex AI доступен — используем Vertex для Identity Lock
    if (referenceBase64 && useVertex) {
      log.info(`Image ${index + 1}: Using Vertex AI with reference`);
      imageUrl = await generateWithVertexAI(prompt, { aspectRatio, referenceBase64, visionAnalysis });
    } else {
      // Иначе Gemini API
      log.info(`Image ${index + 1}: Using Gemini API`);
      imageUrl = await generateWithGeminiAPI(prompt, { aspectRatio, visionAnalysis });
    }

    if (imageUrl && onProgress) {
      onProgress({ index, status: 'complete', imageUrl });
    }

    return imageUrl;

  } catch (error) {
    log.warn(`Generation ${index + 1} error`, { error: error.message });
    return null;
  }
}

/**
 * Генерация изображений через Imagen 3
 *
 * ПАРАЛЛЕЛЬНАЯ генерация + Identity Lock через Vertex AI!
 */
export async function generateWithGoogle(prompt, options = {}) {
  if (!config.googleApiKey && !isVertexAvailable()) {
    throw new Error('GOOGLE_API_KEY или Vertex AI credentials не настроены');
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

  // Формируем базовый промпт
  let finalPrompt = prompt;

  if (textContent) {
    finalPrompt = `${finalPrompt}

IMPORTANT: Include this exact text prominently: "${textContent}"
Text style: ${textStyle || 'bold, high contrast, professional'}`;
  }

  // Подготавливаем референс
  let referenceBase64 = null;
  const useVertex = isVertexAvailable();

  if (referenceUrl) {
    referenceBase64 = await prepareReferenceBase64(referenceUrl);

    // Если нет Vertex — добавляем описание в промпт
    if (!useVertex && visionAnalysis) {
      const parts = [];
      if (visionAnalysis.summary) parts.push(`REFERENCE: ${visionAnalysis.summary}`);
      if (visionAnalysis.character_description) parts.push(`CHARACTER: ${visionAnalysis.character_description}`);
      if (visionAnalysis.style) parts.push(`STYLE: ${visionAnalysis.style}`);
      if (visionAnalysis.colors?.length) parts.push(`COLORS: ${visionAnalysis.colors.join(', ')}`);

      finalPrompt = `=== IDENTITY LOCK ===

${parts.join('\n')}

TASK: ${finalPrompt}

Create a variation matching the reference description exactly.`;
    }
  }

  log.info('Imagen 3 generation starting', {
    aspectRatio,
    numImages: requestedImages,
    hasReference: !!referenceBase64,
    useVertex,
    hasVisionAnalysis: !!visionAnalysis
  });

  const startTime = Date.now();

  // ПАРАЛЛЕЛЬНАЯ генерация
  const generateOptions = { aspectRatio, referenceBase64, visionAnalysis, useVertex };

  const promises = Array.from({ length: requestedImages }, (_, i) =>
    generateSingleImage(finalPrompt, generateOptions, i, onProgress)
  );

  const results = await Promise.all(promises);
  const images = results.filter(url => url !== null);

  const timeMs = Date.now() - startTime;

  if (images.length === 0) {
    throw new Error('Imagen 3 не вернул изображения. Попробуйте изменить запрос.');
  }

  log.info('Imagen 3 generation complete', {
    timeMs,
    requestedImages,
    actualImages: images.length,
    usedVertex: useVertex && !!referenceBase64
  });

  return {
    images,
    timeMs,
    model: (useVertex && referenceBase64) ? IMAGEN_CAPABILITY_MODEL : IMAGEN_GENERATE_MODEL
  };
}

/**
 * Проверка доступности API
 */
export function isGoogleApiAvailable() {
  return !!(config.googleApiKey || isVertexAvailable());
}

/**
 * Health check
 */
export async function checkGoogleHealth() {
  const status = {
    geminiApi: !!config.googleApiKey,
    vertexAi: isVertexAvailable()
  };

  if (!status.geminiApi && !status.vertexAi) {
    return { available: false, reason: 'No API credentials configured' };
  }

  return {
    available: true,
    geminiApi: status.geminiApi,
    vertexAi: status.vertexAi,
    models: {
      generate: IMAGEN_GENERATE_MODEL,
      capability: status.vertexAi ? IMAGEN_CAPABILITY_MODEL : null
    }
  };
}
