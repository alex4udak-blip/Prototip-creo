# BannerGen — Готовые Патчи

Применять последовательно. Каждый патч — одна проблема.

---

## PATCH 1: Правильная модель Google Nano Pro

**Файл:** `backend/src/services/google.service.js`

**Найти (строки 28-34):**
```javascript
const GOOGLE_MODELS = {
  // Nano Banana - быстрый Gemini 2.5 Flash Image (актуальная модель)
  'google-nano': 'gemini-2.5-flash-image',
  // Nano Banana Pro - тоже Gemini 2.5 Flash Image (gemini-3-pro-image-preview может быть недоступен)
  // По документации gemini-2.5-flash-image - основная модель для image generation
  'google-nano-pro': 'gemini-2.5-flash-image',
};
```

**Заменить на:**
```javascript
const GOOGLE_MODELS = {
  // Nano Banana - быстрый Gemini 2.5 Flash Image
  'google-nano': 'gemini-2.5-flash-image',
  // Nano Banana Pro - Gemini 2.0 Flash Image для лучшего качества
  // Если gemini-3-pro-image-preview недоступен, используем 2.0 Flash
  'google-nano-pro': 'gemini-2.0-flash-exp-image-generation',
};
```

**Примечание:** Если `gemini-2.0-flash-exp-image-generation` тоже недоступен, попробуй `imagen-3.0-generate-002`

---

## PATCH 2: Вопрос про вариации ВСЕГДА

**Файл:** `backend/src/services/prompt.service.js`

**Найти (около строки 560-570):**
```javascript
    }

    log.debug('Smart clarification check', {
      needsClarification: result.needs_clarification,
      detectedContext: result.detected_context,
```

**Заменить на:**
```javascript
    }

    // PATCH 2: Добавляем вопрос про вариации ВСЕГДА когда есть вопросы
    if (result.needs_clarification && result.questions && result.questions.length > 0) {
      const hasVariationsQuestion = result.questions.some(q =>
        q.id?.includes('variation') || q.question?.toLowerCase().includes('вариац')
      );
      
      if (!hasVariationsQuestion) {
        result.questions.push({
          id: 'variations_count',
          question: 'Сколько вариаций?',
          type: 'single_choice',
          options: ['1 вариант', '3 варианта', '5 вариантов'],
          why: 'Больше вариантов = больше выбора'
        });
      }
    }

    log.debug('Smart clarification check', {
      needsClarification: result.needs_clarification,
      detectedContext: result.detected_context,
```

---

## PATCH 3: Дефолт 3 варианта вместо 1

**Файл:** `frontend/src/hooks/useChat.js`

**Найти (строка 66):**
```javascript
    variations: 1,
```

**Заменить на:**
```javascript
    variations: 3,
```

---

## PATCH 4: Передавать Vision анализ при генерации с ответами

**Файл:** `backend/src/routes/generate.routes.js`

**Найти в функции `processGeneration` (около строки 458-472):**
```javascript
    } else if (answers && Object.keys(answers).length > 0) {
      // Обработка ответов на вопросы
      promptAnalysis = await processUserAnswers(prompt, answers, {
        hasReference: !!referenceUrl,
        chatHistory,
        size
      });
    } else {
```

**Заменить на:**
```javascript
    } else if (answers && Object.keys(answers).length > 0) {
      // PATCH 4: Получаем Vision анализ из предыдущего clarification сообщения
      let visionAnalysis = null;
      if (chatId) {
        try {
          const clarificationMsg = await db.getOne(
            `SELECT metadata FROM messages 
             WHERE chat_id = $1 AND role = 'assistant' 
             AND metadata IS NOT NULL
             ORDER BY created_at DESC LIMIT 1`,
            [chatId]
          );
          if (clarificationMsg?.metadata) {
            const meta = typeof clarificationMsg.metadata === 'string' 
              ? JSON.parse(clarificationMsg.metadata) 
              : clarificationMsg.metadata;
            visionAnalysis = meta.vision_analysis;
            log.info('Retrieved Vision analysis from clarification', {
              hasVision: !!visionAnalysis,
              contentType: visionAnalysis?.content_type
            });
          }
        } catch (e) {
          log.warn('Failed to get Vision analysis', { error: e.message });
        }
      }
      
      // Обработка ответов на вопросы С Vision контекстом
      promptAnalysis = await processUserAnswers(prompt, answers, {
        hasReference: !!referenceUrl,
        referenceUrl,
        visionAnalysis,  // Передаём Vision!
        chatHistory,
        size
      });
    } else {
```

