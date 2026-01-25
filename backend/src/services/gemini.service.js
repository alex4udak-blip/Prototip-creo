import { GoogleGenAI } from "@google/genai";
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/env.js';
import { log } from '../utils/logger.js';
import { generateWithRunware } from './runware.service.js';

// Lazy инициализация клиента (только когда есть API key)
let ai = null;

function getAI() {
  if (!ai && config.googleApiKey) {
    ai = new GoogleGenAI({ apiKey: config.googleApiKey });
  }
  if (!ai) {
    throw new Error('Gemini API key not configured');
  }
  return ai;
}

// Хранилище чат-сессий
const chatSessions = new Map();

/**
 * SYSTEM PROMPT для Gemini
 * Баланс между простотой и чёткими инструкциями
 */
const SYSTEM_PROMPT = `Ты — AI-дизайнер рекламных баннеров для арбитража трафика.
Ты умеешь генерировать изображения с текстом на них.

## Твоя главная задача
Создавать эффективные рекламные креативы (баннеры) для казино, беттинга, крипто, нутры и мобильных приложений.

## КОГДА ГЕНЕРИРОВАТЬ ИЗОБРАЖЕНИЯ

### Генерируй СРАЗУ (без лишних вопросов) если:
- Пользователь просит "сделай баннер", "создай креатив", "сгенерируй"
- Пользователь даёт референс + описание
- Пользователь пишет "ещё варианты", "ещё", "другие", "измени"
- Контекст очевиден (есть тема, текст, референс)

### Задай 1-2 вопроса если:
- Вообще непонятно что нужно (пустой запрос или очень абстрактный)
- Критически важный параметр не указан (например нет темы вообще)

### ВАЖНОЕ ПРАВИЛО: если сомневаешься — ГЕНЕРИРУЙ, а не спрашивай
Лучше сделать вариант и спросить "так или иначе?" чем задавать много вопросов.

## Как работать с референсами
Когда пользователь присылает картинки — это референсы стиля:
- Изучи стиль, цвета, механику (коробки, слоты, колесо, персонаж)
- Если есть персонаж — сохрани его в вариациях
- Создавай НОВЫЕ баннеры в том же стиле, меняя текст и композицию
- НЕ копируй референс 1-в-1, создавай вариации

## Количество изображений
- По умолчанию генерируй 1-2 варианта за раз
- Если просят "варианты" или "несколько" — генерируй 2-3
- Каждое изображение ОТДЕЛЬНЫМ файлом (не коллаж!)

## Текст на баннерах
- Яркие цвета, высокий контраст
- Крупный текст бонуса/оффера
- Заметная CTA кнопка
- Мелкий текст: 18+, T&C apply (если казино/беттинг)
- Заключай точный текст в кавычки: "БОНУС 1500€"
- Максимум 25 символов в строке для чёткости
- Описывай сцены нарративно (словами), не списками ключевых слов

## Compliance (важно!)
- НЕЛЬЗЯ: "гарантированный выигрыш", "100%", прямые обещания денег
- МОЖНО: "до X€", "шанс выиграть", "бонус на депозит", "X фриспинов"

## Стиль общения
- Кратко, по делу, на русском
- После генерации объясни что сделал в 1-2 предложениях
- Предложи что можно улучить или изменить`;


/**
 * Получить или создать чат-сессию
 * @param {string|number} chatId - ID чата
 */
export function getOrCreateChat(chatId) {
  if (!chatSessions.has(chatId)) {
    const geminiConfig = config.gemini;

    const chatConfig = {
      responseModalities: ["TEXT", "IMAGE"],
      systemInstruction: SYSTEM_PROMPT,
      thinkingConfig: {
        thinkingBudget: geminiConfig.thinkingBudget
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: geminiConfig.safetyThreshold
        }
      ]
    };

    const chat = getAI().chats.create({
      model: geminiConfig.model,
      config: chatConfig
    });

    chatSessions.set(chatId, chat);
    log.info('Created new Gemini chat session', {
      chatId,
      model: geminiConfig.model,
      thinkingBudget: geminiConfig.thinkingBudget
    });
  }
  return chatSessions.get(chatId);
}

