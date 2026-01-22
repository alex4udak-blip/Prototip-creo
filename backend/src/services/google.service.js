import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/env.js';
import { log } from '../utils/logger.js';

// Инициализация Google AI
const genAI = config.googleApiKey
  ? new GoogleGenAI({ apiKey: config.googleApiKey })
  : null;

/**
 * Google Nano Banana Models
 *
 * gemini-2.0-flash-exp — быстрая модель для генерации изображений с текстом
 * Nano Banana Pro — gemini-3-pro-image-preview (расширенные возможности)
 *
 * Особенность: отлично рендерит текст на изображениях!
 * Поддерживает до 14 референсов для Identity Lock
 */
const GOOGLE_MODELS = {
  'google-nano': 'gemini-2.0-flash-exp',           // Nano Banana (быстрый)
  'google-nano-pro': 'gemini-2.0-flash-exp',       // Nano Banana Pro (для сложных задач)
};

/**
 * Генерация изображения через Google Gemini (Nano Banana)
 * Отлично рендерит текст на изображениях!
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
    textStyle = null
  } = options;

  // Формируем промпт с акцентом на текст
  let finalPrompt = prompt;

  if (textContent) {
    // Добавляем инструкции для точного рендеринга текста
    finalPrompt = `${prompt}.

IMPORTANT: The image MUST contain the following text rendered clearly and legibly: "${textContent}".
Text style: ${textStyle || 'bold, prominent, easy to read'}.
The text should be the focal point and perfectly readable.`;
  }

  log.debug('Google Nano Banana request', { model, hasText: !!textContent });

  const startTime = Date.now();

  try {
    // Используем Gemini для генерации изображений
    const aiModel = genAI.getGenerativeModel({ model: GOOGLE_MODELS[model] || GOOGLE_MODELS['google-nano'] });

    const result = await aiModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: finalPrompt }] }],
      generationConfig: {
        responseModalities: ['IMAGE', 'TEXT'],
        responseMimeType: 'image/png'
      }
    });

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
      throw new Error('Google API не вернул изображение');
    }

    log.info('Google Nano Banana generation complete', {
      model,
      timeMs,
      numImages: images.length
    });

    return {
      images,
      timeMs,
      model: model
    };

  } catch (error) {
    log.error('Google generation failed', { error: error.message });
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
    // Imagen 3 API
    const response = await genAI.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: prompt,
      config: {
        numberOfImages: Math.min(numImages, 4),
        aspectRatio: getAspectRatio(width, height),
        outputOptions: {
          mimeType: 'image/png'
        }
      }
    });

    const timeMs = Date.now() - startTime;
    const images = [];

    for (const image of response.generatedImages || []) {
      if (image.image?.imageBytes) {
        const imageUrl = await saveBase64Image(
          Buffer.from(image.image.imageBytes).toString('base64'),
          'image/png'
        );
        images.push(imageUrl);
      }
    }

    log.info('Imagen 3 generation complete', { timeMs, numImages: images.length });

    return {
      images,
      timeMs,
      model: 'imagen-3'
    };

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
    const result = await model.generateContent('test');
    return { available: true };
  } catch (error) {
    return { available: false, reason: error.message };
  }
}
