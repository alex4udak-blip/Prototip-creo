# 🔴 BannerGen — Критические Проблемы и Исправления

## Проблемы найдены

---

## ПРОБЛЕМА 1: Обе модели Google используют одну и ту же модель!

### Где: `google.service.js` строки 28-34

```javascript
// ТЕКУЩИЙ КОД — НЕПРАВИЛЬНО!
const GOOGLE_MODELS = {
  'google-nano': 'gemini-2.5-flash-image',
  'google-nano-pro': 'gemini-2.5-flash-image',  // ❌ ТА ЖЕ МОДЕЛЬ!
};
```

### Исправление:
```javascript
const GOOGLE_MODELS = {
  'google-nano': 'gemini-2.5-flash-image',
  'google-nano-pro': 'gemini-3-pro-image-preview',  // ✅ ПРАВИЛЬНАЯ МОДЕЛЬ
};
```

**Результат:** Пользователь видит "Nano Banana Pro", но по факту работает обычный Nano Banana.

---

## ПРОБЛЕМА 2: Контекст диалога ТЕРЯЕТСЯ при обработке ответов

### Где: `prompt.service.js` функция `processUserAnswers` (строки 783-826)

### Что происходит:
1. Пользователь пишет: "Баннер для Испании, бонус 1500€" + [референс]
2. Claude анализирует референс через Vision → видит курьера, стиль, текст
3. Выдаёт вопросы
4. Пользователь отвечает: "Amazon Casino, Как референс (Identity Lock), Deposita 1500€"
5. **❌ ПРОБЛЕМА:** При генерации Vision анализ ТЕРЯЕТСЯ!

### Текущий код:
```javascript
export async function processUserAnswers(originalPrompt, answers, options = {}) {
  const { hasReference = false, deepThinking = false } = options;  // ❌ НЕТ visionAnalysis!
  
  let enrichedPrompt = originalPrompt;
  
  // Добавляет ответы как текст
  for (const [questionId, answer] of Object.entries(answers)) {
    answerDescriptions.push(`${questionId}: ${answer}`);
  }
  
  enrichedPrompt += `\n\nUser specifications:\n${answerDescriptions.join('\n')}`;
  
  // ❌ visionAnalysis НЕ передаётся дальше!
  result = await analyzeAndEnhancePrompt(enrichedPrompt, { hasReference, ...options });
}
```

### Исправление:
```javascript
export async function processUserAnswers(originalPrompt, answers, options = {}) {
  const { 
    hasReference = false, 
    deepThinking = false,
    visionAnalysis = null,  // ✅ ДОБАВИТЬ
    referenceUrl = null     // ✅ ДОБАВИТЬ
  } = options;
  
  // ✅ НОВОЕ: Если есть Vision анализ — используем его!
  let referenceContext = '';
  if (visionAnalysis) {
    referenceContext = `
REFERENCE IMAGE ANALYSIS:
- Content: ${visionAnalysis.content_type}
- Style: ${visionAnalysis.style}
- Text found: ${visionAnalysis.text_found?.join(', ') || 'none'}
- Colors: ${visionAnalysis.colors?.join(', ') || 'unknown'}
- Visual elements: ${visionAnalysis.visual_elements?.join(', ') || 'none'}
- Summary: ${visionAnalysis.summary}
`;
  }
  
  // ✅ НОВОЕ: Интерпретируем ответы пользователя правильно
  let referenceUsage = 'style'; // по умолчанию
  if (answers.reference_usage) {
    if (answers.reference_usage.includes('Identity Lock') || answers.reference_usage.includes('референс')) {
      referenceUsage = 'identity_lock';
    } else if (answers.reference_usage.includes('Редактировать')) {
      referenceUsage = 'edit';
    }
  }
  
  let enrichedPrompt = originalPrompt;
  
  // ✅ Добавляем контекст референса
  if (referenceContext) {
    enrichedPrompt += `\n\n${referenceContext}`;
  }
  
  // ✅ Добавляем ответы пользователя СТРУКТУРИРОВАННО
  const structuredAnswers = {
    app_name: answers.app_name,
    reference_usage: referenceUsage,
    style: answers.style,
    text_content: answers.text_content || answers.offer,
    geo: answers.geo,
    variations_count: answers.variations_count
  };
  
  enrichedPrompt += `\n\nUser specifications:\n${JSON.stringify(structuredAnswers, null, 2)}`;
  
  // Передаём всё в анализатор
  result = await analyzeAndEnhancePrompt(enrichedPrompt, { 
    hasReference, 
    visionAnalysis,       // ✅ Передаём Vision
    referenceUsage,       // ✅ Передаём как использовать референс
    ...options 
  });
  
  // ✅ Принудительно устанавливаем модель для Identity Lock
  if (referenceUsage === 'identity_lock') {
    result.suggested_model = 'google-nano-pro';
    result.needs_character_consistency = true;
  }
  
  return result;
}
```

