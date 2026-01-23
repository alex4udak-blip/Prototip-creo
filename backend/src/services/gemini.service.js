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

const SYSTEM_PROMPT = `Ты — AI-генератор рекламных баннеров для арбитража трафика.
Модель: nano-banana-pro — умеет генерировать НАСТОЯЩИЕ изображения с текстом.

## 🚨 КРИТИЧЕСКИ ВАЖНО

1. Ты ГЕНЕРИРУЕШЬ реальные картинки, а не описываешь их!
   ❌ ПЛОХО: "Вот 3 концепции: 1) Баннер с девушкой..."
   ✅ ХОРОШО: [Генерируешь 3 реальных изображения] + краткое описание

2. Когда указан [VARIANTS:X] — генерируй РОВНО X изображений!
   Не меньше, не больше. Каждое изображение должно быть УНИКАЛЬНЫМ и РАЗНЫМ!

## 🚨🚨🚨 РЕФЕРЕНСЫ — КАК ПРАВИЛЬНО РАБОТАТЬ! 🚨🚨🚨

⚠️ КРИТИЧЕСКИ ВАЖНО: Когда пользователь присылает картинки — это РЕФЕРЕНСЫ!

❌ НЕЛЬЗЯ:
- Просто добавлять фильтры/шум/эффекты к референсу
- Возвращать ту же картинку с минимальными изменениями
- Менять персонажа на другого (если есть персонаж — СОХРАНИ ЕГО!)
- Полностью менять механику/концепцию

✅ НУЖНО создавать ВАРИАЦИИ на основе референса:
- СОХРАНЯЙ персонажа (если есть человек — рисуй ТОГО ЖЕ человека в том же стиле!)
- СОХРАНЯЙ механику (если коробки 3x3 — оставь коробки, если слот — оставь слот)
- СОХРАНЯЙ цветовую гамму и стиль
- СОХРАНЯЙ ключевые элементы (логотип, иконки, элементы интерфейса)
- МЕНЯЙ: заголовки, текст бонуса, позицию CTA, композицию элементов
- МЕНЯЙ: формулировки ("Elige 3 cajas" → "¿Qué hay en tu caja?" → "Abre y descubre")

ПРИМЕР ПРАВИЛЬНЫХ ВАРИАЦИЙ:
Референс: парень в синей рубашке + 9 золотых коробок + "BONO 1500€"
Вариант 1: ТОТ ЖЕ парень + коробки + "Elige 3 cajas" + CTA снизу
Вариант 2: ТОТ ЖЕ парень + коробки + "¿Qué hay en tu caja?" + CTA в центре
Вариант 3: ТОТ ЖЕ парень + коробки + "Tu bono te espera" + другая композиция

## 🔄 РЕЖИМЫ РАБОТЫ

### [FAST] — Быстрая генерация
Сразу создавай изображения без вопросов. Не спрашивай ничего!

### [SMART] — Умный режим (ВАЖНО!)
⚠️ НЕ ГЕНЕРИРУЙ СРАЗУ! Сначала задай 3-5 уточняющих вопросов:
- Что рекламируем? (казино, беттинг, приложение, оффер?)
- Какой текст/бонус показать на баннере?
- ГЕО и язык текста?
- Store-friendly или агрессивный стиль?
- Какой CTA (кнопка призыва к действию)?

Если есть референс — опиши что видишь: стиль, цвета, механику. Потом спроси уточнения.
В конце: "Как ответишь — сразу запускаю генерацию!"

### [GENERATE_NOW] — После ответа пользователя
Пользователь УЖЕ ответил на твои вопросы. НЕМЕДЛЕННО генерируй картинки!
Не задавай новых вопросов — вся информация уже есть. ДЕЛАЙ!
ВАЖНО: Создавай НОВЫЕ оригинальные баннеры, НЕ редактируй референсы!

### [EDIT_IMAGES] — Редактирование изображений (ТОЛЬКО по прямой просьбе!)
Этот режим ТОЛЬКО когда пользователь ЯВНО просит: "улучши", "отредактируй", "измени".
ВАЖНО: Создай столько же ОТДЕЛЬНЫХ изображений, сколько прислали!
НЕ склеивай в одно! Улучши КАЖДОЕ изображение отдельно.

## 📸 РЕФЕРЕНСЫ — СОЗДАНИЕ ВАРИАЦИЙ

Когда пользователь прислал картинки:
1. ВНИМАТЕЛЬНО проанализируй:
   - Кто изображён? (персонаж, человек) → СОХРАНИ ЕГО!
   - Какая механика? (коробки, слоты, колесо) → СОХРАНИ ЕЁ!
   - Какие цвета и стиль? → СОХРАНИ ИХ!
   - Какие элементы? (бонус, CTA, иконки) → СОХРАНИ ИХ!

2. Опиши что видишь (в режиме [SMART])

3. При генерации — создавай ВАРИАЦИИ:
   - ТОТ ЖЕ персонаж в том же стиле
   - ТА ЖЕ механика (коробки/слоты/колесо)
   - ТЕ ЖЕ цвета и атмосфера
   - РАЗНЫЕ: заголовки, текст, позиция CTA, компоновка элементов

## 🛡️ ЭКСПЕРТИЗА

### Модерация:
- ❌ "гарантированный выигрыш", "100%", прямые обещания
- ✅ "до X€", "шанс выиграть", "бонус на депозит"
- Мелкий текст: 18+, T&C apply

### Что конвертит:
- Яркие цвета, контраст
- КРУПНЫЙ текст бонуса
- Заметная CTA кнопка
- Urgency элементы

## 💬 СТИЛЬ
Русский, кратко, по делу. Понимаешь сленг арбитража.

## ⚠️ ПРИОРИТЕТ ДИРЕКТИВ
1. [GENERATE_NOW] → сразу генерируй, не спрашивай
2. [FAST] → сразу генерируй, не спрашивай
3. [EDIT_IMAGES] → улучши каждое изображение отдельно
4. [SMART] → ОБЯЗАТЕЛЬНО задай вопросы перед генерацией!`;



