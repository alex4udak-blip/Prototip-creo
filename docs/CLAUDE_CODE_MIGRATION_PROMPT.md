# BannerGen v2: Миграция на Gemini 3 Pro Image

## ЗАДАЧА

Полностью переписать BannerGen с текущей архитектуры (Claude + Imagen 3) на новую (Gemini 3 Pro Image / Nano Banana Pro).

**Главная проблема сейчас:** Imagen 3 не видит картинки. Мы используем 4-5 отдельных вызовов Claude чтобы описать референс словами, потом передаём текст в Imagen. Это костыли которые не работают нормально.

**Решение:** Gemini 3 Pro Image — это LLM который нативно видит картинки И генерирует их. Одна модель делает всё.

---

## КРИТИЧЕСКИ ВАЖНО

### Модель для использования:
```
gemini-3-pro-image-preview (Nano Banana Pro)
```

### Ключевые возможности:
- **Multi-turn chat** — помнит весь контекст диалога
- **Нативное понимание картинок** — видит референсы без отдельного Vision
- **Редактирование своих картинок** — может изменять то что сгенерировал
- **Текст на картинках** — качественный рендеринг текста
- **До 14 референс-картинок** в одном запросе
- **Разрешение до 4K**

### API формат:
```javascript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

// Создаём чат-сессию (НЕ отдельные запросы!)
const chat = ai.chats.create({
  model: "gemini-3-pro-image-preview",
  config: {
    responseModalities: ['TEXT', 'IMAGE'],
    systemInstruction: SYSTEM_PROMPT
  }
});

// Отправляем сообщение с картинкой
const response = await chat.sendMessage([
  { text: "Сделай похожий баннер для Испании" },
  { inlineData: { mimeType: "image/png", data: base64Image } }
]);

// Парсим ответ
for (const part of response.candidates[0].content.parts) {
  if (part.text) console.log(part.text);
  if (part.inlineData) saveImage(part.inlineData.data);
}
```

---

## ЧТО УДАЛИТЬ (мёртвый код)

### Backend:
| Файл | Строк | Причина |
|------|-------|---------|
| `backend/src/services/prompt.service.js` | 1225 | Claude Vision/Clarification больше не нужны |
| `backend/src/services/router.service.js` | 525 | Одна модель — не нужен роутинг |
| `backend/src/services/runware.service.js` | 401 | Не используется |

### Frontend:
| Файл | Причина |
|------|---------|
| `frontend/src/components/Chat/ClarificationQuestions.jsx` | Gemini спрашивает прямо в чате |
| `frontend/src/components/Settings/SettingsModal.jsx` | Заменяем на inline настройки |

---

## ЧТО СОЗДАТЬ/ПЕРЕПИСАТЬ

### 1. Backend: `gemini.service.js` (новый файл, ~150 строк)

```javascript
import { GoogleGenAI } from "@google/genai";
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/env.js';
import { log } from '../utils/logger.js';

const ai = new GoogleGenAI({ apiKey: config.googleApiKey });

// Хранилище чат-сессий (chatId → GeminiChat)
const chatSessions = new Map();

const SYSTEM_PROMPT = `Ты — премиальный AI-дизайнер рекламных баннеров.

## ТВОЯ РОЛЬ
Создаёшь визуальный контент профессионального качества для digital-рекламы.
Специализация: казино, гемблинг, беттинг, финансы, мобильные приложения.

## КАК РАБОТАТЬ

### Когда пользователь присылает картинку:
1. Проанализируй: стиль, персонажей, цвета, текст, композицию
2. Используй как референс для генерации
3. Сохрани ключевые элементы (персонажей, атмосферу, стиль)

### Когда нужна информация (режим "Умный"):
Спроси КОРОТКО (1-2 вопроса максимум):
- Размер если не указан и не определяется из контекста
- ГЕО/язык текста
- Текст бонуса/оффера если это казино/беттинг
- Название бренда/приложения

### Когда пользователь торопится (режим "Быстрый"):
Слова "быстро", "сразу", "без вопросов", "давай", "[FAST]" → генерируй сразу с разумными defaults:
- Размер: 1200x628 (универсальный)
- Язык: русский
- Стиль: как на референсе или премиальный современный

### Генерация:
1. Создай изображение высокого качества
2. Коротко опиши что сделал (1-2 предложения)
3. Если уместно — предложи вариант улучшения

## СТИЛЬ ОБЩЕНИЯ
- Русский язык
- Кратко и по делу
- Профессионально но дружелюбно
- Без длинных объяснений