/**
 * Отправить сообщение в чат со STREAMING
 *
 * @param {string|number} chatId - ID чата
 * @param {string} text - Текст сообщения
 * @param {Array} images - Массив изображений [{data: base64, mimeType: string}]
 * @param {Object} options - Опции: expectedImages (сколько картинок ожидаем)
 * @param {Function} onProgress - Callback для прогресса
 */
export async function sendMessageStream(chatId, text, images = [], options = {}, onProgress) {
  const {
    expectedImages = 1,
    width = 1024,   // Размер для Runware fallback
    height = 1024
  } = options;
  const chat = getOrCreateChat(chatId);

  // Просто отправляем текст как есть — модель сама разберётся
  const fullText = text || '';

  // Собираем message
  let message;

  if (images.length > 0) {
    message = [];
    if (fullText.trim()) {
      message.push({ text: fullText });
    }
    for (const img of images) {
      message.push({
        inlineData: {
          mimeType: img.mimeType || 'image/png',
          data: img.data
        }
      });
    }
  } else {
    message = fullText;
  }

  log.info('Sending message to Gemini', {
    chatId,
    textLength: fullText.length,
    imagesCount: images.length,
    messageType: Array.isArray(message) ? 'multipart' : 'text'
  });

  let stream;
  try {
    stream = await chat.sendMessageStream({ message });
  } catch (error) {
    log.error('Gemini sendMessageStream failed', {
      chatId,
      error: error.message
    });
    throw error;
  }

  const result = {
    text: '',
    images: [],
    finishReason: null,
    usage: null // Token usage info
  };

  // Обрабатываем stream
  try {
    let chunkCount = 0;
    for await (const chunk of stream) {
      chunkCount++;
      const candidate = chunk.candidates?.[0];
      const parts = candidate?.content?.parts || [];

      if (candidate?.finishReason) {
        result.finishReason = candidate.finishReason;
      }

      // Сохраняем usage metadata из последнего чанка
      if (chunk.usageMetadata) {
        result.usage = {
          promptTokens: chunk.usageMetadata.promptTokenCount || 0,
          outputTokens: chunk.usageMetadata.candidatesTokenCount || 0,
          totalTokens: chunk.usageMetadata.totalTokenCount || 0,
          thinkingTokens: chunk.usageMetadata.thoughtsTokenCount || 0
        };
      }

      log.debug('Gemini chunk', {
        chatId,
        chunkNumber: chunkCount,
        partsCount: parts.length,
        hasImage: parts.some(p => p.inlineData)
      });

      for (const part of parts) {
        if (part.text) {
          result.text += part.text;
          if (onProgress) {
            onProgress({
              status: 'generating_text',
              text: result.text,
              imagesCount: result.images.length
            });
          }
        } else if (part.inlineData) {
          const imageUrl = await saveBase64Image(part.inlineData.data, part.inlineData.mimeType);
          result.images.push({
            url: imageUrl,
            mimeType: part.inlineData.mimeType
          });
          if (onProgress) {
            onProgress({
              status: 'generating_image',
              text: result.text,
              imagesCount: result.images.length,
              newImage: imageUrl
            });
          }
        }
      }
    }
  } catch (error) {
    log.error('Gemini streaming failed', {
      chatId,
      error: error.message,
      imagesCount: result.images.length
    });
    throw error;
  }

  // Логируем токены для биллинга
  if (result.usage) {
    log.info('Gemini token usage', {
      chatId,
      promptTokens: result.usage.promptTokens,
      outputTokens: result.usage.outputTokens,
      thinkingTokens: result.usage.thinkingTokens,
      totalTokens: result.usage.totalTokens,
      imagesGenerated: result.images.length
    });
  }

  log.info('Gemini response complete', {
    chatId,
    hasText: !!result.text,
    textLength: result.text?.length || 0,
    imagesCount: result.images.length,
    expectedImages,
    finishReason: result.finishReason,
    tokens: result.usage?.totalTokens || 'unknown'
  });

  // Проверяем нужен ли Runware fallback:
  // 1. IMAGE_SAFETY / IMAGE_OTHER — прямая блокировка безопасности
  // 2. Пустой ответ (ни текста, ни изображений)
  // 3. Ожидали изображения но получили 0 — Gemini "отказался" генерировать
  const isModerationBlock = result.finishReason === 'IMAGE_SAFETY' ||
                            result.finishReason === 'IMAGE_OTHER';

  const noImagesWhenExpected = expectedImages > 0 && result.images.length === 0;

  const needsFallback = isModerationBlock ||
                        (!result.text && result.images.length === 0) ||
                        noImagesWhenExpected;

  if (needsFallback) {
    log.warn('Gemini did not generate images, trying Runware fallback', {
      chatId,
      finishReason: result.finishReason,
      hasText: !!result.text,
      imagesCount: result.images.length
    });

    // Пробуем Runware fallback
    if (config.runware.enabled) {
      log.info('Attempting Runware fallback', { chatId });

      if (onProgress) {
        const fallbackMessage = isModerationBlock
          ? 'Gemini заблокировал запрос, переключаюсь на Runware FLUX...'
          : 'Gemini не сгенерировал изображения, переключаюсь на Runware FLUX...';
        onProgress({
          status: 'fallback_runware',
          message: fallbackMessage
        });
      }

      try {
        // Передаём референсы в Runware для сохранения стиля
        const runwareResult = await generateWithRunware(
          fullText, // Исходный промпт
          {
            count: expectedImages,
            width,   // Передаём размеры
            height,
            referenceImages: images // Передаём те же референсы что были для Gemini
          },
          onProgress
        );

        return {
          text: runwareResult.text,
          images: runwareResult.images,
          finishReason: 'RUNWARE_FALLBACK',
          source: 'runware'
        };
      } catch (runwareError) {
        log.error('Runware fallback failed', {
          chatId,
          error: runwareError.message
        });
        // Если Runware тоже не смог — бросаем оригинальную ошибку
      }
    }

    // Если Runware не доступен или тоже не смог
    let errorMessage;
    if (result.finishReason === 'IMAGE_SAFETY') {
      errorMessage = 'Изображения заблокированы политикой безопасности.';
    } else if (result.finishReason === 'IMAGE_OTHER') {
      errorMessage = 'Gemini отказался генерировать изображения.';
    } else if (noImagesWhenExpected) {
      errorMessage = 'Gemini не сгенерировал изображения. Runware fallback недоступен.';
    } else {
      errorMessage = 'Запрос заблокирован.';
    }

    throw new Error(`${errorMessage} Попробуйте изменить формулировку.`);
  }

  // Auto-retry: если получили меньше изображений чем ожидали — запросим ещё
  if (result.images.length > 0 && result.images.length < expectedImages) {
    const remaining = expectedImages - result.images.length;
    log.info('Auto-retry: requesting more images', {
      chatId,
      got: result.images.length,
      expected: expectedImages,
      remaining
    });

    if (onProgress) {
      onProgress({
        status: 'generating_more',
        text: result.text,
        imagesCount: result.images.length,
        message: `Генерирую ещё ${remaining} вариант(а)...`
      });
    }

    try {
      // Просим ещё вариантов в том же стиле
      const retryMessage = `Сгенерируй ещё ${remaining} ${remaining === 1 ? 'вариант' : 'варианта'} в том же стиле. ВАЖНО: сгенерируй именно ${remaining} изображени${remaining === 1 ? 'е' : 'я'}.`;

      const retryStream = await chat.sendMessageStream({ message: retryMessage });

      for await (const chunk of retryStream) {
        const parts = chunk.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          if (part.text) {
            result.text += '\n' + part.text;
          } else if (part.inlineData) {
            const imageUrl = await saveBase64Image(part.inlineData.data, part.inlineData.mimeType);
            result.images.push({
              url: imageUrl,
              mimeType: part.inlineData.mimeType
            });
            if (onProgress) {
              onProgress({
                status: 'generating_image',
                text: result.text,
                imagesCount: result.images.length,
                newImage: imageUrl
              });
            }
          }
        }
      }

      log.info('Auto-retry complete', {
        chatId,
        totalImages: result.images.length
      });
    } catch (retryError) {
      log.warn('Auto-retry failed', { chatId, error: retryError.message });
      // Не бросаем ошибку — возвращаем что есть
    }
  }

  return result;
}