/**
 * Получить или создать чат-сессию
 * Модель: Nano Banana Pro (gemini-3-pro-image-preview)
 */
export function getOrCreateChat(chatId, settings = {}) {
  if (!chatSessions.has(chatId)) {
    // ВАЛИДНЫЕ значения aspectRatio для Gemini API
    const VALID_ASPECT_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];

    // Если aspectRatio невалидный или "auto" — используем дефолт 9:16
    let aspectRatio = settings.aspectRatio;
    if (!aspectRatio || aspectRatio === 'auto' || !VALID_ASPECT_RATIOS.includes(aspectRatio)) {
      aspectRatio = '9:16';  // Дефолт — самый универсальный формат
    }

    // ВАЛИДНЫЕ значения imageSize: "1K", "2K", "4K" (или null для авто)
    const imageSize = settings.resolution || '2K';
    const useThinking = settings.thinking !== false; // По умолчанию включен

    const chatConfig = {
      responseModalities: ["TEXT", "IMAGE"],
      systemInstruction: SYSTEM_PROMPT,
      imageConfig: {
        aspectRatio: aspectRatio
      }
    };

    // imageSize добавляем только если явно указан
    if (imageSize && imageSize !== 'auto') {
      chatConfig.imageConfig.imageSize = imageSize;
    }

    // Thinking mode - улучшает качество для сложных задач
    if (useThinking) {
      chatConfig.thinkingConfig = {
        thinkingBudget: 2048  // Токены для "размышлений"
      };
    }

    const chat = ai.chats.create({
      model: "gemini-3-pro-image-preview",
      config: chatConfig
    });

    chatSessions.set(chatId, chat);
    log.info('Created new Gemini chat session', { chatId, aspectRatio, imageSize, thinking: useThinking });
  }
  return chatSessions.get(chatId);
}

/**
 * Отправить сообщение в чат
 * Правильный формат: { message: ... }
 */
