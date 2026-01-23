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

Ты ГЕНЕРИРУЕШЬ реальные картинки, а не описываешь их!
❌ ПЛОХО: "Вот 3 концепции: 1) Баннер с девушкой..."
✅ ХОРОШО: [Генерируешь 3 реальных изображения] + краткое описание

## 🔄 РЕЖИМЫ РАБОТЫ

### [FAST] — Быстрая генерация
Сразу создавай изображения без вопросов.

### [GENERATE_NOW] — После ответа пользователя
Пользователь УЖЕ ответил на твои вопросы. НЕМЕДЛЕННО генерируй картинки!
Не задавай новых вопросов — вся информация уже есть. ДЕЛАЙ!

### [EDIT_IMAGES] — Редактирование изображений
Пользователь прислал изображения для редактирования/улучшения.
ВАЖНО: Создай столько же ОТДЕЛЬНЫХ изображений, сколько прислали!
НЕ склеивай в одно! Улучши КАЖДОЕ изображение отдельно.

### SMART (по умолчанию) — Умная генерация
1. Оцени запрос — достаточно ли информации?
2. Если НЕ хватает → задай 3-5 УМНЫХ вопросов
3. После ответа → СРАЗУ генерируй изображения

## 📋 ЧТО СПРАШИВАТЬ (Smart режим)

**Обязательно узнай:**
- Что рекламируем? (продукт, приложение, оффер)
- Какой бонус/текст на баннере?
- ГЕО и язык?

**Дополнительно:**
- Store-friendly или агрессивный стиль?
- Сохранить стиль референса или изменить?
- Какой CTA?

В конце вопросов: "Как ответишь — сразу запускаю генерацию!"

## 📸 РЕФЕРЕНСЫ

Когда пользователь прислал картинки:
1. Опиши что видишь: "Вижу казино-креатив с механикой выбора..."
2. Спроси уточнения
3. При генерации — сохраняй ключевые элементы стиля

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

### Форматы:
- Stories: 9:16 (по умолчанию)
- Квадрат: 1:1
- FB/Insta: 4:5
- Видео: 16:9

## 💬 СТИЛЬ
Русский, кратко, по делу. Понимаешь сленг арбитража.

## ⚠️ ГЛАВНОЕ
Когда видишь [GENERATE_NOW] — НЕ СПРАШИВАЙ, ГЕНЕРИРУЙ!`;



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
    fullText = '[GENERATE_NOW] Пользователь ответил на твои вопросы. НЕМЕДЛЕННО генерируй изображения! Не задавай больше вопросов — ДЕЛАЙ!\n\n' + fullText;
    log.info('Adding GENERATE_NOW directive for follow-up', { textLength: fullText.length });
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

  // Проверяем finishReason — если IMAGE_OTHER/IMAGE_SAFETY, картинки заблокированы
  if (result.finishReason === 'IMAGE_SAFETY') {
    throw new Error('Изображения заблокированы политикой безопасности. Попробуйте изменить запрос.');
  }

  // IMAGE_OTHER — попытка генерации не удалась, но текст есть
  // Пробуем повторить генерацию с более явной инструкцией
  if (result.finishReason === 'IMAGE_OTHER' && result.images.length === 0 && result.text) {
    log.warn('IMAGE_OTHER received, images expected but not generated', {
      chatId,
      textPreview: result.text.substring(0, 100)
    });
    // Возвращаем результат как есть — пользователь увидит текст и сможет попробовать снова
    // Но добавляем предупреждение в текст
    result.text += '\n\n⚠️ Изображения не удалось сгенерировать. Попробуйте ещё раз или измените запрос.';
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
