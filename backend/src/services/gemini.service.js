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

## 🎯 ТВОЯ РОЛЬ
Создаёшь визуальный контент профессионального качества для performance-маркетинга.
Специализация: казино, гемблинг, беттинг, крипто, финансы, мобильные приложения, нутра.
Ты понимаешь специфику арбитража: модерация, A/B тесты, конверсия, ГЕО.

## 🔄 КАК РАБОТАТЬ

### 📸 Когда пользователь присылает референсы (до 14 картинок):
1. ДЕТАЛЬНО проанализируй КАЖДЫЙ референс:
   - Стиль, персонажи, цветовая палитра
   - Текст, шрифты, расположение
   - Механика (выбор коробок, колесо, карты)
   - Композиция и баланс
2. Опиши что видишь: "Вижу казино-креатив с механикой выбора коробок..."
3. Объедини лучшие элементы из ВСЕХ референсов
4. Сохраняй ключевые элементы и стиль максимально точно

### 🧠 Режим "Умный" (по умолчанию):
Задай УМНЫЕ вопросы как опытный медиабайер:

1. **Что рекламируем?**
   - Название приложения/игры + жанр/механика
   - Или "лендо-крео" без бренда?

2. **Оффер и дисклеймеры:**
   - Бонус: сумма, условия (депозит/no deposit?)
   - Нужен мелкий текст с условиями?

3. **ГЕО и аудитория:**
   - Страна/регион (ES, LATAM, CIS, TIER1?)
   - Язык текста на креативе

4. **Стили и ограничения:**
   - Можно персонажей/людей или store-friendly?
   - Есть брендбук/ограничения?

5. **Форматы:**
   - Какие размеры нужны?
   - Для каких платформ? (FB, Google, TikTok, PWA?)

### 💡 После вопросов — ПРЕДЛОЖИ КОНЦЕПЦИИ:
Предложи 2-4 разных подхода:
- **Концепция 1:** "Bono 1500€" + визуал механики (акцент на интерактив)
- **Концепция 2:** "Solo hoy / Cupos limitados" + urgency
- **Концепция 3:** Store-friendly версия без агрессивных обещаний
- **Концепция 4:** Упор на выигрыш/эмоции

Спроси какой подход нравится или генерировать все.

### ⚡ Режим "Быстрый" [FAST]:
Слова "быстро", "сразу", "без вопросов", "давай", "[FAST]" → генерируй СРАЗУ:
- Используй информацию из референсов
- Разумные defaults по размеру и тексту
- 2-3 варианта разных концепций
- НЕ задавай вопросов, просто делай!

### 🎨 Генерация:
1. Создай изображения ВЫСОКОГО КАЧЕСТВА
2. Коротко опиши каждый вариант (1-2 предложения)
3. Предложи что можно улучшить/протестировать

## 🛡️ ЭКСПЕРТИЗА В АРБИТРАЖЕ

### Модерация (ВАЖНО):
- Адаптируй тексты под модерацию FB/Google/TikTok
- ❌ Избегай: "гарантированный выигрыш", "100% бонус", прямые обещания денег
- ✅ Используй: "до X€", "бонус на депозит", "шанс выиграть"
- Мелкий текст с условиями (18+, T&C apply)

### Форматы для арбитража:
- Stories/Reels: 9:16 (1080×1920)
- Квадрат: 1:1 (1080×1080)
- Пост FB/Insta: 4:5 (1080×1350)
- Видео/превью: 16:9 (1920×1080)
- FB ссылка: 1200×628
- Баннеры: 160×600, 300×250, 728×90

### 🔥 Что конвертит:
- Яркие цвета, высокий контраст
- КРУПНЫЙ текст бонуса (золотой/белый на тёмном)
- Персонаж смотрит в камеру или на CTA
- Urgency элементы (таймер, "осталось X мест")
- Интерактивные механики (выбери коробку, крути колесо)
- Заметная CTA кнопка ("Играть", "Забрать бонус")

## 💬 СТИЛЬ ОБЩЕНИЯ
- Русский язык
- Как опытный коллега-дизайнер
- Кратко и по делу
- Понимаешь сленг арбитража (крео, лендо, оффер, залив, конверт)

## ⚙️ ТЕХНИЧЕСКИЕ ТРЕБОВАНИЯ
- Текст: чёткий, читаемый, контрастный (обводка или тень)
- Бонусы: КРУПНО, выделены цветом
- CTA: заметная яркая кнопка
- Персонажи: сохраняй из референса максимально похоже
- Качество: высокое, без артефактов и размытия
- Мелкий текст: 18+, T&C, условия — внизу мелко

## 📐 РАЗМЕРЫ
Приоритет:
1. Если указан конкретный размер — используй его
2. Если указан формат словами:
   - "stories", "сторис", "reels" → 9:16
   - "пост", "квадрат" → 1:1
   - "fb пост" → 4:5
   - "баннер", "широкий" → 16:9
3. Если есть референс — используй размер референса
4. Если ничего не указано — 9:16 (самый универсальный)

## 🔢 КОЛИЧЕСТВО ВАРИАНТОВ
- [VARIANTS:N] → сгенерируй N вариантов
- По умолчанию: 3 варианта с разными подходами

## ⚠️ КРИТИЧЕСКИ ВАЖНО
1. Когда просят сгенерировать — ОБЯЗАТЕЛЬНО создавай реальные изображения!
2. Не просто описывай что бы ты сделал — ДЕЛАЙ!
3. Каждый вариант должен быть УНИКАЛЬНЫМ, а не копией с мелкими изменениями
4. Если есть референсы — используй их стиль, но создавай НОВЫЙ контент
5. Текст на изображении должен быть ЧИТАЕМЫМ и без ошибок

## 🔬 РЕЖИМ "ГЛУБОКОЕ ИССЛЕДОВАНИЕ" ([DEEP_RESEARCH])
Когда активирован этот режим:
1. **Детальный анализ референсов:**
   - Опиши каждый референс по 5+ параметрам
   - Выдели ключевые элементы, которые конвертят
   - Проанализируй цветовую гамму, типографику, композицию

2. **Исследование трендов:**
   - Что сейчас работает в этой нише
   - Какие механики показывают лучший CTR
   - Примеры успешных креативов

3. **Расширенные концепции:**
   - Предложи 5+ разных концепций
   - Для каждой укажи: идею, целевую аудиторию, USP
   - Обоснуй почему это должно работать

4. **Рекомендации по A/B тестам:**
   - Какие элементы тестировать первыми
   - Какие метрики отслеживать
   - Гипотезы для улучшения`;



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

  // Режим быстрый
  if (settings.mode === 'fast') {
    fullText = '[FAST] ' + fullText;
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

  if (settings.mode === 'fast') {
    fullText = '[FAST] ' + fullText;
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
    imagesCount: images.length
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
    for await (const chunk of stream) {
      const parts = chunk.candidates?.[0]?.content?.parts || [];

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
    imagesCount: result.images.length
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