---

## PATCH 5: Использовать Vision и reference_usage в processUserAnswers

**Файл:** `backend/src/services/prompt.service.js`

**Найти функцию `processUserAnswers` (строки 783-826):**
```javascript
export async function processUserAnswers(originalPrompt, answers, options = {}) {
  const { hasReference = false, deepThinking = false } = options;

  // Извлекаем количество вариаций из ответов
  let variationsCount = 1;
  if (answers.variations_count) {
    const match = answers.variations_count.match(/(\d+)/);
    if (match) {
      variationsCount = Math.min(parseInt(match[1]), 5);
    }
  }

  // Формируем обогащённый промпт из ответов (без variations_count - это не для промпта)
  let enrichedPrompt = originalPrompt;

  const answerDescriptions = [];
  for (const [questionId, answer] of Object.entries(answers)) {
    if (answer && answer !== 'skip' && questionId !== 'variations_count') {
      // Форматируем ответ в зависимости от типа
      if (Array.isArray(answer)) {
        answerDescriptions.push(`${questionId}: ${answer.join(', ')}`);
      } else {
        answerDescriptions.push(`${questionId}: ${answer}`);
      }
    }
  }

  if (answerDescriptions.length > 0) {
    enrichedPrompt += `\n\nUser specifications:\n${answerDescriptions.join('\n')}`;
  }

  // Выбираем режим анализа
  let result;
  if (deepThinking) {
    result = await analyzeWithDeepThinking(enrichedPrompt, { hasReference, ...options });
  } else {
    result = await analyzeAndEnhancePrompt(enrichedPrompt, { hasReference, ...options });
  }

  // Добавляем количество вариаций в результат
  result.variations_count = variationsCount;

  return result;
}
```

**Заменить на:**
```javascript
export async function processUserAnswers(originalPrompt, answers, options = {}) {
  const { 
    hasReference = false, 
    deepThinking = false,
    visionAnalysis = null,  // PATCH 5: Vision анализ
    referenceUrl = null 
  } = options;

  // Извлекаем количество вариаций из ответов
  let variationsCount = 1;
  if (answers.variations_count) {
    const match = answers.variations_count.match(/(\d+)/);
    if (match) {
      variationsCount = Math.min(parseInt(match[1]), 5);
    }
  }

  // PATCH 5: Определяем как использовать референс
  let referenceUsage = 'style'; // по умолчанию
  if (answers.reference_usage) {
    const usage = answers.reference_usage.toLowerCase();
    if (usage.includes('identity') || usage.includes('референс') || usage.includes('как референс')) {
      referenceUsage = 'identity_lock';
    } else if (usage.includes('редактировать') || usage.includes('edit')) {
      referenceUsage = 'edit';
    }
  }

  log.info('Processing user answers', {
    hasReference,
    referenceUsage,
    hasVision: !!visionAnalysis,
    variationsCount,
    answersKeys: Object.keys(answers)
  });

  // Формируем обогащённый промпт
  let enrichedPrompt = originalPrompt;

  // PATCH 5: Добавляем Vision контекст если есть
  if (visionAnalysis) {
    enrichedPrompt += `\n\n## REFERENCE IMAGE ANALYSIS (from Vision):
- Content type: ${visionAnalysis.content_type || 'unknown'}
- Style: ${visionAnalysis.style || 'unknown'}
- Text found: ${visionAnalysis.text_found?.join(', ') || 'none'}
- Visual elements: ${visionAnalysis.visual_elements?.join(', ') || 'none'}
- Colors: ${visionAnalysis.colors?.join(', ') || 'unknown'}
- Summary: ${visionAnalysis.summary || 'no summary'}`;
  }

  // PATCH 5: Добавляем инструкцию по использованию референса
  if (hasReference && referenceUsage === 'identity_lock') {
    enrichedPrompt += `\n\n## CRITICAL - IDENTITY LOCK MODE:
The user wants to CREATE VARIATIONS of the reference image.
You MUST preserve:
1. Same character/person (exact appearance, clothing, pose style)
2. Same visual style (3D render, lighting, color grading)
3. Same brand elements (logos, gift boxes, UI elements)
4. Same composition approach

