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
 * Google Nano Banana Models (Gemini Image Generation)
 *
 * АКТУАЛЬНЫЕ МОДЕЛИ (январь 2026):
 * - gemini-2.5-flash-image — Nano Banana (быстрый, эффективный)
 * - gemini-3-pro-image-preview — Nano Banana Pro (профессиональный с Thinking)
 *
 * Особенности:
 * - Отлично рендерит текст на изображениях!
 * - Поддерживает референсы для Identity Lock (до 14 изображений)
 * - Понимает контекст и инструкции на русском
 * - Gemini 3 Pro поддерживает до 4K (4096×4096)
 *
 * Документация: https://ai.google.dev/gemini-api/docs/image-generation
 */
/**
 * ВРЕМЕННО УПРОЩЕНО: Обе модели используют один Gemini
 * gemini-2.0-flash-exp-image-generation — экспериментальная модель для генерации
 */
const GOOGLE_MODELS = {
  'google-nano': 'gemini-2.0-flash-exp-image-generation',
  'google-nano-pro': 'gemini-2.0-flash-exp-image-generation',
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
    referenceUrl = null,
    numImages = 1  // Количество изображений
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
    numImages,
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

    // Если есть референс — добавляем его первым для Identity Lock
    if (referenceUrl) {
      const referencePart = await prepareReferenceForGoogle(referenceUrl);
      if (referencePart) {
        contentParts.push(referencePart);

        // IDENTITY LOCK промпт — техники от Google для Gemini 2.5 Flash Image
        // Ключевые фразы: "this exact character", identity header, hard constraints
        finalPrompt = `=== IDENTITY LOCK MODE ===

Generate a NEW VARIATION of this exact image while preserving character identity.

## IDENTITY HEADER (DO NOT CHANGE):
- This exact character must appear in the new image
- Maintain identical facial geometry, eye spacing, nose width
- Same hair color, length, and style
- Same skin tone and complexion
- Same clothing style and colors
- Same body proportions and build

## HARD CONSTRAINTS:
- Do NOT change facial proportions
- Do NOT morph or age the character
- Do NOT change eye color or shape
- Do NOT change hairstyle or hair color
- Preserve all unique visual markers

## STYLE PRESERVATION:
- Same 3D render quality and technique
- Same lighting style and color grading
- Same visual atmosphere (neon, casino, premium)
- Same background aesthetic
- Same brand elements (treasure chests, coins, UI)

## WHAT TO CREATE:
${finalPrompt}

## VARIATION INSTRUCTIONS:
Create a fresh variation with THIS EXACT CHARACTER in a slightly different pose or angle.
The new image must look like it belongs to the same advertising campaign.
Character identity must be 100% consistent with the reference.

Generate now:`;
        log.info('Added reference for Identity Lock with Google techniques', { referenceUrl });
      }
    }

    // Добавляем текстовый промпт
    contentParts.push({ text: finalPrompt });

    // Генерируем нужное количество изображений ПАРАЛЛЕЛЬНО для скорости
    const requestedImages = Math.min(numImages || 1, 5);  // Max 5 (как Genspark)

    // Запускаем все генерации параллельно
    const generateOne = async (index) => {
      try {
        const result = await aiModel.generateContent(contentParts);
        const response = result.response;

        // Извлекаем изображение из ответа
        for (const candidate of response.candidates || []) {
          for (const part of candidate.content?.parts || []) {
            if (part.inlineData) {
              const imageUrl = await saveBase64Image(part.inlineData.data, part.inlineData.mimeType);
              return imageUrl;
            }
          }
        }
        return null;
      } catch (genError) {
        log.warn(`Google image ${index + 1}/${requestedImages} failed`, { error: genError.message });
        return null;
      }
    };

    // Запускаем все параллельно
    const promises = Array.from({ length: requestedImages }, (_, i) => generateOne(i));
    const results = await Promise.all(promises);
    const allImages = results.filter(url => url !== null);

    const timeMs = Date.now() - startTime;

    if (allImages.length === 0) {
      log.warn('Google API не вернул ни одного изображения');
      throw new Error('Google API не вернул изображение. Попробуйте изменить запрос.');
    }

    log.info('Google Nano Banana generation complete', {
      model,
      timeMs,
      requestedImages,
      actualImages: allImages.length,
      usedReference: !!referenceUrl
    });

    return {
      images: allImages,
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
    if (error.message.includes('quota') || error.message.includes('rate') || error.message.includes('RESOURCE_EXHAUSTED')) {
      throw new Error('Превышен лимит запросов к Google API. Попробуйте позже.');
    }
    if (error.message.includes('INVALID_IMAGE') || error.message.includes('Invalid image')) {
      throw new Error('Google не смог обработать референс. Попробуйте другое изображение.');
    }
    if (error.message.includes('PERMISSION_DENIED')) {
      throw new Error('Ошибка авторизации Google API. Проверьте API ключ.');
    }
    if (error.message.includes('INVALID_PROMPT') || error.message.includes('blocked')) {
      throw new Error('Google заблокировал этот промпт. Попробуйте изменить описание.');
    }

    throw error;
  }
}

/**
 * Проверка доступности Google AI API
 */
export function isGoogleApiAvailable() {
  return !!genAI;
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