/**
 * Сохранить base64 картинку в файл
 */
async function saveBase64Image(base64Data, mimeType = 'image/png') {
  const ext = mimeType?.includes('jpeg') ? '.jpg' : '.png';
  const filename = `${uuidv4()}${ext}`;
  const filepath = path.join(config.storagePath, filename);

  if (!fs.existsSync(config.storagePath)) {
    fs.mkdirSync(config.storagePath, { recursive: true });
  }

  const buffer = Buffer.from(base64Data, 'base64');
  fs.writeFileSync(filepath, buffer);

  log.debug('Saved image', { filename, sizeKB: Math.round(buffer.length / 1024) });

  return `/uploads/${filename}`;
}

/**
 * Удалить чат-сессию
 */
export function deleteChat(chatId) {
  if (chatSessions.has(chatId)) {
    chatSessions.delete(chatId);
    log.info('Deleted Gemini chat session', { chatId });
  }
}

/**
 * Health check — возвращает текущую конфигурацию
 */
export async function checkHealth() {
  const geminiConfig = config.gemini;
  return {
    available: !!config.googleApiKey,
    model: geminiConfig.model,
    features: ['multi-turn', 'image-understanding', 'image-generation', 'text-rendering', 'thinking'],
    config: {
      thinkingBudget: geminiConfig.thinkingBudget,
      safetyThreshold: geminiConfig.safetyThreshold
    }
  };
}

