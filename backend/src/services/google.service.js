import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/env.js';
import { log } from '../utils/logger.js';

// Инициализация Google AI
const genAI = config.googleApiKey
  ? new GoogleGenerativeAI(config.googleApiKey)
  : null;

/**
 * Google Nano Banana Models
 *
 * gemini-2.0-flash-exp — быстрая модель для генерации изображений с текстом
 * Nano Banana Pro — для сложных задач и Identity Lock
 *
 * Особенности:
 * - Отлично рендерит текст на изображениях!
 * - Поддерживает референсы для Identity Lock (до 14 изображений)
 * - Понимает контекст и инструкции на русском
 */
const GOOGLE_MODELS = {
  'google-nano': 'gemini-2.0-flash-exp',           // Nano Banana (быстрый)
  'google-nano-pro': 'gemini-2.0-flash-exp',       // Nano Banana Pro (для сложных задач)
};

/**
 * Подготовка референса для Google API
 * Конвертирует URL или локальный путь в формат для Gemini
 */
async function prepareReferenceForGoogle(referenceUrl) {
  if (!referenceUrl) return null;

  // Если это локальный путь или localhost URL
  let filePath = referenceUrl;

  // Извлекаем имя файла из URL типа /uploads/filename.png
  if (referenceUrl.includes('/uploads/')) {
    const filename = referenceUrl.split('/uploads/').pop().split('?')[0];
    filePath = path.join(config.storagePath, filename);
  }

  // Проверяем существование файла
  if (!fs.existsSync(filePath)) {
    log.warn('Reference file not found for Google API', { referenceUrl, filePath });
    return null;
  }

  try {
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' :
                     ext === '.webp' ? 'image/webp' :
                     ext === '.gif' ? 'image/gif' : 'image/jpeg';

    log.debug('Prepared reference for Google', {
      filePath,
      mimeType,
      sizeKB: Math.round(buffer.length / 1024)
    });

    return {
      inlineData: {
        data: buffer.toString('base64'),
        mimeType
      }
    };
  } catch (error) {
    log.error('Failed to prepare reference for Google', { error: error.message });
    return null;
  }
}

/**
 * Генерация изображения через Google Gemini (Nano Banana)
 * Отлично рендерит текст на изображениях!
 *
 * Поддерживает:
 * - Генерацию с текстом
 * - Identity Lock с референсом
 * - Инфографики и диаграммы
 */