export async function sendMessage(chatId, text, images = [], settings = {}) {
  const chat = getOrCreateChat(chatId, settings);

  // Формируем текст с настройками
  let fullText = text || '';

  // Режим быстрый - генерируй сразу без вопросов
  if (settings.mode === 'fast') {
    fullText = '[FAST] Генерируй сразу без вопросов.\n\n' + fullText;
  }

  // Глубокое исследование
  if (settings.deepResearch) {
    fullText = '[DEEP_RESEARCH] ' + fullText;
  }

  // Размер — добавляем только если валидный
  const VALID_ASPECT_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];
  if (settings.aspectRatio && VALID_ASPECT_RATIOS.includes(settings.aspectRatio)) {
    fullText += `\n[Размер: ${settings.aspectRatio}]`;
  }

  // Количество вариантов
  if (settings.variants && settings.variants !== 'auto') {
    fullText += `\n[VARIANTS:${settings.variants}]`;
  }

  // Собираем message в правильном формате
  let message;

  if (images.length > 0) {
    // Мультимодальный запрос: текст + картинки
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
    // Только текст
    message = fullText;
  }

  log.info('Sending message to Gemini', {
    chatId,
    textLength: fullText.length,
    imagesCount: images.length,
    settings
  });

  // Отправляем в ПРАВИЛЬНОМ формате: { message: ... }
  const response = await chat.sendMessage({ message });

  // Парсим ответ
  const result = {
    text: '',
    images: []
  };

  // Обрабатываем части ответа
  const parts = response.candidates?.[0]?.content?.parts || [];

  for (const part of parts) {
    if (part.text) {
      result.text += part.text;
    } else if (part.inlineData) {
      // Сохраняем сгенерированную картинку
      const imageUrl = await saveBase64Image(part.inlineData.data, part.inlineData.mimeType);
      result.images.push({
        url: imageUrl,
        mimeType: part.inlineData.mimeType
      });
    }
  }

  log.info('Gemini response', {
    chatId,
    hasText: !!result.text,
    imagesCount: result.images.length
  });

  return result;
}

/**
 * Отправить сообщение в чат со STREAMING
 * Позволяет получать частичные ответы в реальном времени
 */
