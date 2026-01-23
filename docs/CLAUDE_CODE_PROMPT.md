# Задача для Claude Code: Исправить генерацию с референсами

## Контекст

BannerGen — сервис генерации рекламных баннеров. Используем Google Vertex AI Imagen 3. Проблема: при загрузке референса результат не сохраняет ключевые элементы (персонажей, стиль, объекты). Конкурент Genspark делает это хорошо — берёт любой баннер и создаёт вариации с теми же персонажами/стилем.

---

## Проблема #1: Неправильный referenceType в Google API

### Файл: `backend/src/services/google.service.js`

### Текущий код (строки 182-204):
```javascript
requestBody = {
  instances: [{
    prompt: finalPrompt,
    referenceImages: [{
      referenceType: 'REFERENCE_TYPE_SUBJECT',
      referenceId: 1,
      referenceImage: {
        bytesBase64Encoded: referenceBase64
      },
      subjectImageConfig: {
        subjectType: 'SUBJECT_TYPE_PERSON',  // ❌ ПРОБЛЕМА: Работает ТОЛЬКО для людей!
        subjectDescription: subjectDescription
      }
    }]
  }],
  ...
}
```

### Почему это плохо:
- `SUBJECT_TYPE_PERSON` ищет человека на картинке
- Если на референсе рыба, слот-машина, вертолёт — API не находит "субъект"
- Результат: генерируется что-то абстрактно похожее, а не вариация

### Как должно быть:
Использовать `REFERENCE_TYPE_STYLE` для сохранения всего визуального стиля:

```javascript
requestBody = {
  instances: [{
    prompt: finalPrompt,
    referenceImages: [{
      referenceType: 'REFERENCE_TYPE_STYLE',
      referenceId: 1,
      referenceImage: {
        bytesBase64Encoded: referenceBase64
      },
      styleImageConfig: {
        styleDescription: styleDescription  // Описание что сохранить
      }
    }]
  }],
  ...
}
```

### Задача:
Переписать функцию `generateSingleImage` (строки 116-285) чтобы:
1. Всегда использовать `REFERENCE_TYPE_STYLE` когда есть референс
2. Формировать `styleDescription` из visionAnalysis (стиль, цвета, освещение, ключевые объекты)
3. Добавлять детали персонажа/объектов в промпт из visionAnalysis.recreation_prompt

---

## Проблема #2: Vision анализ не генерирует recreation_prompt достаточно детально

### Файл: `backend/src/services/prompt.service.js`

### Текущий промпт для Vision (строки 343-383):
Промпт просит описать картинку, но `recreation_prompt` часто получается слабым.

### Задача:
Улучшить промпт для Vision анализа. Добавить явную инструкцию:

```javascript
// В промпте для analyzeReferenceImage добавить:

## CRITICAL OUTPUT - recreation_prompt:
Write a DETAILED English prompt to recreate this image's KEY VISUAL ELEMENTS.
This prompt will be used for AI image generation, so be VERY SPECIFIC:

Include:
- Main subjects/characters with EXACT visual description (colors, style, features)
- All key objects that MUST appear (slot machines, coins, helicopters, fish, etc.)
- Art style (3D render, cartoon, photorealistic, etc.)
- Color palette (list main colors)
- Lighting style (neon glow, sunset, dramatic shadows, etc.)
- Mood and atmosphere
- Any text/logos visible (describe but don't include copyrighted text)

Example good recreation_prompt:
"3D cartoon style red fish character with big googly eyes and orange fins, red rescue helicopter with spinning rotor, golden casino slot machine with cherry symbols, sunset sky with pink and purple clouds, neon glow effects, vibrant saturated colors, Ice Fishing game aesthetic, mobile game promotional banner style"

Example BAD recreation_prompt:
"casino banner with fish" (too vague!)
```

---

## Проблема #3: visionAnalysis может теряться между запросами

### Поток данных:
1. Пользователь загружает референс → `/api/generate/upload` → Vision анализ
2. Vision анализ сохраняется в `attachedReference.visionAnalysis` на фронтенде
3. При отправке запроса фронтенд передаёт только `reference_url`, не `vision_analysis`
4. Бэкенд должен достать visionAnalysis из clarification сообщения в БД

### Файл: `backend/src/routes/generate.routes.js`

### Проверить что работает (строки 140-180):
```javascript
// Ищем последний visionAnalysis из clarification сообщений
for (const msg of [...chatHistory].reverse()) {
  if (msg.metadata) {
    try {
      const meta = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;
      if (meta.vision_analysis) {
        inheritedVisionAnalysis = meta.vision_analysis;
        break;
      }
    } catch (e) { /* ignore parse errors */ }
  }
}
```