ONLY change what user specified (text, language, minor details).
The result must look like it's from the SAME AD CAMPAIGN.`;
  }

  // Добавляем ответы пользователя
  const answerDescriptions = [];
  for (const [questionId, answer] of Object.entries(answers)) {
    if (answer && answer !== 'skip' && questionId !== 'variations_count') {
      if (Array.isArray(answer)) {
        answerDescriptions.push(`${questionId}: ${answer.join(', ')}`);
      } else {
        answerDescriptions.push(`${questionId}: ${answer}`);
      }
    }
  }

  if (answerDescriptions.length > 0) {
    enrichedPrompt += `\n\n## User specifications:\n${answerDescriptions.join('\n')}`;
  }

  // Выбираем режим анализа
  let result;
  if (deepThinking) {
    result = await analyzeWithDeepThinking(enrichedPrompt, { hasReference, referenceUsage, ...options });
  } else {
    result = await analyzeAndEnhancePrompt(enrichedPrompt, { hasReference, referenceUsage, ...options });
  }

  // PATCH 5: Принудительно устанавливаем модель для Identity Lock
  if (hasReference && referenceUsage === 'identity_lock') {
    result.suggested_model = 'google-nano-pro';
    result.needs_character_consistency = true;
    result.reference_purpose = 'identity_lock';
    log.info('Forcing google-nano-pro for Identity Lock', { originalModel: result.suggested_model });
  } else if (hasReference && referenceUsage === 'edit') {
    result.suggested_model = 'kontext';
    result.reference_purpose = 'edit';
  }

  // Добавляем количество вариаций
  result.variations_count = variationsCount;

  return result;
}
```

---

## PATCH 6: Сохранять Vision в clarification metadata

**Файл:** `backend/src/routes/generate.routes.js`

**Найти (около строки 189-199):**
```javascript
        // Сохраняем вопросы как сообщение ассистента
        const assistantMessage = await db.insert('messages', {
          chat_id: chatId,
          role: 'assistant',
          content: clarificationResult.summary || 'Уточняющие вопросы',
          metadata: JSON.stringify({
            type: 'clarification',
            questions: clarificationResult.questions,
            originalPrompt: prompt,
            detectedContext: clarificationResult.detected_context,
            thinking: clarificationResult.thinking
          })
        });
```

**Заменить на:**
```javascript
        // Сохраняем вопросы как сообщение ассистента С Vision анализом
        const assistantMessage = await db.insert('messages', {
          chat_id: chatId,
          role: 'assistant',
          content: clarificationResult.summary || 'Уточняющие вопросы',
          metadata: JSON.stringify({
            type: 'clarification',
            questions: clarificationResult.questions,
            originalPrompt: prompt,
            detectedContext: clarificationResult.detected_context,
            thinking: clarificationResult.thinking,
            vision_analysis: clarificationResult.vision_analysis  // PATCH 6: Сохраняем Vision!
          })
        });
```

---

## Порядок применения патчей:

1. **PATCH 1** — Правильная модель (google.service.js)
2. **PATCH 6** — Сохранять Vision в metadata (generate.routes.js)
3. **PATCH 4** — Передавать Vision при генерации (generate.routes.js)
4. **PATCH 5** — Использовать Vision в processUserAnswers (prompt.service.js)
5. **PATCH 2** — Вопрос про вариации ВСЕГДА (prompt.service.js)
6. **PATCH 3** — Дефолт 3 варианта (useChat.js)

---

## Быстрая проверка после патчей:

```bash
# 1. Перезапустить бэкенд
npm run dev

# 2. Тестовый сценарий:
# - Загрузить референс (казино баннер)
# - Написать "Сделай баннер для Испании"
# - Проверить что появились вопросы включая "Сколько вариаций?"
# - Выбрать "Как референс (Identity Lock)" и "5 вариантов"
# - Проверить что сгенерировалось 5 картинок
# - Проверить что персонаж сохранился
```

---

## Если модель Google не работает:

Проверь какие модели доступны:

```javascript
// Временно добавь в google.service.js для диагностики:
console.log('Available models:', await genAI.listModels());
```

Или используй fallback на Gemini 2.5:
```javascript
const GOOGLE_MODELS = {
  'google-nano': 'gemini-2.5-flash-preview-04-17',
  'google-nano-pro': 'gemini-2.5-pro-preview-05-06',
};
```

---

*Патчи готовы: 23.01.2026*
