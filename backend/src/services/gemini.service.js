import { GoogleGenAI } from "@google/genai";
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/env.js';
import { log } from '../utils/logger.js';

// Инициализация клиента
const ai = new GoogleGenAI({ apiKey: config.googleApiKey });

// Хранилище истории чатов (chatId -> массив сообщений)
const chatHistories = new Map();

const SYSTEM_PROMPT = `Ты — премиальный AI-дизайнер рекламных баннеров для арбитража трафика.

## 🎯 ТВОЯ РОЛЬ
Создаёшь визуальный контент профессионального качества для performance-маркетинга.
Специализация: казино, гемблинг, беттинг, крипто, финансы, мобильные приложения, нутра.
Ты понимаешь специфику арбитража: модерация, A/B тесты, конверсия, ГЕО.

## 🔄 КАК РАБОТАТЬ

### 📸 Когда пользователь присылает референсы:
1. ДЕТАЛЬНО проанализируй референс
2. Опиши что видишь: "Вижу казино-креатив с механикой выбора коробок..."
3. СГЕНЕРИРУЙ новые изображения в похожем стиле

### 🧠 Умный режим (по умолчанию):
Если пользователь НЕ просит явно сгенерировать ("генерируй", "создай", "сделай"):
- Задай 2-3 уточняющих вопроса
- Предложи концепции
- Дождись ответа перед генерацией

### ⚡ Быстрый режим [FAST]:
Когда видишь [FAST] — генерируй изображения СРАЗУ без вопросов.

### 🎨 Генерация изображений:
ВАЖНО: Когда пользователь просит генерировать или выбрал концепцию —
ОБЯЗАТЕЛЬНО создавай реальные изображения! Не просто описывай — ДЕЛАЙ!

## 🛡️ ЭКСПЕРТИЗА
- Адаптируй под модерацию FB/Google/TikTok
- Используй: "до X€", "бонус на депозит", "шанс выиграть"
- Мелкий текст: 18+, T&C apply

## 💬 СТИЛЬ
- Русский язык
- Кратко и по делу
- Понимаешь сленг арбитража

## ⚠️ КРИТИЧНО
1. Когда просят сгенерировать — СОЗДАВАЙ изображения!
2. С референсом — анализируй и генерируй похожее
3. Текст на изображении — читаемый и без ошибок`;

// ВАЛИДНЫЕ значения aspectRatio для Gemini API
const VALID_ASPECT_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];

/**
 * Получить историю чата
 */
function getChatHistory(chatId) {
  if (!chatHistories.has(chatId)) {
    chatHistories.set(chatId, []);
  }
  return chatHistories.get(chatId);
}

/**
 * Добавить сообщение в историю
 */
function addToHistory(chatId, role, parts) {
  const history = getChatHistory(chatId);
  history.push({ role, parts });

  // Ограничиваем историю последними 20 сообщениями (10 пар)
  if (history.length > 20) {
    history.splice(0, 2);
  }

  log.debug('Chat history updated', { chatId, historyLength: history.length });
}

/**
 * Получить настройки генерации
 */
function getGenerationConfig(settings = {}) {
  let aspectRatio = settings.aspectRatio;
  if (!aspectRatio || aspectRatio === 'auto' || !VALID_ASPECT_RATIOS.includes(aspectRatio)) {
    aspectRatio = '9:16';
  }

  const imageSize = settings.resolution || '2K';

  return {
    responseModalities: ['TEXT', 'IMAGE'],
    imageConfig: {
      aspectRatio: aspectRatio,
      imageSize: imageSize
    }
  };
}

/**
 * Отправить сообщение в Gemini с сохранением истории
 */
export async function sendMessageStream(chatId, text, images = [], settings = {}, onProgress) {
  const history = getChatHistory(chatId);

  // Формируем текст с настройками
  let fullText = text || '';

  // Режим быстрый
  if (settings.mode === 'fast') {
    fullText = '[FAST] ' + fullText;
  }

  // Глубокое исследование
  if (settings.deepResearch) {
    fullText = '[DEEP_RESEARCH] ' + fullText;
  }

  // Количество вариантов
  if (settings.variants && settings.variants !== 'auto') {
    fullText += `\n[Сгенерируй ${settings.variants} вариантов]`;
  }

  // Собираем parts для сообщения пользователя
  const userParts = [];

  if (fullText.trim()) {
    userParts.push({ text: fullText });
  }

  // Добавляем изображения
  for (const img of images) {
    userParts.push({
      inlineData: {
        mimeType: img.mimeType || 'image/png',
        data: img.data
      }
    });
  }

  // Формируем contents с историей
  const contents = [
    // Системная инструкция как первое сообщение
    {
      role: 'user',
      parts: [{ text: SYSTEM_PROMPT + '\n\nПонял. Готов помочь с созданием креативов.' }]
    },
    {
      role: 'model',
      parts: [{ text: 'Понял! Я готов помочь с созданием рекламных баннеров. Присылай референсы или опиши что нужно.' }]
    },
    // История предыдущих сообщений
    ...history,
    // Текущее сообщение пользователя
    {
      role: 'user',
      parts: userParts
    }
  ];

  log.info('Sending message to Gemini', {
    chatId,
    textLength: fullText.length,
    imagesCount: images.length,
    historyLength: history.length,
    mode: settings.mode
  });

  const generationConfig = getGenerationConfig(settings);

  let response;
  try {
    // Используем generateContentStream напрямую с историей
    response = await ai.models.generateContentStream({
      model: 'gemini-2.0-flash-exp',
      contents: contents,
      config: generationConfig
    });
  } catch (error) {
    log.error('Gemini generateContentStream failed', {
      chatId,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }

  const result = {
    text: '',
    images: []
  };

  // Собираем части ответа для истории
  const modelParts = [];

  try {
    for await (const chunk of response) {
      const parts = chunk.candidates?.[0]?.content?.parts || [];

      for (const part of parts) {
        if (part.text) {
          result.text += part.text;
          modelParts.push({ text: part.text });

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

          // НЕ добавляем изображения в историю (слишком большие)

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
      partialText: result.text?.substring(0, 100)
    });
    throw error;
  }

  // Сохраняем в историю (только текст, без изображений)
  addToHistory(chatId, 'user', userParts.filter(p => p.text));
  if (result.text) {
    addToHistory(chatId, 'model', [{ text: result.text }]);
  }

  log.info('Gemini response complete', {
    chatId,
    textLength: result.text?.length || 0,
    imagesCount: result.images.length,
    historyLength: getChatHistory(chatId).length
  });

  return result;
}

/**
 * Синхронная версия (без streaming)
 */
export async function sendMessage(chatId, text, images = [], settings = {}) {
  return sendMessageStream(chatId, text, images, settings, null);
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
 * Очистить историю чата
 */
export function deleteChat(chatId) {
  if (chatHistories.has(chatId)) {
    chatHistories.delete(chatId);
    log.info('Deleted chat history', { chatId });
  }
}

/**
 * Получить или создать чат (для совместимости)
 */
export function getOrCreateChat(chatId, settings = {}) {
  getChatHistory(chatId);
  return { chatId };
}

/**
 * Health check
 */
export async function checkHealth() {
  return {
    available: !!config.googleApiKey,
    model: 'gemini-2.0-flash-exp',
    features: ['multi-turn', 'image-understanding', 'image-generation', 'history']
  };
}

export default {
  getOrCreateChat,
  sendMessage,
  sendMessageStream,
  deleteChat,
  checkHealth
};
