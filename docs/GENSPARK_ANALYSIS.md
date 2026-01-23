# Анализ конкурента Genspark.ai и план улучшения BannerGen

## Дата: Январь 2026

---

## 1. Как работает Genspark

### 1.1 Модели генерации
Genspark использует **Mixture-of-Agents** подход:
- **Nano Banana** (Gemini 2.5 Flash Image) — для быстрой генерации
- **GPT Image** (GPT-image-1) — для качества
- **Flux.1 Kontext** — для редактирования

**Ключевое:** Они генерируют **3-5 вариантов** одновременно от РАЗНЫХ моделей и дают пользователю выбор!

### 1.2 Multi-turn Conversation (Живой чат)
```
КРИТИЧНО: Genspark сохраняет контекст через CHAT SESSION!
```

Как это работает в Gemini API:
```python
# Создаём chat сессию — она хранит всю историю
chat = client.chats.create(model="gemini-2.5-flash-image")

# Первый запрос
response = chat.send_message([image, "создай баннер"])

# Второй запрос — КОНТЕКСТ СОХРАНЁН!
response = chat.send_message([previous_image, "измени текст на испанский"])

# Третий запрос — всё ещё помнит!
response = chat.send_message("сделай фон темнее")
```

**У нас сейчас:** Каждый запрос идёт как НОВЫЙ, без контекста!

### 1.3 Identity Lock (Сохранение персонажа)
```
Genspark делает ВАРИАЦИИ одного персонажа в разных позах!
```

Техника от Google:
1. **Reference image ПЕРВЫМ** в массиве contents
2. **"maintain identity"** — ключевая фраза
3. **Детальное описание** персонажа в промпте
4. **Multi-turn chat** — контекст сохраняется между запросами

```python
contents=[
    Part.from_bytes(data=reference_image, mime_type="image/jpeg"),  # ПЕРВЫМ!
    """Create variation of this exact character.
    Maintain identity: same face, hair, clothing.
    New pose: standing with arms crossed.
    Same style and lighting."""
]
```

### 1.4 Как они делают 5 вариаций
1. Получают референс
2. Анализируют через Vision (детали персонажа, стиль, объекты)
3. Генерируют **5 разных промптов** с вариациями поз/ракурсов
4. Запускают **параллельно** генерацию
5. Показывают сетку результатов

---

## 2. Что не так у нас (BannerGen)

### 2.1 Чат не живой
**Проблема:** Каждый запрос — новый, AI не помнит контекст
```javascript
// Сейчас: каждый раз новый запрос к API
const response = await aiModel.generateContent(contentParts);
```

**Нужно:** Chat session с сохранением истории
```javascript
// Как надо: chat сессия
const chat = aiModel.startChat();
const response = await chat.sendMessage(contentParts);
// Следующий запрос помнит контекст!
```

### 2.2 Ответы на вопросы не влияют на генерацию
**Проблема:** `promptAnalysis.enhanced_prompt` не включает ответы пользователя нормально

**Лог проблемы:**
1. Пользователь пишет "баннер для казино"
2. Показываем вопросы
3. Пользователь выбирает "Amazon Casino, Identity Lock, Испанский"
4. Генерация идёт по ОРИГИНАЛЬНОМУ промпту, игнорируя выбор!

### 2.3 Неправильный выбор модели
**Проблема:** Выбирается `nano-banana` вместо `nano-banana-pro`

**Где баг:** В `router.service.js` логика выбора модели не учитывает:
- Наличие референса → нужен Pro
- Текст на изображении → нужен Pro
- Сложная композиция → нужен Pro

### 2.4 Референс не работает как Identity Lock
**Проблема:** Генерируется НОВАЯ картинка, а не вариация существующей

**Причина:**
- Референс передаётся, но без правильных инструкций
- Нет "maintain identity" паттерна
- Нет chat session для сохранения контекста

---

## 3. План исправления

### 3.1 Шаг 1: Multi-turn Chat Session
```javascript
// google.service.js

// Хранилище chat сессий по chatId
const chatSessions = new Map();

async function getOrCreateChatSession(chatId, modelName) {
  if (chatSessions.has(chatId)) {
    return chatSessions.get(chatId);
  }

  const aiModel = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: { responseModalities: ['image', 'text'] }
  });

  const chat = aiModel.startChat();
  chatSessions.set(chatId, chat);
  return chat;
}

async function generateWithContext(chatId, contentParts, options) {
  const chat = await getOrCreateChatSession(chatId, options.model);
  const response = await chat.sendMessage(contentParts);
  return response;
}
```

### 3.2 Шаг 2: Правильная обработка ответов на вопросы
```javascript
// prompt.service.js

export async function processUserAnswers(originalPrompt, answers, options = {}) {
  // Формируем ПОЛНЫЙ контекст из ответов
  const context = {
    appName: answers.app_name,
    referenceUsage: answers.reference_usage,
    language: answers.language || answers.geo,
    style: answers.style_preference,
    variations: parseInt(answers.variations_count?.match(/\d+/)?.[0] || 1)
  };

  // Строим промпт с учётом ВСЕХ ответов
  let finalPrompt = originalPrompt;

  if (context.appName) {
    finalPrompt = finalPrompt.replace(/казино|casino/gi, context.appName);
  }

  if (context.language === 'Испанский') {
    finalPrompt += '\nGenerate text in Spanish.';
  }

  if (context.referenceUsage === 'Как референс (Identity Lock)') {
    finalPrompt = `IDENTITY LOCK: ${finalPrompt}`;
  }

  return {
    enhanced_prompt: finalPrompt,
    context,
    variations_count: context.variations
  };
}
```