/**
 * Сгенерировать стилизованный текст как PNG через Gemini
 * Используется для наложения на Runware изображения
 *
 * @param {string} text - Текст для генерации
 * @param {string} style - Стиль текста (casino, crypto, betting)
 * @param {Object} options - Опции: width, height, textType (headline/cta/disclaimer)
 * @returns {Object} {url, mimeType} или null если не удалось
 */
export async function generateStyledTextPng(text, style = 'casino', options = {}) {
  const { width = 1024, height = 256, textType = 'headline' } = options;

  // Промпт для генерации ТОЛЬКО текста на прозрачном фоне
  const styleDescriptions = {
    casino: 'golden gradient with metallic shine, 3D effect, casino luxury style, glowing edges',
    crypto: 'neon blue and purple gradient, futuristic tech style, glowing effect',
    betting: 'green and gold gradient, sporty bold style, dynamic feel',
    bonus: 'bright orange to yellow gradient, exciting promotional style, bold and attention-grabbing'
  };

  const styleDesc = styleDescriptions[style] || styleDescriptions.casino;

  const textPrompt = `Generate ONLY the text "${text}" as a stylized banner heading.

CRITICAL REQUIREMENTS:
- Transparent background (PNG with alpha channel)
- Text only, no other elements, no decorations around
- Style: ${styleDesc}
- Text must be perfectly readable and centered
- Resolution: ${width}x${height} pixels
- ${textType === 'cta' ? 'Include a subtle button/badge shape behind the text' : 'Just the styled text, nothing else'}

The text should look like professional casino/gambling banner typography with rich visual effects.`;

  log.info('Generating styled text PNG via Gemini', {
    text,
    style,
    textType,
    width,
    height
  });

  try {
    const geminiConfig = config.gemini;

    // Одиночный запрос (не чат) для генерации текста
    const response = await getAI().models.generateContent({
      model: geminiConfig.model,
      contents: [{ role: 'user', parts: [{ text: textPrompt }] }],
      config: {
        responseModalities: ['IMAGE'],
        // Более мягкие настройки - текст не должен блокироваться
        safetySettings: [
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_ONLY_HIGH'
          }
        ]
      }
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find(p => p.inlineData);

    if (imagePart?.inlineData) {
      const imageUrl = await saveBase64Image(imagePart.inlineData.data, imagePart.inlineData.mimeType);
      log.info('Styled text PNG generated', { text, url: imageUrl });
      return {
        url: imageUrl,
        mimeType: imagePart.inlineData.mimeType || 'image/png'
      };
    }

    log.warn('Gemini did not return image for text generation', {
      text,
      finishReason: response.candidates?.[0]?.finishReason
    });
    return null;

  } catch (error) {
    log.error('Failed to generate styled text PNG', {
      text,
      error: error.message
    });
    return null;
  }
}

export default {
  getOrCreateChat,
  sendMessageStream,
  deleteChat,
  checkHealth,
  generateStyledTextPng
};