---

## ПРОБЛЕМА 3: Vision анализ НЕ сохраняется и НЕ передаётся при ответе на вопросы

### Где: `generate.routes.js` строки 458-464

### Текущий код:
```javascript
if (answers && Object.keys(answers).length > 0) {
  promptAnalysis = await processUserAnswers(prompt, answers, {
    hasReference: !!referenceUrl,
    chatHistory,
    size
    // ❌ НЕТ visionAnalysis!
  });
}
```

### Проблема:
1. Vision анализ делается при clarification
2. Сохраняется в `clarification.vision_analysis`
3. Но при генерации с ответами — НЕ ИСПОЛЬЗУЕТСЯ!

### Исправление в `generate.routes.js`:

```javascript
// ✅ Нужно получить Vision анализ из предыдущего сообщения clarification
let visionAnalysis = null;
if (chatId) {
  const clarificationMsg = await db.getOne(
    `SELECT metadata FROM messages 
     WHERE chat_id = $1 AND role = 'assistant' 
     AND metadata::text LIKE '%clarification%'
     ORDER BY created_at DESC LIMIT 1`,
    [chatId]
  );
  if (clarificationMsg?.metadata) {
    const meta = JSON.parse(clarificationMsg.metadata);
    visionAnalysis = meta.vision_analysis;
  }
}

if (answers && Object.keys(answers).length > 0) {
  promptAnalysis = await processUserAnswers(prompt, answers, {
    hasReference: !!referenceUrl,
    referenceUrl,           // ✅ ДОБАВИТЬ
    visionAnalysis,         // ✅ ДОБАВИТЬ
    chatHistory,
    size
  });
}
```

---

## ПРОБЛЕМА 4: Промпт для генерации НЕ включает контекст диалога

### Где: `prompt.service.js` функция `analyzeAndEnhancePrompt`

### Что происходит:
После ответов на вопросы в Claude отправляется:
```
User request: Баннер для Испании, бонус 1500€...

User specifications:
app_name: Amazon Casino
reference_usage: Как референс (Identity Lock)
...
```

**❌ НЕТ:**
- Описания что было на референсе (Vision анализ)
- Понимания что нужно сохранить персонажа
- Контекста предыдущих сообщений

### Исправление в `GENERATION_SYSTEM_PROMPT`:

```javascript
export const GENERATION_SYSTEM_PROMPT = `You are a Creative Director AI that creates detailed prompts for image generation.

## CRITICAL: REFERENCE IMAGE HANDLING

When user provides a reference image with "Identity Lock" or "Как референс":
1. You MUST preserve the CHARACTER from reference (same person, face, clothing)
2. You MUST preserve the VISUAL STYLE (lighting, color grading, 3D quality)  
3. You MUST preserve BRAND ELEMENTS (logos, UI, gift boxes)
4. You MUST adapt only what user specified (text, language, minor adjustments)

The enhanced_prompt MUST include Identity Lock instructions when reference is provided.

## PROMPT STRUCTURE FOR IDENTITY LOCK:

When reference + identity lock:
\`\`\`
IDENTITY LOCK TASK: Create a variation of the reference image.

PRESERVE FROM REFERENCE:
- Same character/person (exact appearance, clothing, pose style)
- Same visual style (3D render, lighting, color grading)
- Same brand elements and composition approach

CHANGES REQUESTED:
- [User's specifications from answers]
- Text: "[new text]"
- Language: [target language]

Generate an image that looks like it's from the SAME AD CAMPAIGN as the reference.
\`\`\`

...
`;
```

---

## ПРОБЛЕМА 5: Genspark понимает референс как ОСНОВУ для вариаций

### Что делает Genspark:
1. Пользователь загружает референс
2. Genspark распознаёт: "Вижу казино-креатив с игрой 'выбери коробку', текст BONO 1500€"
3. Предлагает: "Сделать 3-5 вариаций?"
4. При генерации: СОХРАНЯЕТ персонажа, стиль, композицию → МЕНЯЕТ только текст/детали

### Что делает наша система:
1. Пользователь загружает референс
2. Claude распознаёт (Vision) → но это ТЕРЯЕТСЯ
3. Задаёт вопросы
4. При генерации: использует только текстовое описание → ТЕРЯЕТ контекст референса

### Решение: Архитектурное изменение

```
НОВЫЙ FLOW:

1. User uploads reference
   ↓
2. Vision Analysis → СОХРАНЯЕМ в chat state
   ↓
3. Clarification Questions (с контекстом Vision)
   ↓
4. User Answers
   ↓
5. Build Generation Context:
   - Original prompt
   - Vision analysis (ЧТО на референсе)
   - User answers (ЧТО менять)
   - Reference usage mode (Identity Lock / Edit / Style)
   ↓
6. Generate with FULL CONTEXT
```

---

## ПРОБЛЕМА 6: На фронтенде Vision анализ сохраняется, но не передаётся на бэкенд

### Где: `useChat.js` строки 686-692

```javascript
uploadReference: async (file) => {
  const result = await generateAPI.uploadReference(file);
  set({
    attachedReference: {
      url: result.url,
      filename: result.filename,
      visionAnalysis: result.vision_analysis  // ✅ Сохраняется!
    }
  });
}
```

### Но при генерации (строка 268):
```javascript
const response = await generateAPI.generate({
  reference_url: referenceUrl,  // ❌ Только URL, не visionAnalysis!
  ...
});
```

### Исправление:
```javascript
const response = await generateAPI.generate({
  reference_url: referenceUrl,
  vision_analysis: attachedReference?.visionAnalysis,  // ✅ ДОБАВИТЬ
  ...
});
```

---

## ИТОГОВЫЙ ЧЕКЛИСТ ИСПРАВЛЕНИЙ

### Backend:

1. **`google.service.js`**
   - [ ] Исправить `google-nano-pro` на `gemini-3-pro-image-preview`

2. **`prompt.service.js`**
   - [ ] `processUserAnswers` — добавить `visionAnalysis` в параметры
   - [ ] `processUserAnswers` — интерпретировать `reference_usage` ответ
   - [ ] `processUserAnswers` — принудительно ставить `google-nano-pro` для Identity Lock
   - [ ] `GENERATION_SYSTEM_PROMPT` — добавить инструкции для Identity Lock

3. **`generate.routes.js`**
   - [ ] Получать `visionAnalysis` из предыдущего clarification сообщения
   - [ ] Передавать `visionAnalysis` в `processUserAnswers`
   - [ ] Принимать `vision_analysis` из request body

### Frontend:

4. **`useChat.js`**
   - [ ] При генерации передавать `vision_analysis` на бэкенд
   - [ ] Сохранять `visionAnalysis` в `pendingClarification`

---

## Дополнительно: Как работает Genspark (для референса)

На скриншотах видно что Genspark:

1. **Анализирует референс:**
   - "Вижу на лендинге механику «выбери 3 коробки»"
   - "Текст: ¡Elige 3 cajas!, BONO 1500€"
   - "Формат 9:16"

2. **Задаёт умные вопросы:**
   - Что рекламируем? (название приложения)
   - Есть дисклеймеры?
   - ГЕО?
   - Стиль и ограничения бренда?
   - Форматы? (9:16, 1:1, 4:5, 16:9)

3. **Предлагает варианты:**
   - "Сделаю 3-5 разных концепций"
   - "Bono 1500€" + визуал «3 cajas» (акцент на интерактив/выбор)
   - "Solo hoy / Cupos limitados" + мягкий urgency
   - "Participa / Descubre tu premio" без намёков на гарантированные выигрыши

4. **Генерирует с Identity Lock:**
   - Сохраняет персонажа (курьера в синей поло)
   - Сохраняет стиль (3D, склад, золотые коробки)
   - Меняет только текст и незначительные детали

**Это то, что нам нужно реализовать!**

---

## Quick Fix: Минимальные изменения для работы

Если нужно быстро исправить основное:

### 1. `google.service.js` — правильная модель:
```javascript
const GOOGLE_MODELS = {
  'google-nano': 'gemini-2.5-flash-image',
  'google-nano-pro': 'gemini-3-pro-image-preview',  // ИСПРАВИТЬ
};
```

### 2. `generate.routes.js` — передавать Vision:
```javascript
// В processGeneration, перед вызовом processUserAnswers:

// Получаем Vision из clarification
let visionAnalysis = null;
if (answers && chatId) {
  const clarificationMsg = await db.getOne(
    `SELECT metadata FROM messages 
     WHERE chat_id = $1 AND role = 'assistant' 
     AND metadata IS NOT NULL
     ORDER BY created_at DESC LIMIT 1`,
    [chatId]
  );
  if (clarificationMsg?.metadata) {
    try {
      const meta = typeof clarificationMsg.metadata === 'string' 
        ? JSON.parse(clarificationMsg.metadata) 
        : clarificationMsg.metadata;
      visionAnalysis = meta.vision_analysis;
    } catch (e) {}
  }
}

// Передаём в processUserAnswers
if (answers && Object.keys(answers).length > 0) {
  promptAnalysis = await processUserAnswers(prompt, answers, {
    hasReference: !!referenceUrl,
    referenceUrl,
    visionAnalysis,  // ДОБАВИТЬ
    chatHistory,
    size
  });
}
```

### 3. `prompt.service.js` — использовать Vision:
```javascript
export async function processUserAnswers(originalPrompt, answers, options = {}) {
  const { 
    hasReference = false, 
    visionAnalysis = null,  // ДОБАВИТЬ
    referenceUrl = null 
  } = options;
  
  let enrichedPrompt = originalPrompt;
  
  // ДОБАВИТЬ: контекст референса
  if (visionAnalysis) {
    enrichedPrompt += `\n\nREFERENCE IMAGE CONTEXT:\n`;
    enrichedPrompt += `- Type: ${visionAnalysis.content_type || 'unknown'}\n`;
    enrichedPrompt += `- Style: ${visionAnalysis.style || 'unknown'}\n`;
    enrichedPrompt += `- Text on image: ${visionAnalysis.text_found?.join(', ') || 'none'}\n`;
    enrichedPrompt += `- Visual elements: ${visionAnalysis.visual_elements?.join(', ') || 'none'}\n`;
    enrichedPrompt += `- Colors: ${visionAnalysis.colors?.join(', ') || 'unknown'}\n`;
    enrichedPrompt += `- Summary: ${visionAnalysis.summary || ''}\n`;
  }
  
  // ... остальной код
  
  // ДОБАВИТЬ: определяем reference usage
  let referenceUsage = 'style';
  if (answers.reference_usage) {
    const usage = answers.reference_usage.toLowerCase();
    if (usage.includes('identity') || usage.includes('референс') || usage.includes('как референс')) {
      referenceUsage = 'identity_lock';
    } else if (usage.includes('редактировать') || usage.includes('edit')) {
      referenceUsage = 'edit';
    }
  }
  
  // ... analyzeAndEnhancePrompt call
  
  // ДОБАВИТЬ: принудительно для Identity Lock
  if (hasReference && referenceUsage === 'identity_lock') {
    result.suggested_model = 'google-nano-pro';
    result.needs_character_consistency = true;
    result.reference_purpose = 'identity_lock';
  }
  
  return result;
}
```

---

## ПРОБЛЕМА 7: Вопрос про вариации добавляется ТОЛЬКО при форсированном clarification!

### Где: `prompt.service.js` строки 500-560

### Что происходит:

Условие на строке 502:
```javascript
if (hasReference && visionAnalysis && !result.needs_clarification) {
  // ... здесь добавляется вопрос про вариации
  result.questions.push({
    id: 'variations_count',
    question: 'Сколько вариаций?',
    ...
  });
}
```

**Проблема:** Вопрос про вариации добавляется ТОЛЬКО когда:
1. Есть референс
2. Есть Vision анализ
3. Claude изначально сказал "вопросы не нужны" (`!result.needs_clarification`)

**Результат:** Если Claude САМ задал вопросы (needs_clarification = true), вопрос про вариации НЕ добавляется!

### Исправление:

```javascript
// ПОСЛЕ блока с форсированным clarification (после строки 560)
// Добавляем вопрос про вариации ВСЕГДА (если ещё нет)