### Задача:
1. Добавить логи чтобы видеть передаётся ли visionAnalysis
2. Если не передаётся — добавить явную передачу через API параметр

---

## Проблема #4: styleDescription формируется неправильно

### Текущий код в google.service.js (строки 136-151):
```javascript
let subjectDescription = 'person from reference image';
if (visionAnalysis) {
  const descParts = [];
  if (visionAnalysis.character_description) {
    descParts.push(visionAnalysis.character_description);
  }
  // ...
}
```

### Проблема:
- Дефолт "person from reference image" — плохо для не-людей
- Собирается только character_description, а нужен весь стиль

### Задача:
Формировать styleDescription так:

```javascript
function buildStyleDescription(visionAnalysis) {
  if (!visionAnalysis) {
    return 'vibrant advertising banner style, professional quality';
  }

  const parts = [];

  // Стиль рендера
  if (visionAnalysis.style) {
    parts.push(visionAnalysis.style);
  }

  // Цветовая палитра
  if (visionAnalysis.colors?.length > 0) {
    parts.push(`color palette: ${visionAnalysis.colors.join(', ')}`);
  }

  // Освещение
  if (visionAnalysis.lighting) {
    parts.push(visionAnalysis.lighting);
  }

  // Фон
  if (visionAnalysis.background_description) {
    parts.push(`background: ${visionAnalysis.background_description}`);
  }

  // Ключевые объекты
  if (visionAnalysis.objects?.length > 0) {
    parts.push(`key elements: ${visionAnalysis.objects.join(', ')}`);
  }

  // Тип контента
  if (visionAnalysis.content_type) {
    parts.push(`${visionAnalysis.content_type} style`);
  }

  return parts.join('. ') || 'vibrant advertising banner style';
}
```

---

## Полный план изменений

### 1. google.service.js — ОСНОВНОЕ ИСПРАВЛЕНИЕ

Заменить функцию `generateSingleImage` (строки 116-285):

```javascript
async function generateSingleImage(prompt, options, index, onProgress) {
  const { aspectRatio, referenceBase64, visionAnalysis, accessToken, projectId } = options;

  try {
    if (onProgress) {
      onProgress({ index, status: 'generating', message: `Генерирую вариант ${index + 1}...` });
    }

    const model = IMAGEN_MODEL_CUSTOMIZE;  // imagen-3.0-capability-001
    const url = `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${VERTEX_LOCATION}/publishers/google/models/${model}:predict`;

    let requestBody;

    if (referenceBase64) {
      // НОВОЕ: Используем REFERENCE_TYPE_STYLE для сохранения стиля
      
      // Формируем описание стиля
      const styleDescription = buildStyleDescription(visionAnalysis);
      
      // Формируем промпт
      let finalPrompt = prompt;
      
      // Добавляем recreation_prompt если есть
      if (visionAnalysis?.recreation_prompt) {
        finalPrompt = `${visionAnalysis.recreation_prompt}. ${finalPrompt}`;
      }
      
      // Добавляем описание персонажа если есть
      if (visionAnalysis?.has_character && visionAnalysis?.character_description) {
        if (!finalPrompt.toLowerCase().includes(visionAnalysis.character_description.toLowerCase().substring(0, 20))) {
          finalPrompt = `${visionAnalysis.character_description}. ${finalPrompt}`;
        }
      }
      
      finalPrompt += '. High quality, professional advertising, sharp details.';

      log.info('Style customization request', {
        styleDescriptionLength: styleDescription.length,
        promptLength: finalPrompt.length,
        hasVisionAnalysis: !!visionAnalysis,
        contentType: visionAnalysis?.content_type,
        referenceType: 'REFERENCE_TYPE_STYLE'
      });

      requestBody = {
        instances: [{
          prompt: finalPrompt,
          referenceImages: [{
            referenceType: 'REFERENCE_TYPE_STYLE',
            referenceId: 1,
            referenceImage: {
              bytesBase64Encoded: referenceBase64
            },
            styleImageConfig: {
              styleDescription: styleDescription
            }
          }]
        }],
        parameters: {
          aspectRatio,
          sampleCount: 1,
          personGeneration: 'ALLOW_ALL',
          safetyFilterLevel: 'BLOCK_ONLY_HIGH',
          addWatermark: false
        }
      };

    } else {
      // Без референса — обычная генерация
      let finalPrompt = prompt;
      
      // Если есть visionAnalysis (от предыдущего референса) — используем recreation_prompt
      if (visionAnalysis?.recreation_prompt) {
        finalPrompt = `${visionAnalysis.recreation_prompt}. ${finalPrompt}`;
      }
      
      finalPrompt += '. High quality, professional, 4K.';

      requestBody = {
        instances: [{
          prompt: finalPrompt
        }],
        parameters: {
          aspectRatio,
          sampleCount: 1,
          personGeneration: 'ALLOW_ALL',
          safetyFilterLevel: 'BLOCK_ONLY_HIGH',
          addWatermark: false
        }
      };
    }

    log.info(`Image ${index + 1}: Calling Vertex AI`, {
      hasReference: !!referenceBase64,
      referenceType: referenceBase64 ? 'REFERENCE_TYPE_STYLE' : 'none',
      aspectRatio,
      promptPreview: requestBody.instances[0].prompt.substring(0, 200)
    });

    // ... остальной код запроса без изменений ...
  }
}

// Вспомогательная функция
function buildStyleDescription(visionAnalysis) {
  if (!visionAnalysis) {
    return 'vibrant advertising banner style, professional quality, bold colors';
  }

  const parts = [];

  if (visionAnalysis.style) {
    parts.push(visionAnalysis.style);
  }

  if (visionAnalysis.colors?.length > 0) {
    parts.push(`color palette: ${visionAnalysis.colors.join(', ')}`);
  }

  if (visionAnalysis.lighting) {
    parts.push(visionAnalysis.lighting);
  }

  if (visionAnalysis.background_description) {
    parts.push(`background style: ${visionAnalysis.background_description}`);
  }

  if (visionAnalysis.objects?.length > 0) {
    parts.push(`featuring: ${visionAnalysis.objects.join(', ')}`);
  }

  if (visionAnalysis.content_type) {
    parts.push(`${visionAnalysis.content_type} aesthetic`);
  }

  const result = parts.join('. ');
  return result || 'vibrant advertising banner style, professional quality';
}
```