### 3.3 Шаг 3: Исправить выбор модели
```javascript
// router.service.js

export function selectModel(promptAnalysis, options = {}) {
  const { hasReference, userPreference } = options;

  // Если пользователь выбрал — используем его выбор
  if (userPreference && userPreference !== 'auto') {
    return userPreference;
  }

  // ВСЕГДА Pro если:
  // 1. Есть референс (Identity Lock нужен Pro)
  // 2. Есть текст (Pro лучше рендерит текст)
  // 3. Сложная композиция
  if (hasReference) {
    return 'google-nano-pro';  // Identity Lock требует Pro!
  }

  if (promptAnalysis.needs_text && promptAnalysis.text_content?.length > 10) {
    return 'google-nano-pro';  // Длинный текст → Pro
  }

  if (promptAnalysis.complexity === 'complex' || promptAnalysis.complexity === 'composite') {
    return 'google-nano-pro';
  }

  // Простые задачи — обычный nano (быстрее, дешевле)
  return 'google-nano';
}
```

### 3.4 Шаг 4: Identity Lock промпт
```javascript
// google.service.js

function buildIdentityLockPrompt(originalPrompt, visionAnalysis) {
  return `=== IDENTITY LOCK MODE ===

## REFERENCE ANALYSIS:
${visionAnalysis.character_description || 'No character detected'}
Clothing: ${visionAnalysis.character_clothing || 'N/A'}
Pose: ${visionAnalysis.character_pose || 'N/A'}
Background: ${visionAnalysis.background_description || 'N/A'}
Style: ${visionAnalysis.style || 'N/A'}

## INSTRUCTIONS:
Generate a NEW VARIATION with THIS EXACT CHARACTER.
- Maintain identity: same face, hair color, skin tone, body type
- Maintain clothing style and colors
- Maintain overall visual aesthetic
- Change: pose, angle, minor composition

## USER REQUEST:
${originalPrompt}

## OUTPUT:
Create a variation that looks like it's from the SAME advertising campaign.
The character must be INSTANTLY recognizable as the same person.`;
}
```

### 3.5 Шаг 5: Параллельные вариации
```javascript
// google.service.js

async function generateVariations(prompt, referenceImage, count = 5) {
  const variations = [
    { pose: 'facing camera, confident stance', angle: 'front view' },
    { pose: 'slight turn to left, hand gesture', angle: '3/4 view' },
    { pose: 'looking at phone/object', angle: 'side profile' },
    { pose: 'dynamic action pose', angle: 'low angle' },
    { pose: 'relaxed, casual stance', angle: 'eye level' }
  ];

  const promises = variations.slice(0, count).map(async (v, i) => {
    const varPrompt = `${prompt}\nVariation ${i+1}: ${v.pose}, ${v.angle}`;
    return generateSingleImage(varPrompt, referenceImage);
  });

  const results = await Promise.all(promises);
  return results.filter(r => r !== null);
}
```

---

## 4. Структура правильного потока

```
ПОЛЬЗОВАТЕЛЬ                    СИСТЕМА
    |                              |
    |-- Загружает референс ------->|
    |                              |-- Vision анализ (детали персонажа)
    |                              |
    |-- Пишет "баннер для казино"->|
    |                              |-- Создаёт chat session
    |                              |-- Анализирует контекст
    |                              |
    |<-- Уточняющие вопросы ------|
    |    (название, язык, стиль)   |
    |                              |
    |-- Отвечает на вопросы ------>|
    |                              |-- Объединяет: промпт + ответы + vision
    |                              |-- Выбирает модель (Pro для Identity Lock)
    |                              |-- Строит Identity Lock промпт
    |                              |-- Генерирует 5 вариаций параллельно
    |                              |
    |<-- 5 картинок в сетке ------|
    |                              |
    |-- "Измени текст на испанский"|
    |                              |-- chat.sendMessage (КОНТЕКСТ СОХРАНЁН!)
    |                              |-- Редактирует с сохранением identity
    |                              |
    |<-- Обновлённые картинки ----|
```

---

## 5. Приоритет задач

1. **[CRITICAL]** Multi-turn chat session — без этого ничего не работает
2. **[HIGH]** Правильная обработка ответов на вопросы
3. **[HIGH]** Identity Lock промпт с vision анализом
4. **[MEDIUM]** Исправить выбор модели (Pro для референсов)
5. **[MEDIUM]** Параллельные вариации (5 штук)
6. **[LOW]** UI для выбора из сетки вариаций

---

## 6. Источники

- [Google Developers Blog - Gemini 2.5 Flash Image](https://developers.googleblog.com/introducing-gemini-2-5-flash-image/)
- [Google Cloud Tutorial - Gemini Image Generation](https://github.com/GoogleCloudPlatform/generative-ai/blob/main/gemini/getting-started/intro_gemini_2_5_image_gen.ipynb)
- [Gemini API Docs - Image Generation](https://ai.google.dev/gemini-api/docs/image-generation)
- [gemimg Python library](https://github.com/minimaxir/gemimg)
- [Genspark AI Review](https://cybernews.com/ai-tools/genspark-ai-review/)
- [Nano Banana Pro Guide](https://www.datacamp.com/tutorial/nano-banana-pro)
