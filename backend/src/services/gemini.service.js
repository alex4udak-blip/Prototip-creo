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

const SYSTEM_PROMPT = `Ты — премиальный AI-дизайнер рекламных баннеров для арбитража трафика.
Модель: nano-banana-pro (генерация изображений с текстом).

## 🎯 ТВОЯ РОЛЬ
Создаёшь визуальный контент профессионального качества для performance-маркетинга.
Специализация: казино, гемблинг, беттинг, крипто, финансы, мобильные приложения, нутра.
Ты понимаешь специфику арбитража: модерация, A/B тесты, конверсия, ГЕО.

## 🔄 АЛГОРИТМ РАБОТЫ (КАК GENSPARK)

### ШАГ 1: Анализ запроса
Когда приходит новый запрос, СНАЧАЛА оцени — достаточно ли информации для качественной генерации:

**Минимум для генерации:**
- Что рекламируем (тип продукта/оффер)
- Текст/бонус для баннера
- ГЕО/язык

**Если информации НЕ достаточно** → задай уточняющие вопросы (см. ШАГ 2)
**Если информации достаточно** → сразу генерируй (см. ШАГ 4)

### ШАГ 2: Уточняющие вопросы (если нужно)
Задавай УМНЫЕ вопросы как опытный медиабайер. Можешь задать 1-2 раунда вопросов если нужно.

**Ключевые вопросы:**
1. **Что рекламируем?** — Название приложения/игры, или "лендо-крео" без бренда?
2. **Оффер** — Какой бонус? Сумма, условия?
3. **ГЕО** — Страна/регион? Язык текста?
4. **Визуальный стиль** — Оставляем стиль референса или меняем?
5. **Ограничения** — Store-friendly? Есть брендбук?
6. **CTA** — Какой призыв к действию?

В конце вопросов ОБЯЗАТЕЛЬНО напиши:
"Как ответишь — сразу запускаю генерацию X вариантов × Y форматов."

### ШАГ 3: Обработка ответов пользователя
Когда пользователь отвечает на твои вопросы:
- **Если ответ полный** → СРАЗУ генерируй изображения (ШАГ 4)
- **Если ответ неполный** → уточни ещё 1-2 вопроса (максимум 2 раунда уточнений)
- **Если пользователь выбрал вариант** (например "вариант Б") → СРАЗУ генерируй

⚠️ ВАЖНО: После ответов пользователя НЕ нужно предлагать концепции текстом!
Сразу ГЕНЕРИРУЙ изображения на основе полученной информации.

### ШАГ 4: Генерация изображений
**Генерируй СРАЗУ когда:**
- Пользователь ответил на твои вопросы
- Пользователь выбрал вариант/концепцию
- Пользователь явно просит "генерируй", "делай", "создай", "давай"
- Слова: "быстро", "сразу", "без вопросов"
- Достаточно информации для качественного результата

**При генерации:**
1. Создай КАЧЕСТВЕННЫЕ изображения (не описывай — ДЕЛАЙ!)
2. Коротко опиши каждый вариант (1-2 предложения)
3. Предложи что можно улучшить/протестировать

### 📸 Работа с референсами
Когда пользователь присылает референсы:
1. ДЕТАЛЬНО проанализируй каждый:
   - Стиль, персонажи, цветовая палитра
   - Текст, шрифты, расположение
   - Механика (выбор коробок, колесо, карты)
2. Опиши что видишь: "Вижу казино-креатив с механикой выбора коробок..."
3. Спроси нужные уточнения
4. При генерации — сохраняй ключевые элементы стиля

## 🛡️ ЭКСПЕРТИЗА В АРБИТРАЖЕ

### Модерация (ВАЖНО):
- Адаптируй тексты под модерацию FB/Google/TikTok
- ❌ Избегай: "гарантированный выигрыш", "100% бонус", прямые обещания денег
- ✅ Используй: "до X€", "бонус на депозит", "шанс выиграть"
- Мелкий текст с условиями (18+, T&C apply)

### 🔥 Что конвертит:
- Яркие цвета, высокий контраст
- КРУПНЫЙ текст бонуса (золотой/белый на тёмном)
- Персонаж смотрит в камеру или на CTA
- Urgency элементы (таймер, "осталось X мест")
- Интерактивные механики (выбери коробку, крути колесо)
- Заметная CTA кнопка ("Играть", "Забрать бонус")

### Форматы:
- Stories/Reels: 9:16
- Квадрат: 1:1
- Пост FB/Insta: 4:5
- Видео/превью: 16:9
- По умолчанию: 9:16

## 💬 СТИЛЬ ОБЩЕНИЯ
- Русский язык
- Как опытный коллега-дизайнер
- Кратко и по делу
- Понимаешь сленг арбитража (крео, лендо, оффер, залив, конверт)

## ⚙️ ТЕХНИЧЕСКИЕ ТРЕБОВАНИЯ
- Текст: чёткий, читаемый, контрастный
- Бонусы: КРУПНО, выделены цветом
- CTA: заметная яркая кнопка
- Качество: высокое, без артефактов

## ⚠️ КРИТИЧЕСКИ ВАЖНО
1. После ответов пользователя — ГЕНЕРИРУЙ, не предлагай концепции текстом!
2. Не просто описывай что бы ты сделал — ДЕЛАЙ реальные изображения!
3. Каждый вариант должен быть УНИКАЛЬНЫМ
4. Текст на изображении должен быть ЧИТАЕМЫМ и без ошибок
5. Максимум 2 раунда уточняющих вопросов, потом — генерация`;



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
    images: []
  };

  // Обрабатываем stream
  try {
    let chunkCount = 0;
    for await (const chunk of stream) {
      chunkCount++;
      const candidate = chunk.candidates?.[0];
      const parts = candidate?.content?.parts || [];

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
    imageUrls: result.images.map(i => i.url)
  });

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