### 2. prompt.service.js — УЛУЧШИТЬ VISION ПРОМПТ

В функции `analyzeReferenceImage` (строки 267-406) улучшить промпт. Добавить после строки 380:

```javascript
## CRITICAL - recreation_prompt field:
Write a DETAILED prompt (50-100 words) to recreate this image's visual style and key elements.
Be VERY SPECIFIC - this will be used for AI image generation:
- Describe main subjects with exact visual details (not "a fish" but "cartoon red fish with big eyes")
- List ALL important objects (slot machines, coins, helicopters, etc.)
- Specify exact style (3D render, cartoon, photorealistic)
- List main colors
- Describe lighting (neon, sunset, dramatic)
- Include mood/atmosphere

BAD: "casino banner with bonus" (too vague)
GOOD: "3D cartoon red fish character, red helicopter, golden slot machine, sunset sky, neon glow, vibrant colors, mobile game promo style"
```

### 3. generate.routes.js — ДОБАВИТЬ ЛОГИ

В функции `processGeneration` (строки 450-600) добавить логи для отладки:

```javascript
log.info('Generation context', {
  hasReferenceUrl: !!referenceUrl,
  hasVisionAnalysis: !!visionAnalysis,
  visionSource: inheritedVisionAnalysis ? 'inherited' : (visionAnalysis ? 'direct' : 'none'),
  contentType: visionAnalysis?.content_type,
  hasRecreationPrompt: !!visionAnalysis?.recreation_prompt,
  recreationPromptPreview: visionAnalysis?.recreation_prompt?.substring(0, 100)
});
```

---

## Как проверить что работает

1. Открой Railway logs
2. Загрузи казино баннер с персонажем (рыба, девушка, слот)
3. Напиши "сделай похожий баннер для Испании 160x600"
4. Ответь на вопросы (Identity Lock, 3 варианта)

### В логах должно быть:
```
referenceType: 'REFERENCE_TYPE_STYLE'
styleDescription: '3D cartoon style, color palette: red, blue, gold...'
recreationPromptPreview: '3D cartoon red fish character with big eyes...'
```

### Результат должен:
- Сохранять персонажей (та же рыба/девушка)
- Сохранять стиль (3D/cartoon/etc)
- Сохранять цветовую палитру
- Изменять композицию под новый размер
- Использовать новый текст (если указан)

---

## Файлы для изменения

1. `backend/src/services/google.service.js` — основное исправление (REFERENCE_TYPE_STYLE)
2. `backend/src/services/prompt.service.js` — улучшить Vision промпт
3. `backend/src/routes/generate.routes.js` — добавить логи для отладки

---

## Дополнительно: документация Google

