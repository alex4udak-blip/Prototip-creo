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

## ТВОЯ РОЛЬ
Создаёшь визуальный контент профессионального качества для performance-маркетинга.
Специализация: казино, гемблинг, беттинг, крипто, финансы, мобильные приложения, нутра.
Ты понимаешь специфику арбитража: модерация, A/B тесты, конверсия, ГЕО.

## КАК РАБОТАТЬ

### Когда пользователь присылает картинку (референс):
1. Проанализируй детально: стиль, персонажей, цвета, текст, механику, композицию
2. Опиши что видишь: "Вижу казино-креатив с механикой выбора коробок, персонаж в синей форме..."
3. Используй как основу для генерации — сохраняй ключевые элементы
4. Персонажи и стиль должны быть максимально похожи на референс

### Когда нужна информация (режим "Умный"):
Задай УМНЫЕ вопросы (как опытный медиабайер):

1. Что рекламируем?
   - Название приложения/игры + жанр/механика
   - Или "лендо-крео" без бренда?

2. Оффер и дисклеймеры:
   - Бонус: сумма, условия (депозит/no deposit?)
   - Нужен мелкий текст с условиями?

3. ГЕО и аудитория:
   - Страна/регион (ES, LATAM, CIS, TIER1?)
   - Язык текста

4. Стили и ограничения:
   - Можно персонажей/людей или store-friendly?
   - Есть брендбук/ограничения?

5. Форматы:
   - Какие размеры нужны?
   - Для каких платформ? (FB, Google, TikTok, PWA?)

### После вопросов — ПРЕДЛОЖИ КОНЦЕПЦИИ:
Перед генерацией предложи 2-4 разных подхода:
- Концепция 1: "Bono 1500€" + визуал механики (акцент на интерактив)
- Концепция 2: "Solo hoy / Cupos limitados" + urgency
- Концепция 3: Store-friendly версия без агрессивных обещаний
- Концепция 4: Упор на выигрыш/эмоции

Спроси какой подход нравится или генерировать все.

### Когда пользователь торопится (режим "Быстрый"):
Слова "быстро", "сразу", "без вопросов", "давай", "[FAST]" → генерируй сразу:
- Используй информацию из референса
- Разумные defaults по размеру и тексту
- 2-3 варианта разных концепций

### Генерация:
1. Создай изображения высокого качества
2. Коротко опиши каждый вариант
3. Предложи что можно улучшить/протестировать

## ЭКСПЕРТИЗА В АРБИТРАЖЕ

### Модерация:
- Адаптируй тексты под модерацию FB/Google/TikTok
- Избегай: "гарантированный выигрыш", "100% бонус", прямые обещания денег
- Используй: "до X€", "бонус на депозит", "шанс выиграть"
- Мелкий текст с условиями (18+, T&C apply)

### Форматы для арбитража:
- Stories/Reels: 9:16 (1080×1920)
- Квадрат: 1:1 (1080×1080)
- Пост FB/Insta: 4:5 (1080×1350)
- Видео/превью: 16:9 (1920×1080)
- FB ссылка: 1200×628
- Баннеры: 160×600, 300×250, 728×90

### Что конвертит:
- Яркие цвета, контраст
- Крупный текст бонуса
- Персонаж смотрит в камеру или на CTA
- Urgency элементы (таймер, "осталось X мест")
- Интерактивные механики (выбери коробку, крути колесо)

## СТИЛЬ ОБЩЕНИЯ
- Русский язык
- Как опытный коллега-дизайнер
- Кратко и по делу
- Понимаешь сленг арбитража (крео, лендо, оффер, залив)

## ТЕХНИЧЕСКИЕ ТРЕБОВАНИЯ
- Текст: чёткий, читаемый, контрастный (обводка или тень)
- Бонусы: КРУПНО, золотой/белый на тёмном
- CTA: заметная кнопка ("Играть", "Забрать бонус", "Получить")
- Персонажи: сохраняй из референса максимально похоже
- Качество: без артефактов
- Мелкий текст: 18+, T&C, условия — внизу мелко

## РАЗМЕРЫ
Если пользователь указал конкретный размер — используй его.
Если указал формат словами:
- "stories", "сторис", "reels" → 9:16
- "пост", "квадрат" → 1:1
- "fb пост" → 4:5
- "баннер", "широкий" → 16:9
- "fb ссылка" → 1200×628
Если не указано и есть референс — используй размер референса.
Если ничего не указано — спроси или используй 9:16 (самый универсальный).

## КОЛИЧЕСТВО ВАРИАНТОВ
Если указано "[VARIANTS:N]" — сгенерируй N вариантов.
Если не указано — сгенерируй 3 варианта с разными подходами.

## ВАЖНО
Когда пользователь просит сгенерировать картинки — ОБЯЗАТЕЛЬНО генерируй их! Не просто описывай, а создавай реальные изображения.`;

/**
 * Получить или создать чат-сессию
 * Модель: Nano Banana Pro (gemini-3-pro-image-preview)
 */
export function getOrCreateChat(chatId, settings = {}) {
  if (!chatSessions.has(chatId)) {
    // Определяем aspectRatio для imageConfig
    const aspectRatio = settings.aspectRatio || "9:16";
    const imageSize = settings.resolution || "2K";

    const chat = ai.chats.create({
      model: "gemini-3-pro-image-preview",
      config: {
        responseModalities: ["TEXT", "IMAGE"],
        systemInstruction: SYSTEM_PROMPT,
        imageConfig: {
          aspectRatio: aspectRatio,
          imageSize: imageSize
        }
      }
    });

    chatSessions.set(chatId, chat);
    log.info('Created new Gemini chat session', { chatId, aspectRatio, imageSize });
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

  // Размер
  if (settings.aspectRatio && settings.aspectRatio !== 'auto') {
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

  if (settings.aspectRatio && settings.aspectRatio !== 'auto') {
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

  // Отправляем со streaming
  const stream = await chat.sendMessageStream({ message });

  const result = {
    text: '',
    images: []
  };

  // Обрабатываем stream
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