## ТЕХНИЧЕСКИЕ ТРЕБОВАНИЯ К КАРТИНКАМ
- Текст: чёткий, читаемый, контрастный фону
- Бонусы: выделяй размером и цветом (золотой, белый на тёмном)
- CTA кнопки: заметные, с призывом ("Играть", "Получить", "Забрать")
- Персонажи: сохраняй из референса максимально похоже

## РАЗМЕРЫ (aspectRatio)
Если пользователь указал или понятно из контекста:
- "stories", "сторис", "9:16" → вертикальный 9:16
- "пост", "квадрат", "1:1" → квадратный 1:1
- "баннер", "широкий", "16:9" → горизонтальный 16:9
- "fb", "facebook" → 1200x628 (примерно 16:9)
Если не указано — используй 16:9 как универсальный.

## КОЛИЧЕСТВО ВАРИАНТОВ
Если указано "[VARIANTS:N]" — сгенерируй N вариантов.
Если не указано — сгенерируй 2-3 варианта.`;

/**
 * Получить или создать чат-сессию
 */
export function getOrCreateChat(chatId) {
  if (!chatSessions.has(chatId)) {
    const chat = ai.chats.create({
      model: "gemini-3-pro-image-preview",
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
        systemInstruction: SYSTEM_PROMPT
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
  
  // Размер (если не auto)
  if (settings.aspectRatio && settings.aspectRatio !== 'auto') {
    fullText += `\n[Размер: ${settings.aspectRatio}]`;
  }
  
  // Количество вариантов (если не auto)
  if (settings.variants && settings.variants !== 'auto') {
    fullText += `\n[VARIANTS:${settings.variants}]`;
  }
  
  // Собираем контент
  const contents = [];
  
  if (fullText.trim()) {
    contents.push({ text: fullText });
  }
  
  // Добавляем картинки
  for (const img of images) {
    contents.push({
      inlineData: {
        mimeType: img.mimeType || 'image/png',
        data: img.data // base64
      }
    });
  }
  
  log.info('Sending message to Gemini', { 
    chatId, 
    textLength: fullText.length,
    imagesCount: images.length,
    settings 
  });
  
  // Конфиг генерации
  const generationConfig = {
    imageConfig: {
      imageSize: settings.resolution || '2K' // '1K', '2K', '4K'
    }
  };
  
  // Добавляем aspectRatio если указан
  if (settings.aspectRatio && settings.aspectRatio !== 'auto') {
    generationConfig.imageConfig.aspectRatio = settings.aspectRatio;
  }
  
  // Отправляем
  const response = await chat.sendMessage(contents, { config: generationConfig });
  
  // Парсим ответ
  const result = {
    text: null,
    images: []
  };
  
  for (const part of response.candidates[0].content.parts) {
    if (part.text) {
      result.text = part.text;
    } else if (part.inlineData) {
      // Сохраняем картинку
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
    model: 'gemini-3-pro-image-preview',
    features: ['multi-turn', 'image-understanding', 'image-generation', 'text-rendering']
  };
}

export default {
  getOrCreateChat,
  sendMessage,
  deleteChat,
  checkHealth
};
```

---

### 2. Backend: Упростить `generate.routes.js` (~200 строк)

Удалить всю сложную логику clarification, deep thinking, router selection.
Оставить простой endpoint:

```javascript
import { Router } from 'express';
import { db } from '../db/client.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { uploadMiddleware, getFileUrl } from '../middleware/upload.middleware.js';
import { sendMessage, deleteChat } from '../services/gemini.service.js';
import { broadcastToChat } from '../websocket/handler.js';
import { log } from '../utils/logger.js';
import fs from 'fs';

const router = Router();
router.use(authMiddleware);

/**
 * POST /api/generate
 * Главный endpoint — отправить сообщение в Gemini
 */
router.post('/', uploadMiddleware.single('reference'), async (req, res) => {
  try {
    const { prompt, chat_id, settings } = req.body;
    const userId = req.user.id;
    
    // Парсим settings если строка
    const parsedSettings = typeof settings === 'string' ? JSON.parse(settings) : (settings || {});
    
    // Создаём или получаем чат
    let chatId = chat_id ? parseInt(chat_id) : null;
    
    if (!chatId) {
      // Создаём новый чат
      const chat = await db.getOne(
        'INSERT INTO chats (user_id, title) VALUES ($1, $2) RETURNING *',
        [userId, prompt?.substring(0, 50) || 'Новый чат']
      );
      chatId = chat.id;
    }
    
    // Сохраняем сообщение пользователя
    const userMessage = await db.getOne(
      'INSERT INTO messages (chat_id, role, content) VALUES ($1, $2, $3) RETURNING *',
      [chatId, 'user', prompt]
    );
    
    // Подготавливаем картинки
    const images = [];
    
    // Загруженный файл
    if (req.file) {
      const base64 = fs.readFileSync(req.file.path).toString('base64');
      images.push({
        data: base64,
        mimeType: req.file.mimetype
      });
      
      // Обновляем сообщение с картинкой
      await db.query(
        'UPDATE messages SET image_url = $1 WHERE id = $2',
        [getFileUrl(req.file.filename), userMessage.id]
      );
    }
    
    // Отправляем прогресс через WebSocket
    broadcastToChat(chatId, {
      type: 'status',
      phase: 'generating',
      message: 'Генерирую...'
    });
    
    // Вызываем Gemini
    const result = await sendMessage(chatId, prompt, images, parsedSettings);
    
    // Сохраняем ответ AI
    const assistantMessage = await db.getOne(
      'INSERT INTO messages (chat_id, role, content, images) VALUES ($1, $2, $3, $4) RETURNING *',
      [chatId, 'assistant', result.text, JSON.stringify(result.images)]
    );
    
    // Отправляем результат через WebSocket
    broadcastToChat(chatId, {
      type: 'message',
      message: {
        id: assistantMessage.id,
        role: 'assistant',
        content: result.text,
        images: result.images,
        created_at: assistantMessage.created_at
      }
    });
    
    broadcastToChat(chatId, { type: 'complete' });
    
    // HTTP ответ
    res.json({
      success: true,
      chat_id: chatId,
      message: {
        id: assistantMessage.id,
        role: 'assistant',
        content: result.text,
        images: result.images
      }
    });
    
  } catch (error) {
    log.error('Generate error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/generate/chat/:id
 * Удалить чат и освободить сессию Gemini
 */
router.delete('/chat/:id', async (req, res) => {
  try {
    const chatId = parseInt(req.params.id);
    
    // Удаляем сессию Gemini
    deleteChat(chatId);
    
    // Удаляем из БД
    await db.query('DELETE FROM messages WHERE chat_id = $1', [chatId]);
    await db.query('DELETE FROM chats WHERE id = $1 AND user_id = $2', [chatId, req.user.id]);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

---

### 3. Backend: Обновить `config/env.js`

Добавить:
```javascript
export const config = {
  // ... существующие
  googleApiKey: process.env.GOOGLE_API_KEY,  // НОВОЕ — для Gemini API
  // googleCloudProject и googleCredentialsJson можно оставить как fallback для Vertex AI
};
```

---

### 4. Frontend: Упростить `useChat.js`

Убрать:
- `pendingClarification` — не нужно
- `deepThinkingData` — не нужно  
- Все фазы кроме: `idle`, `generating`, `complete`, `error`
- Функцию `checkNeedsClarification` — не нужна
- Функцию `processAnswers` — не нужна

Оставить простой flow:
```javascript
// Отправка сообщения
sendMessage: async (prompt, imageFile) => {
  set({ isGenerating: true, phase: 'generating' });
  
  const formData = new FormData();
  formData.append('prompt', prompt);
  formData.append('chat_id', get().currentChat?.id);
  formData.append('settings', JSON.stringify(get().settings));
  if (imageFile) formData.append('reference', imageFile);
  
  const response = await fetch('/api/generate', {
    method: 'POST',
    body: formData
  });
  
  // Результат приходит через WebSocket
}
```

---

### 5. Frontend: Переделать `InputArea.jsx`

**Убрать:**
- 3 режима (smart/fast/deep) → 2 режима (smart/fast)
- Отдельный Vision анализ с тегами
- Сложную логику

**Добавить:**
- Inline настройки (разворачиваются по клику)
- Переключатель Умный/Быстрый

**Структура UI:**
```jsx
<div className="input-container">
  {/* Превью прикреплённой картинки (простое, без Vision тегов) */}
  {attachedImage && (
    <div className="attached-preview">
      <img src={preview} />
      <button onClick={clear}>✕</button>
    </div>
  )}
  
  {/* Основной input */}
  <div className="input-row">
    <button onClick={attachFile}>📎</button>
    <button onClick={toggleSettings}>⚙️</button>
    <textarea placeholder="Опишите баннер..." />
    <div className="mode-toggle">
      <button className={mode === 'smart' ? 'active' : ''}>Умный</button>
      <button className={mode === 'fast' ? 'active' : ''}>⚡</button>
    </div>
    <button onClick={send}>Отправить</button>
  </div>
  
  {/* Расширенные настройки (скрыты по умолчанию) */}
  {showSettings && (
    <div className="settings-panel">
      <div className="setting-row">
        <label>Размер:</label>
        <div className="options">
          <button className={aspectRatio === 'auto' ? 'active' : ''}>Auto</button>
          <button className={aspectRatio === '1:1' ? 'active' : ''}>1:1</button>
          <button className={aspectRatio === '16:9' ? 'active' : ''}>16:9</button>
          <button className={aspectRatio === '9:16' ? 'active' : ''}>9:16</button>
        </div>
      </div>
      <div className="setting-row">
        <label>Варианты:</label>
        <div className="options">
          <button className={variants === 'auto' ? 'active' : ''}>Auto</button>
          <button>1</button>
          <button>2</button>
          <button>3</button>
          <button>4</button>
        </div>
      </div>
      <div className="setting-row">
        <label>Качество:</label>
        <div className="options">
          <button>1K</button>
          <button className="active">2K</button>
          <button>4K</button>
        </div>
      </div>
    </div>
  )}