export async function generateWithGoogle(prompt, options = {}) {
  if (!genAI) {
    throw new Error('GOOGLE_API_KEY не настроен');
  }

  const {
    model = 'google-nano',
    width = 1200,
    height = 628,
    textContent = null,
    textStyle = null,
    referenceUrl = null
  } = options;

  // Формируем промпт
  let finalPrompt = prompt;

  // Добавляем инструкции по размеру
  const aspectRatio = width / height;
  let sizeHint = '';
  if (aspectRatio > 1.5) {
    sizeHint = 'wide horizontal banner format';
  } else if (aspectRatio < 0.7) {
    sizeHint = 'tall vertical format';
  } else if (Math.abs(aspectRatio - 1) < 0.1) {
    sizeHint = 'square format';
  }

  if (sizeHint) {
    finalPrompt = `${finalPrompt}. Create in ${sizeHint} (${width}x${height} pixels).`;
  }

  // Добавляем инструкции для текста
  if (textContent) {
    finalPrompt = `${finalPrompt}

CRITICAL TEXT REQUIREMENT: The image MUST prominently display this exact text: "${textContent}"
Text rendering rules:
- Text must be 100% legible and correctly spelled
- Style: ${textStyle || 'bold, high contrast, easy to read'}
- Text should be a focal point of the composition
- Ensure proper spacing and alignment`;
  }

  log.debug('Google Nano Banana request', {
    model,
    hasText: !!textContent,
    hasReference: !!referenceUrl,
    promptLength: finalPrompt.length
  });

  const startTime = Date.now();

  try {
    // Используем Gemini для генерации изображений
    const modelName = GOOGLE_MODELS[model] || GOOGLE_MODELS['google-nano'];
    const aiModel = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseModalities: ['image', 'text'],
      }
    });

    // Подготавливаем контент для запроса
    const contentParts = [];

    // Если есть референс — добавляем его первым (Identity Lock)
    if (referenceUrl) {
      const referencePart = await prepareReferenceForGoogle(referenceUrl);
      if (referencePart) {
        contentParts.push(referencePart);
        // Добавляем инструкцию для Identity Lock
        finalPrompt = `Reference image is provided above. Use it to maintain visual consistency (Identity Lock).

${finalPrompt}`;
        log.debug('Added reference for Identity Lock');
      }
    }

    // Добавляем текстовый промпт
    contentParts.push({ text: finalPrompt });

    const result = await aiModel.generateContent(contentParts);

    const response = result.response;
    const timeMs = Date.now() - startTime;

    // Извлекаем изображение из ответа
    const images = [];

    for (const candidate of response.candidates || []) {
      for (const part of candidate.content?.parts || []) {
        if (part.inlineData) {
          // Сохраняем base64 изображение
          const imageUrl = await saveBase64Image(part.inlineData.data, part.inlineData.mimeType);
          images.push(imageUrl);
        }
      }
    }

    if (images.length === 0) {
      // Попробуем получить текстовый ответ для диагностики
      let textResponse = '';
      try {
        textResponse = response.text();
      } catch (e) {
        // ignore
      }
      log.warn('Google API не вернул изображение', {
        textResponse: textResponse?.substring(0, 200),
        candidates: response.candidates?.length || 0
      });
      throw new Error('Google API не вернул изображение. Попробуйте изменить запрос.');
    }

    log.info('Google Nano Banana generation complete', {
      model,
      timeMs,
      numImages: images.length,
      usedReference: !!referenceUrl
    });

    return {
      images,
      timeMs,
      model: model
    };

  } catch (error) {
    log.error('Google generation failed', {
      error: error.message,
      model,
      hasReference: !!referenceUrl
    });

    // Улучшаем сообщение об ошибке
    if (error.message.includes('SAFETY')) {
      throw new Error('Google отклонил запрос по соображениям безопасности. Попробуйте изменить описание.');
    }
    if (error.message.includes('quota') || error.message.includes('rate')) {
      throw new Error('Превышен лимит запросов к Google API. Попробуйте позже.');
    }

    throw error;
  }
}

/**
 * Альтернативный метод через Imagen 3 API
 */
export async function generateWithImagen(prompt, options = {}) {
  if (!genAI) {
    throw new Error('GOOGLE_API_KEY не настроен');
  }

  const { width = 1024, height = 1024, numImages = 1 } = options;

  const startTime = Date.now();

  try {
    // Imagen 3 через Vertex AI - пока заглушка
    // Требует другую авторизацию (service account)
    throw new Error('Imagen 3 requires Vertex AI setup');

  } catch (error) {
    log.error('Imagen generation failed', { error: error.message });
    throw error;
  }
}

/**
 * Сохранение base64 изображения в файл
 */
async function saveBase64Image(base64Data, mimeType) {
  const ext = mimeType === 'image/png' ? '.png' : '.jpg';
  const filename = `${uuidv4()}${ext}`;
  const filepath = path.join(config.storagePath, filename);

  // Создаём директорию если нужно
  if (!fs.existsSync(config.storagePath)) {
    fs.mkdirSync(config.storagePath, { recursive: true });
  }

  // Сохраняем файл
  const buffer = Buffer.from(base64Data, 'base64');
  fs.writeFileSync(filepath, buffer);

  // Возвращаем относительный путь (будет преобразован в URL на уровне API)
  return `/uploads/${filename}`;
}

/**
 * Определение aspect ratio для Imagen
 */
function getAspectRatio(width, height) {
  const ratio = width / height;

  if (ratio > 1.7) return '16:9';
  if (ratio > 1.2) return '4:3';
  if (ratio < 0.6) return '9:16';
  if (ratio < 0.9) return '3:4';
  return '1:1';
}

/**
 * Проверка доступности Google API
 */
export async function checkGoogleHealth() {
  if (!genAI) {
    return { available: false, reason: 'API key not configured' };
  }

  try {
    // Простой тест
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    const result = await model.generateContent('Say hi');
    return { available: true };
  } catch (error) {
    return { available: false, reason: error.message };
  }
}
