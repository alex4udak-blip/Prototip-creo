import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/env.js';
import { log } from '../utils/logger.js';

const genAI = new GoogleGenerativeAI(config.googleApiKey);

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

1. **Что рекламируем?**
   - Название приложения/игры + жанр/механика
   - Или "лендо-крео" без бренда?

2. **Оффер и дисклеймеры:**
   - Бонус: сумма, условия (депозит/no deposit?)
   - Нужен мелкий текст с условиями?

3. **ГЕО и аудитория:**
   - Страна/регион (ES, LATAM, CIS, TIER1?)
   - Язык текста

4. **Стили и ограничения:**
   - Можно персонажей/людей или store-friendly?
   - Есть брендбук/ограничения?

5. **Форматы:**
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
Если не указано — сгенерируй 3 варианта с разными подходами.`;

/**
 * Получить или создать чат-сессию
 */
export function getOrCreateChat(chatId) {
  if (!chatSessions.has(chatId)) {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp",  // или gemini-1.5-pro если нет доступа
      systemInstruction: SYSTEM_PROMPT
    });

    const chat = model.startChat({
      generationConfig: {
        maxOutputTokens: 8192,
      }
    });

    chatSessions.set(chatId, chat);
    log.info('Created new Gemini chat session', { chatId });
  }
  return chatSessions.get(chatId);
}

/**
 * Отправить сообщение в чат
 */
export async function sendMessage(chatId, text, images = [], settings = {}) {
  const chat = getOrCreateChat(chatId);

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

  // Собираем контент для отправки
  const contents = [];

  // Добавляем картинки
  for (const img of images) {
    contents.push({
      inlineData: {
        mimeType: img.mimeType || 'image/png',
        data: img.data
      }
    });
  }

  // Добавляем текст
  if (fullText.trim()) {
    contents.push(fullText);
  }

  log.info('Sending message to Gemini', {
    chatId,
    textLength: fullText.length,
    imagesCount: images.length,
    settings
  });

  // Отправляем
  const response = await chat.sendMessage(contents);
  const responseText = response.response.text();

  // Парсим ответ
  const result = {
    text: responseText,
    images: []
  };

  // Gemini 2.0 может возвращать картинки в candidates
  // Проверяем наличие частей с изображениями
  const parts = response.response.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData) {
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
    model: 'gemini-2.0-flash-exp',
    features: ['multi-turn', 'image-understanding', 'text-generation']
  };
}

export default {
  getOrCreateChat,
  sendMessage,
  deleteChat,
  checkHealth
};