- Style customization: https://cloud.google.com/vertex-ai/generative-ai/docs/image/style-customization
- Subject customization: https://cloud.google.com/vertex-ai/generative-ai/docs/image/subject-customization
- API reference: https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/imagen-api-customization

Ключевое из документации:
- `REFERENCE_TYPE_STYLE` — переносит визуальный стиль (цвета, освещение, атмосфера)
- `REFERENCE_TYPE_SUBJECT` — извлекает конкретный субъект (человек/продукт)
- Для рекламных баннеров с разными элементами лучше использовать STYLE

---

## Дополнительные проблемы (менее критичные)

### Проблема #5: Фронтенд не передаёт visionAnalysis явно

**Файл:** `frontend/src/hooks/useChat.js`

**Строки 265-276:**
```javascript
const response = await generateAPI.generate({
  chat_id: currentChat?.id,
  prompt: actualPrompt,
  reference_url: referenceUrl,  // URL передаётся
  // vision_analysis НЕ передаётся явно!
  size: settings.size,
  ...
});
```

**Проблема:** visionAnalysis сохраняется в `attachedReference.visionAnalysis` (строка 690), но не передаётся в API. Бэкенд должен доставать из БД, но это ненадёжно.

**Решение:** Добавить явную передачу:
```javascript
const response = await generateAPI.generate({
  chat_id: currentChat?.id,
  prompt: actualPrompt,
  reference_url: referenceUrl,
  vision_analysis: attachedReference?.visionAnalysis,  // ДОБАВИТЬ
  size: settings.size,
  ...
});
```

И на бэкенде в `generate.routes.js` принимать:
```javascript
const { vision_analysis: directVisionAnalysis } = req.body;
// Использовать directVisionAnalysis если есть, иначе из БД
```

---

### Проблема #6: Нет fallback если Vision анализ не сработал

Если Vision анализ вернул пустой результат или ошибку — код использует плохие дефолты.

**Решение:** Добавить fallback:
```javascript
if (!visionAnalysis || !visionAnalysis.style) {
  // Минимальный анализ по типу контента
  const prompt = originalPrompt.toLowerCase();
  if (prompt.includes('казино') || prompt.includes('casino') || prompt.includes('slot')) {
    visionAnalysis = {
      content_type: 'casino',
      style: '3D render, casino aesthetic',
      colors: ['gold', 'purple', 'red'],
      lighting: 'neon glow, dramatic'
    };
  }
}
```

---

### Проблема #7: Модель не учитывает текст из промпта

Когда пользователь пишет "текст 1500€ + 250 FS" — это часто теряется.

**Текущий код** в google.service.js строки 318-323:
```javascript
if (textContent) {
  finalPrompt = `${finalPrompt}
IMPORTANT: Include this exact text prominently: "${textContent}"
Text style: ${textStyle || 'bold, high contrast, professional'}`;
}
```

**Проблема:** `textContent` часто null потому что extractTextContent не нашёл текст в кавычках.

**Решение:** В prompt.service.js функция `extractTextContent` (строки 1107-1146) — добавить паттерн для бонусов:
```javascript
// Паттерн для бонусов (часто без кавычек)
const bonusPattern = prompt.match(/(\d+[€$₽%]\s*\+?\s*\d*\s*(?:FS|фриспин|spin|бонус)?)/i);
if (bonusPattern) return bonusPattern[0].trim();
```

---

## Порядок исправления

1. **СНАЧАЛА:** google.service.js — REFERENCE_TYPE_STYLE (это главное)
2. **ПОТОМ:** prompt.service.js — улучшить Vision промпт
3. **ПОТОМ:** generate.routes.js — добавить логи
4. **ОПЦИОНАЛЬНО:** фронтенд — явная передача visionAnalysis
5. **ОПЦИОНАЛЬНО:** fallback для пустого Vision

После каждого шага — тестировать!

---

## Тестовый сценарий

```
1. Загрузить: казино баннер Ice Fishing (рыба + вертолёт)
2. Написать: "сделай креатив для арбитража под краш игру ICE FIСHING для ГЕО Испании, на крео должен быть прописанный бонус 1500 евро и 250 бесплатных вращений. Можешь сделать похожий крео который тебе пришлю но размер нужно изменить на 160x600"
3. Ответить на вопросы: Identity Lock, 3 варианта
4. Проверить результат:
   - Есть рыба? ✓/✗
   - Есть вертолёт? ✓/✗
   - Стиль похож? ✓/✗
   - Размер 160x600? ✓/✗
   - Текст на испанском? ✓/✗
```
