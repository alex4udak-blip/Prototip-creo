import { GoogleGenAI } from "@google/genai";
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/env.js';
import { log } from '../utils/logger.js';

// Инициализация клиента
const ai = new GoogleGenAI({ apiKey: config.googleApiKey });

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

    const chat = ai.chats.create({
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
  const { expectedImages = 1 } = options;
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
    finishReason: null
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

  log.info('Gemini response complete', {
    chatId,
    hasText: !!result.text,
    textLength: result.text?.length || 0,
    imagesCount: result.images.length,
    expectedImages,
    finishReason: result.finishReason
  });

  // Если пустой ответ — модерация заблокировала
  if (!result.text && result.images.length === 0) {
    throw new Error('Запрос заблокирован модерацией. Попробуйте изменить формулировку.');
  }

  // IMAGE_SAFETY — контент заблокирован
  if (result.finishReason === 'IMAGE_SAFETY') {
    throw new Error('Изображения заблокированы политикой безопасности. Попробуйте изменить запрос.');
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

export default {
  getOrCreateChat,
  sendMessageStream,
  deleteChat,
  checkHealth
};