</div>
```

---

### 6. Frontend: Удалить файлы

```bash
rm frontend/src/components/Chat/ClarificationQuestions.jsx
rm frontend/src/components/Settings/SettingsModal.jsx
```

Убрать импорты этих компонентов из других файлов.

---

### 7. Frontend: Обновить `Message.jsx`

Упростить — убрать специальную обработку clarification, deep thinking.
Оставить:
- Текст сообщения
- Картинки (галерея)
- Индикатор загрузки

---

## ENV переменные

```env
# Новое (Gemini API)
GOOGLE_API_KEY=your_gemini_api_key

# Можно удалить (больше не нужны)
# ANTHROPIC_API_KEY=...  — Claude больше не используется

# Оставить если нужен fallback на Vertex AI
GOOGLE_CLOUD_PROJECT=...
GOOGLE_APPLICATION_CREDENTIALS_JSON=...
```

---

## DEFAULTS

| Настройка | Default значение | Логика |
|-----------|------------------|--------|
| `mode` | `smart` | AI спрашивает если нужно |
| `aspectRatio` | `auto` | AI определяет из промпта |
| `variants` | `auto` | AI решает (обычно 2-3) |
| `resolution` | `2K` | Хорошее качество без оверкилла |

---

## Что НЕ ТРОГАТЬ

Эти файлы работают нормально, не меняй их без необходимости:

- `frontend/src/components/Chat/ChatWindow.jsx` — отображение чата
- `frontend/src/components/Chat/Message.jsx` — только упростить
- `frontend/src/components/Layout/Sidebar.jsx` — список чатов
- `frontend/src/components/Layout/Header.jsx` — шапка
- `frontend/src/pages/ChatPage.jsx` — layout страницы
- `frontend/src/styles/globals.css` — стили (можно добавить новые)
- `backend/src/routes/auth.routes.js` — авторизация
- `backend/src/routes/chat.routes.js` — CRUD чатов
- `backend/src/db/*` — база данных
- `backend/src/websocket/handler.js` — WebSocket

---

## Порядок выполнения

1. **Backend сначала:**
   - Создать `gemini.service.js`
   - Обновить `config/env.js`
   - Переписать `generate.routes.js`
   - Удалить `prompt.service.js`, `router.service.js`, `runware.service.js`
   - Тест: `curl` запрос к новому endpoint

2. **Frontend потом:**
   - Упростить `useChat.js`
   - Переделать `InputArea.jsx`
   - Упростить `Message.jsx`
   - Удалить `ClarificationQuestions.jsx`, `SettingsModal.jsx`
   - Тест: полный flow в браузере

---

## Проверка результата

После миграции должно работать:

1. ✅ Загрузить референс → AI видит и понимает его
2. ✅ Написать "сделай для Испании" → генерирует похожий баннер
3. ✅ Написать "фон темнее" → редактирует СВОЮ картинку
4. ✅ AI помнит весь контекст диалога
5. ✅ Режим "Быстрый" → генерирует без вопросов
6. ✅ Режим "Умный" → спрашивает если не хватает инфо
7. ✅ Настройки размера/вариантов работают