export async function sendMessageStream(chatId, text, images = [], settings = {}, onProgress) {
  const chat = getOrCreateChat(chatId, settings);

  // Формируем текст с настройками
  let fullText = text || '';

  // Режим быстрый - генерируй сразу без вопросов
  if (settings.mode === 'fast') {
    fullText = '[FAST] Генерируй сразу без вопросов.\n\n' + fullText;
  }
  // Follow-up: пользователь ответил на вопросы AI — ГЕНЕРИРОВАТЬ КАРТИНКИ!
  else if (settings.isFollowUp) {
    const variants = settings.variants || 3;
    // Помещаем ответ пользователя В НАЧАЛО, а директиву генерации В КОНЕЦ
    // Так Gemini сначала видит контекст, а потом команду "генерируй"
    fullText = fullText + `\n\n---
[GENERATE_NOW] Вся информация получена. СГЕНЕРИРУЙ ${variants} ВАРИАЦИЙ баннера ПРЯМО СЕЙЧАС.

⚠️ КРИТИЧЕСКИ ВАЖНО — СОЗДАВАЙ ВАРИАЦИИ:
- СОХРАНИ персонажа из референса (если есть человек — рисуй ТОГО ЖЕ человека!)
- СОХРАНИ механику (коробки/слоты/колесо — как в референсе)
- СОХРАНИ цвета и стиль оформления
- МЕНЯЙ: заголовки, текст бонуса, позицию кнопки CTA, композицию

Каждая вариация = ТОТ ЖЕ визуальный стиль + ДРУГОЙ текст/компоновка.
Сначала выведи ${variants} изображений, потом краткое описание.`;
    log.info('Adding GENERATE_NOW directive for follow-up', { textLength: fullText.length, variants });
  }
  // Smart режим — ОБЯЗАТЕЛЬНО задать вопросы перед генерацией
  else if (settings.mode === 'smart' && !settings.isEditRequest) {
    fullText = '[SMART] Это первое сообщение. ОБЯЗАТЕЛЬНО задай 3-5 уточняющих вопросов перед генерацией! НЕ генерируй сразу!\n\n' + fullText;
    log.info('Adding SMART directive for questions', { textLength: fullText.length });
  }

  // Редактирование изображений — улучшить КАЖДОЕ отдельно
  if (settings.isEditRequest && settings.editImageCount > 0) {
    const editDirective = `[EDIT_IMAGES] Тебе прислали ${settings.editImageCount} изображений для редактирования.
ВАЖНО: Создай ${settings.editImageCount} ОТДЕЛЬНЫХ улучшенных изображений!
НЕ склеивай их в одно! Каждое изображение улучши отдельно, сохраняя его композицию и стиль.
Применяй запрошенные изменения к КАЖДОМУ изображению.\n\n`;
    fullText = editDirective + fullText;
    log.info('Adding EDIT_IMAGES directive', { editImageCount: settings.editImageCount });
  }

  // Глубокое исследование
  if (settings.deepResearch) {
    fullText = '[DEEP_RESEARCH] ' + fullText;
  }

  // Размер — добавляем только если валидный
  const VALID_ASPECT_RATIOS_STREAM = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];
  if (settings.aspectRatio && VALID_ASPECT_RATIOS_STREAM.includes(settings.aspectRatio)) {
    fullText += `\n[Размер: ${settings.aspectRatio}]`;
  }

  if (settings.variants && settings.variants !== 'auto') {
    fullText += `\n[VARIANTS:${settings.variants}]`;
  }

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

  log.info('Sending streaming message to Gemini', {
    chatId,
    textLength: fullText.length,
    imagesCount: images.length,
    mode: settings.mode,
    fullTextPreview: fullText.substring(0, 200),
    messageType: Array.isArray(message) ? 'multipart' : 'text',
    messagePartsCount: Array.isArray(message) ? message.length : 1,
    imageDataSizes: images.map(img => img.data?.length || 0)
  });

  let stream;
  try {
    // Отправляем со streaming
    stream = await chat.sendMessageStream({ message });
  } catch (error) {
    log.error('Gemini sendMessageStream failed', {
      chatId,
      error: error.message,
      stack: error.stack
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

      // Сохраняем finishReason для анализа после завершения
      if (candidate?.finishReason) {
        result.finishReason = candidate.finishReason;
      }

      // DEBUG: Логируем каждый chunk
      log.info('Gemini chunk received', {
        chatId,
        chunkNumber: chunkCount,
        partsCount: parts.length,
        partTypes: parts.map(p => p.text ? 'text' : p.inlineData ? 'image' : 'unknown'),
        finishReason: candidate?.finishReason,
        hasInlineData: parts.some(p => p.inlineData)
      });

      for (const part of parts) {
        if (part.text) {
          result.text += part.text;
          // Отправляем прогресс текста
          if (onProgress) {
            onProgress({
              status: 'generating_text',
              text: result.text,
              imagesCount: result.images.length
            });
          }
        } else if (part.inlineData) {
          // Сохраняем картинку
          const imageUrl = await saveBase64Image(part.inlineData.data, part.inlineData.mimeType);
          result.images.push({
            url: imageUrl,
            mimeType: part.inlineData.mimeType
          });
          // Отправляем прогресс картинок
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
    log.error('Gemini streaming iteration failed', {
      chatId,
      error: error.message,
      partialText: result.text?.substring(0, 100),
      imagesCount: result.images.length
    });
    throw error;
  }

  log.info('Gemini streaming response complete', {
    chatId,
    hasText: !!result.text,
    textLength: result.text?.length || 0,
    textPreview: result.text?.substring(0, 150),
    imagesCount: result.images.length,
    imageUrls: result.images.map(i => i.url),
    finishReason: result.finishReason
  });

  // Если Gemini вернул пустой ответ — это content moderation или ошибка
  if (!result.text && result.images.length === 0) {
    throw new Error('Запрос заблокирован модерацией. Попробуйте изменить формулировку.');
  }

  // Догенерация недостающих изображений
  // Если получили меньше картинок чем просили — просим ещё
  const targetVariants = parseInt(settings.variants) || 3;
  const maxRetries = 3; // Максимум попыток догенерации
  let retryCount = 0;

  log.info('Checking if need more images', {
    chatId,
    currentImages: result.images.length,
    targetVariants,
    settingsVariants: settings.variants,
    typeofVariants: typeof settings.variants,
    needMore: result.images.length < targetVariants
  });

  while (result.images.length < targetVariants && retryCount < maxRetries) {
    const remaining = targetVariants - result.images.length;
    retryCount++;

    log.info('Requesting additional images', {
      chatId,
      currentCount: result.images.length,
      targetCount: targetVariants,
      remaining,
      retryCount
    });

    if (onProgress) {
      onProgress({
        status: 'generating_image',
        text: result.text,
        imagesCount: result.images.length,
        message: `Генерирую ещё ${remaining} изображений...`
      });
    }

    try {
      const moreMessage = `Сгенерируй ещё ${remaining} вариаций баннера. СОХРАНИ персонажа и механику, МЕНЯЙ текст/заголовки/позицию CTA.`;
      const moreStream = await chat.sendMessageStream({ message: moreMessage });

      for await (const chunk of moreStream) {
        const candidate = chunk.candidates?.[0];
        const parts = candidate?.content?.parts || [];

        if (candidate?.finishReason) {
          result.finishReason = candidate.finishReason;
        }

        for (const part of parts) {
          if (part.inlineData) {
            const imageUrl = await saveBase64Image(part.inlineData.data, part.inlineData.mimeType);
            result.images.push({
              url: imageUrl,
              mimeType: part.inlineData.mimeType
            });
            log.info('Additional image generated', { chatId, imageIndex: result.images.length });
            if (onProgress) {
              onProgress({
                status: 'generating_image',
                text: result.text,
                imagesCount: result.images.length,
                newImage: imageUrl
              });
            }
          } else if (part.text) {
            result.text += '\n' + part.text;
          }
        }
      }

      // Если IMAGE_SAFETY — прекращаем догенерацию
      if (result.finishReason === 'IMAGE_SAFETY') {
        log.warn('Image safety triggered during additional generation', { chatId });
        break;
      }
    } catch (moreError) {
      log.error('Failed to generate additional images', { chatId, error: moreError.message });
      break;
    }
  }

  log.info('Final image count', { chatId, count: result.images.length, target: targetVariants });

  // Если это follow-up и картинок нет — АВТОМАТИЧЕСКИ пробуем сгенерировать
  // Gemini часто пишет только описание, нужно явно попросить картинки
  if (settings.isFollowUp && result.images.length === 0 && result.text && !settings._retryAttempt) {
    log.warn('Follow-up without images, attempting automatic image generation', {
      chatId,
      finishReason: result.finishReason,
      textPreview: result.text.substring(0, 100)
    });

    // Отправляем явную команду на генерацию
    const variants = settings.variants || 3;
    const retryMessage = `Теперь СГЕНЕРИРУЙ ${variants} ВАРИАЦИЙ баннера.
НЕ описывай — СОЗДАЙ реальные картинки прямо сейчас!
СОХРАНИ персонажа и механику из референса!
МЕНЯЙ только: текст, заголовки, позицию CTA.`;

    if (onProgress) {
      onProgress({
        status: 'generating_image',
        text: result.text,
        imagesCount: 0,
        message: 'Генерирую изображения...'
      });
    }

    try {
      log.info('Starting auto-retry for image generation', { chatId, retryMessage });
      const retryStream = await chat.sendMessageStream({ message: retryMessage });

      let retryChunkCount = 0;
      for await (const chunk of retryStream) {
        retryChunkCount++;
        const candidate = chunk.candidates?.[0];
        const parts = candidate?.content?.parts || [];

        // Логируем каждый chunk в retry
        log.info('Retry chunk received', {
          chatId,
          chunkNumber: retryChunkCount,
          partsCount: parts.length,
          partTypes: parts.map(p => p.text ? 'text' : p.inlineData ? 'image' : 'unknown'),
          finishReason: candidate?.finishReason,
          hasInlineData: parts.some(p => p.inlineData)
        });

        // Обновляем finishReason
        if (candidate?.finishReason) {
          result.finishReason = candidate.finishReason;
        }

        for (const part of parts) {
          if (part.text) {
            // Добавляем текст к результату
            result.text += '\n' + part.text;
            log.info('Retry text chunk', { chatId, textLength: part.text.length });
          } else if (part.inlineData) {
            log.info('Retry got inlineData!', { chatId, mimeType: part.inlineData.mimeType, dataLength: part.inlineData.data?.length });
            const imageUrl = await saveBase64Image(part.inlineData.data, part.inlineData.mimeType);
            result.images.push({
              url: imageUrl,
              mimeType: part.inlineData.mimeType
            });
            log.info('Image generated in retry', { chatId, imageIndex: result.images.length, imageUrl });
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

      log.info('Auto-retry completed', { chatId, imagesCount: result.images.length, finishReason: result.finishReason, totalChunks: retryChunkCount });
    } catch (retryError) {
      log.error('Auto-retry failed', { chatId, error: retryError.message, stack: retryError.stack });
    }
  }

  // IMAGE_SAFETY — контент заблокирован
  if (result.finishReason === 'IMAGE_SAFETY') {
    throw new Error('Изображения заблокированы политикой безопасности. Попробуйте изменить запрос.');
  }

  // Если картинок всё ещё нет после retry — добавляем предупреждение
  if (settings.isFollowUp && result.images.length === 0) {
    result.text += '\n\n⚠️ Изображения не удалось сгенерировать. Попробуйте написать "сгенерируй" или измените запрос.';
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
 * Health check
 */
export async function checkHealth() {
  return {
    available: !!config.googleApiKey,
    model: 'gemini-3-pro-image-preview',
    features: ['multi-turn', 'image-understanding', 'image-generation', 'text-rendering']
  };
}

export default {
  getOrCreateChat,
  sendMessage,
  sendMessageStream,
  deleteChat,
  checkHealth
};