// Проверяем что result.questions существует
if (!result.questions) {
  result.questions = [];
}

// Добавляем вопрос про вариации если его ещё нет
const hasVariationsQuestion = result.questions.some(q =>
  q.id?.includes('variation') || q.question?.toLowerCase().includes('вариац')
);

if (!hasVariationsQuestion && result.needs_clarification) {
  result.questions.push({
    id: 'variations_count',
    question: 'Сколько вариаций сделать?',
    type: 'single_choice',
    options: ['1 вариант', '3 варианта', '5 вариантов'],
    why: 'Как Genspark — больше выбора!'
  });
}
```

---

## ПРОБЛЕМА 8: settings.variations из UI не используется при ответе на clarification

### Где: `useChat.js` + `generate.routes.js`

### Что происходит:

1. В UI есть настройка `settings.variations` (по умолчанию = 1)
2. При генерации передаётся: `variations: settings.variations`
3. НО на бэкенде приоритет у `promptAnalysis.variations_count`:

```javascript
// generate.routes.js строка 495
const numImages = promptAnalysis.variations_count || variations || 1;
```

4. `promptAnalysis.variations_count` заполняется ТОЛЬКО из ответов на clarification вопрос
5. Если вопрос не задан или пропущен → `variations_count` = undefined → берётся `variations` из настроек
6. НО `variations` в настройках = 1 по умолчанию!

### Исправление: Несколько мест

**1. `useChat.js` — по умолчанию 3 варианта:**
```javascript
settings: {
  model: 'auto',
  size: '1200x628',
  variations: 3,  // ← Изменить с 1 на 3!
  mode: 'smart'
}
```

**2. `generate.routes.js` — логировать для отладки:**
```javascript
const numImages = promptAnalysis.variations_count || variations || 1;
log.info('Variations calculation', {
  fromAnswers: promptAnalysis.variations_count,
  fromSettings: variations,
  final: numImages
});
```

---

## Полный список проблем (обновлённый):

| # | Проблема | Где | Критичность |
|---|----------|-----|-------------|
| 1 | Обе Google модели = одна | google.service.js:33 | 🔴 HIGH |
| 2 | Vision анализ теряется при генерации | generate.routes.js | 🔴 HIGH |
| 3 | reference_usage ответ не влияет на модель | prompt.service.js | 🔴 HIGH |
| 4 | Нет Identity Lock инструкций в промпте | prompt.service.js | 🟡 MEDIUM |
| 5 | Vision не передаётся с фронтенда | useChat.js | 🟡 MEDIUM |
| 6 | Genspark понимает референс как базу | архитектура | 🟡 MEDIUM |
| 7 | Вопрос про вариации только при форсировании | prompt.service.js:502 | 🔴 HIGH |
| 8 | settings.variations = 1 по умолчанию | useChat.js:66 | 🟡 MEDIUM |

---

*Документ создан: 23.01.2026*
