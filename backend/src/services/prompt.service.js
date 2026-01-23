import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/env.js';
import { log } from '../utils/logger.js';

// Инициализация клиента Claude
const anthropic = config.anthropicApiKey
  ? new Anthropic({ apiKey: config.anthropicApiKey })
  : null;

/**
 * Детектор контекста запроса
 * Определяет тип контента и ключевые аспекты
 */
export const REQUEST_CONTEXTS = {
  BANNER_AD: {
    keywords: ['баннер', 'banner', 'креатив', 'creative', 'реклам', 'ad', 'объявлен'],
    aspects: ['size', 'text', 'colors', 'platform', 'cta']
  },
  CASINO_GAMBLING: {
    keywords: ['казино', 'casino', 'слот', 'slot', 'бонус', 'bonus', 'ставк', 'bet', 'покер', 'poker', 'рулетка'],
    aspects: ['offer_type', 'bonus_details', 'game_theme', 'style', 'geo']
  },
  AFFILIATE: {
    keywords: ['арбитраж', 'affiliate', 'трафик', 'traffic', 'оффер', 'offer', 'конверс', 'лид', 'lead'],
    aspects: ['vertical', 'geo', 'audience', 'platform', 'angle']
  },
  SOCIAL_MEDIA: {
    keywords: ['инстаграм', 'instagram', 'сторис', 'stories', 'тикток', 'tiktok', 'пост', 'post', 'youtube'],
    aspects: ['platform', 'format', 'mood', 'hook']
  },
  PRODUCT: {
    keywords: ['продукт', 'product', 'товар', 'упаковка', 'package', 'фото товар'],
    aspects: ['product_type', 'background', 'angle', 'lighting']
  },
  CHARACTER: {
    keywords: ['персонаж', 'character', 'маскот', 'mascot', 'герой', 'аватар'],
    aspects: ['style', 'emotion', 'pose', 'age_gender']
  }
};

/**
 * УМНЫЙ системный промпт для Clarification Agent
 * Chat-style вопросы с UI-кнопками для выбора
 */
export const SMART_CLARIFICATION_PROMPT = `You are an expert Creative Director AI for advertising and visual content.

## YOUR TASK:
Analyze user request. If critical info is missing - ask 1-3 SHORT questions with clickable options.

## WHEN TO ASK (needs_clarification: true):
- **MANDATORY** when there's a reference image - you MUST ask about how to use it!
- Missing: brand/app name, bonus details, geo, style preference
- Unclear what exactly to create
- Casino/gambling content - ALWAYS ask about specifics

## WHEN NOT TO ASK (needs_clarification: false):
- ONLY if NO reference AND request has ALL details (brand, size, style, geo, text)
- User explicitly said "быстро", "сразу", "без вопросов" AND no reference
- Simple edit like "сделай ярче" AND no reference

## CRITICAL RULE FOR REFERENCE IMAGES:
If REFERENCE IMAGE is provided - you MUST ALWAYS:
1. Set needs_clarification: true (THIS IS MANDATORY!)
2. Acknowledge what you see on the reference (from vision_analysis)
3. Ask: "Как использовать референс?" with options: ["Как референс (Identity Lock)", "Вдохновение (стиль)", "Редактировать"]
4. Ask about style preference if not clear

NEVER return needs_clarification: false when there is a reference image!

## OUTPUT FORMAT (JSON):

{
  "needs_clarification": true,
  "detected_context": "CASINO_GAMBLING | AFFILIATE | BANNER_AD | SOCIAL_MEDIA | PRODUCT | GENERAL",
  "summary": "Короткое приветствие на русском (1-2 предложения)",
  "questions": [
    {
      "id": "unique_id",
      "question": "Короткий вопрос?",
      "type": "single_choice",
      "options": ["Вариант 1", "Вариант 2", "Вариант 3"],
      "why": "Зачем это нужно (опционально)"
    }
  ],
  "reference_analysis": "Что видно на референсе (если есть)",
  "known_info": { }
}

## RULES:
- summary: 1-2 предложения, дружелюбно, на русском
- questions: MAX 2-3 вопроса
- options: MAX 4-5 вариантов, КОРОТКИЕ (1-3 слова)
- type: "single_choice" или "text_input"

## GOOD OPTIONS (короткие!):
Casino: "Welcome бонус", "Free Spins", "Депозит", "No Deposit"
Style: "Неон", "Премиум", "3D", "Минимализм"
GEO: "СНГ", "Европа", "Латам", "Азия"
Format: "Stories", "Квадрат", "Баннер", "Все"

## EXAMPLE:

{
  "needs_clarification": true,
  "detected_context": "CASINO_GAMBLING",
  "summary": "Вижу казино-референс с бонусом! Уточню детали:",
  "reference_analysis": "Тёмный фон, золотые акценты, текст бонуса",
  "questions": [
    {
      "id": "app_name",
      "question": "Название приложения?",
      "type": "text_input"
    },
    {
      "id": "style",
      "question": "Стиль?",
      "type": "single_choice",
      "options": ["Как референс", "Премиум", "Неон", "Минимализм"]
    }
  ],
  "known_info": { "bonus": "1500€" }
}

RESPOND ONLY WITH VALID JSON.`;

/**
 * Системный промпт для Deep Thinking режима
 */
export const DEEP_THINKING_PROMPT = `You are a Senior Creative Director with deep expertise in advertising psychology, visual design, and conversion optimization.

## DEEP THINKING MODE ACTIVATED

When analyzing a request, you must:

1. **UNDERSTAND THE GOAL**
   - What is the ultimate business objective?
   - Who is the target audience?
   - What action should viewer take?

2. **ANALYZE PSYCHOLOGY**
   - What emotions should the image evoke?
   - What cognitive triggers work for this audience?
   - What objections need to be overcome?

3. **VISUAL STRATEGY**
   - Color psychology for this context
   - Composition that guides the eye
   - Text hierarchy and readability
   - Cultural considerations for target GEO

4. **TECHNICAL EXCELLENCE**
   - Optimal prompt structure for AI generation
   - Model selection rationale
   - Quality and detail requirements

## OUTPUT FORMAT:

{
  "deep_analysis": {
    "goal_understanding": "What user really wants to achieve",
    "target_audience": "Detailed audience profile",
    "psychological_hooks": ["hook1", "hook2"],
    "visual_strategy": "Detailed visual approach",
    "potential_issues": ["issue1", "issue2"],
    "recommendations": ["rec1", "rec2"]
  },
  "thinking_process": [
    "Step 1: ...",
    "Step 2: ...",
    "..."
  ],
  "enhanced_prompt": "Highly optimized prompt for image generation",
  "model_reasoning": "Why this specific model",
  "suggested_model": "model_name",
  "creative_type": "type",
  "complexity": "simple | medium | complex | composite",
  "needs_text": true/false,
  "text_content": "exact text or null",
  "text_style": "text styling description or null",
  "negative_prompt": "what to avoid",
  "style_keywords": ["keyword1", "keyword2"],
  "confidence_score": 0.0-1.0
}`;

/**
 * Детектирует тип контента из запроса
 */
function detectRequestContext(prompt) {
  const lowerPrompt = prompt.toLowerCase();
  const detected = [];

  for (const [contextName, context] of Object.entries(REQUEST_CONTEXTS)) {
    const matches = context.keywords.filter(kw => lowerPrompt.includes(kw.toLowerCase()));
    if (matches.length > 0) {
      detected.push({
        type: contextName,
        matches: matches.length,
        aspects: context.aspects
      });
    }
  }

  // Сортируем по количеству совпадений
  detected.sort((a, b) => b.matches - a.matches);

  return detected.length > 0 ? detected[0] : { type: 'GENERAL', aspects: ['style', 'colors', 'mood'] };
}

/**
 * Извлекает уже известную информацию из истории чата
 */
function extractKnownInfo(chatHistory) {
  const knownInfo = {
    size: null,
    colors: null,
    style: null,
    text: null,
    geo: null,
    platform: null,
    offer: null,
    audience: null
  };

  for (const msg of chatHistory) {
    const content = msg.content?.toLowerCase() || '';

    // Извлекаем размеры
    const sizeMatch = content.match(/(\d{2,4})\s*[xXхХ×]\s*(\d{2,4})/);
    if (sizeMatch) {
      knownInfo.size = `${sizeMatch[1]}x${sizeMatch[2]}`;
    }

    // Извлекаем цвета
    const colorPatterns = [
      /цвет[а-я]*[:\s]+([^,.]+)/i,
      /color[s]?[:\s]+([^,.]+)/i,
      /(красн|синий|зелен|желт|черн|бел|золот|фиолетов|оранжев|розов)/i
    ];
    for (const pattern of colorPatterns) {
      const match = content.match(pattern);
      if (match) knownInfo.colors = match[1] || match[0];
    }

    // Извлекаем текст
    const textMatch = content.match(/["«»'']([^"«»'']+)["«»'']/);
    if (textMatch) knownInfo.text = textMatch[1];

    // Извлекаем ГЕО
    const geoPatterns = ['россия', 'russia', 'ru', 'украина', 'ukraine', 'ua', 'казахстан', 'kz',
                        'беларусь', 'by', 'германия', 'germany', 'de', 'сша', 'usa', 'us',
                        'латам', 'latam', 'европа', 'europe', 'азия', 'asia'];
    for (const geo of geoPatterns) {
      if (content.includes(geo)) {
        knownInfo.geo = geo;
        break;
      }
    }
  }

  return knownInfo;
}

/**
 * Анализ референса через Claude Vision
 * Возвращает детальное описание того что на картинке
 */
export async function analyzeReferenceImage(referenceUrl) {
  if (!anthropic || !referenceUrl) {
    return null;
  }

  try {
    log.debug('Analyzing reference image with Vision', { url: referenceUrl?.substring(0, 50) });

    // Подготавливаем изображение для Claude Vision
    let imageContent;

    if (referenceUrl.startsWith('data:')) {
      // Уже base64
      const matches = referenceUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        imageContent = {
          type: 'image',
          source: {
            type: 'base64',
            media_type: matches[1],
            data: matches[2]
          }
        };
      }
    } else if (referenceUrl.startsWith('http')) {
      // URL - Claude может работать напрямую с URL
      imageContent = {
        type: 'image',
        source: {
          type: 'url',
          url: referenceUrl
        }
      };
    } else {
      // Локальный файл - нужно прочитать и конвертировать
      const fs = await import('fs');
      const path = await import('path');
      const { config } = await import('../config/env.js');

      let filePath = referenceUrl;
      if (referenceUrl.includes('/uploads/')) {
        const filename = referenceUrl.split('/uploads/').pop().split('?')[0];
        filePath = path.join(config.storagePath, filename);
      }

      if (fs.existsSync(filePath)) {
        const buffer = fs.readFileSync(filePath);
        const ext = path.extname(filePath).toLowerCase();
        const mimeType = ext === '.png' ? 'image/png' :
                        ext === '.webp' ? 'image/webp' : 'image/jpeg';

        imageContent = {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mimeType,
            data: buffer.toString('base64')
          }
        };
      }
    }

    if (!imageContent) {
      log.warn('Could not prepare image for Vision analysis');
      return null;
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: [
          imageContent,
          {
            type: 'text',
            text: `Analyze this reference image for advertising/banner creation with IDENTITY LOCK capability.

## CRITICAL: CHARACTER DESCRIPTION
If there's a person/character in the image, describe them in EXTREME DETAIL for recreation:
- Gender, approximate age, ethnicity
- Hair: color, style, length
- Face: expression, features
- Clothing: exact description (color, style, accessories)
- Pose: body position, hand gestures
- Accessories: glasses, jewelry, props they're holding

## OTHER ELEMENTS
- Background: exact description (warehouse, neon, casino floor, etc.)
- Objects: treasure chests, coins, cards, slot machines, etc.
- Brand elements: logos, UI elements, buttons
- Text: exact text visible
- Colors: primary palette
- Style: 3D render, photorealistic, cartoon, etc.
- Lighting: neon glow, dramatic, soft, etc.

## OUTPUT FORMAT (JSON):
{
  "content_type": "casino/game/product/social",
  "has_character": true/false,
  "character_description": "DETAILED description of the person/character for recreation - include ALL visual details",
  "character_pose": "standing/sitting/action pose description",
  "character_clothing": "exact clothing description",
  "character_accessories": "what they're holding or wearing",
  "background_description": "detailed background for recreation",
  "objects": ["object 1 with details", "object 2 with details"],
  "brand_elements": ["logo", "UI element"],
  "text_found": ["exact text 1", "exact text 2"],
  "colors": ["primary color", "secondary color", "accent"],
  "style": "3D render/photorealistic/cartoon/etc",
  "lighting": "neon glow/dramatic/soft/etc",
  "format": "9:16/1:1/16:9",
  "summary": "Brief Russian description for user",
  "recreation_prompt": "English prompt to recreate this image style with a different pose/angle"
}

Be VERY SPECIFIC about the character - this will be used to generate variations with the SAME character in different poses.`
          }
        ]
      }]
    });

    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0]);
      log.debug('Reference analysis complete', {
        contentType: analysis.content_type,
        style: analysis.style
      });
      return analysis;
    }

    return { summary: text };

  } catch (error) {
    log.error('Reference image analysis error', { error: error.message });
    return null;
  }
}

/**
 * УМНАЯ проверка нужны ли уточняющие вопросы
 * Учитывает контекст, историю и специфику запроса
 */
export async function checkNeedsClarification(userPrompt, options = {}) {
  const { hasReference = false, referenceUrl = null, chatHistory = [], deepThinking = false } = options;

  if (!anthropic) {
    log.warn('Claude API not configured, skipping clarification');
    return { needs_clarification: false, ready_to_generate: true };
  }

  try {
    // 1. Детектируем контекст запроса
    const detectedContext = detectRequestContext(userPrompt);

    // 2. Извлекаем уже известную информацию из истории
    const knownInfo = extractKnownInfo(chatHistory);

    // 3. VISION: Анализируем референс если есть
    let referenceAnalysis = null;
    if (hasReference && referenceUrl) {
      log.debug('Analyzing reference with Vision...', { url: referenceUrl?.substring(0, 50) });
      referenceAnalysis = await analyzeReferenceImage(referenceUrl);
      log.debug('Reference analysis result', { analysis: referenceAnalysis });
    }

    // 4. Формируем контекст для Claude
    let contextInfo = `
## DETECTED CONTEXT: ${detectedContext.type}
Important aspects for this type: ${detectedContext.aspects.join(', ')}

## ALREADY KNOWN FROM HISTORY:
${Object.entries(knownInfo)
  .filter(([_, v]) => v)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join('\n') || '- Nothing specific yet'}

## REFERENCE IMAGE: ${hasReference ? 'YES - User provided a reference image' : 'NO'}
`;

    // Добавляем Vision анализ если есть
    if (referenceAnalysis) {
      contextInfo += `
## REFERENCE ANALYSIS (from Vision):
- Content type: ${referenceAnalysis.content_type || 'unknown'}
- Text found: ${referenceAnalysis.text_found?.join(', ') || 'none'}
- Visual elements: ${referenceAnalysis.visual_elements?.join(', ') || 'none'}
- Colors: ${referenceAnalysis.colors?.join(', ') || 'unknown'}
- Style: ${referenceAnalysis.style || 'unknown'}
- Format: ${referenceAnalysis.format || 'unknown'}
- Summary: ${referenceAnalysis.summary || 'no summary'}
`;
    }

    // 5. Собираем историю чата
    let historyContext = '';
    if (chatHistory.length > 0) {
      historyContext = '\n## CHAT HISTORY (recent messages):\n';
      for (const msg of chatHistory.slice(-10)) {
        const role = msg.role === 'user' ? 'USER' : 'AI';
        historyContext += `${role}: ${msg.content?.substring(0, 200)}...\n`;
      }
    }

    const message = `${contextInfo}
${historyContext}

## CURRENT USER REQUEST:
"${userPrompt}"

Analyze this request. Determine if you have enough information to generate a high-quality image, or if you need to ask clarifying questions.

Remember:
- DON'T ask about things already known from history
- If reference provided - USE the Vision analysis above, mention what you see!
- Be specific to the detected context type
- Max 3 questions, make them count`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: SMART_CLARIFICATION_PROMPT,
      messages: [{ role: 'user', content: message }]
    });

    // Сохраняем referenceAnalysis для возврата
    const visionAnalysis = referenceAnalysis;

    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      log.error('Failed to parse clarification response', { response: text });
      return { needs_clarification: false, ready_to_generate: true };
    }

    const result = JSON.parse(jsonMatch[0]);

    // Добавляем detected context в результат
    result.detected_context = result.detected_context || detectedContext.type;
    result.known_info = knownInfo;

    // Добавляем Vision анализ референса
    if (visionAnalysis) {
      result.vision_analysis = visionAnalysis;
      // Если summary есть в vision, используем его для reference_analysis
      if (!result.reference_analysis && visionAnalysis.summary) {
        result.reference_analysis = visionAnalysis.summary;
      }
    }

    // ПРИНУДИТЕЛЬНО: если есть референс - ВСЕГДА показываем вопросы!
    // Это критично для работы как Genspark - нужно уточнить как использовать референс
    if (hasReference && visionAnalysis && !result.needs_clarification) {
      log.info('FORCING clarification for reference image', {
        hadQuestions: result.questions?.length || 0,
        visionSummary: visionAnalysis.summary?.substring(0, 50)
      });

      // Если Claude не задал вопросы - добавляем стандартные для референса
      result.needs_clarification = true;
      result.summary = result.summary || `Вижу референс: ${visionAnalysis.summary?.substring(0, 100) || 'изображение'}. Уточню пару деталей:`;

      // Добавляем вопрос про использование референса если нет вопросов
      if (!result.questions || result.questions.length === 0) {
        result.questions = [
          {
            id: 'reference_usage',
            question: 'Как использовать референс?',
            type: 'single_choice',
            options: ['Как референс (Identity Lock)', 'Вдохновение (стиль)', 'Редактировать'],
            why: 'Определяет модель и степень влияния'
          },
          {
            id: 'style_preference',
            question: 'Стиль новой картинки?',
            type: 'single_choice',
            options: ['Точно как референс', 'Похожий стиль', 'Свой стиль'],
            why: 'Для точного результата'
          }
        ];
      } else {
        // Добавляем вопрос про референс в начало если его нет
        const hasRefQuestion = result.questions.some(q =>
          q.id?.includes('reference') || q.id?.includes('style') ||
          q.question?.toLowerCase().includes('референс') || q.question?.toLowerCase().includes('стиль')
        );
        if (!hasRefQuestion) {
          result.questions.unshift({
            id: 'reference_usage',
            question: 'Как использовать референс?',
            type: 'single_choice',
            options: ['Как референс', 'Вдохновение', 'Редактировать'],
            why: 'Определяет модель генерации'
          });
        }
      }

      // Вопрос про вариации добавляется ниже, вне этого блока
    }

    // PATCH 2: Добавляем вопрос про вариации ВСЕГДА когда есть clarification
    // Это должно быть ВНЕ блока выше, чтобы работало и когда Claude сам задал вопросы
    if (result.needs_clarification && result.questions && result.questions.length > 0) {
      const hasVariationsQuestion = result.questions.some(q =>
        q.id?.includes('variation') || q.question?.toLowerCase().includes('вариац')
      );

      if (!hasVariationsQuestion) {
        result.questions.push({
          id: 'variations_count',
          question: 'Сколько вариаций?',
          type: 'single_choice',
          options: ['1 вариант', '3 варианта', '5 вариантов (рекомендуется)'],
          why: 'Больше вариантов = больше выбора'
        });
      }
    }

    log.debug('Smart clarification check', {
      needsClarification: result.needs_clarification,
      detectedContext: result.detected_context,
      questionsCount: result.questions?.length || 0,
      hasVisionAnalysis: !!visionAnalysis,
      forcedByReference: hasReference
    });

    return result;

  } catch (error) {
    log.error('Clarification check error', { error: error.message });
    return { needs_clarification: false, ready_to_generate: true };
  }
}

/**
 * Deep Thinking режим - глубокий анализ запроса
 * Показывает процесс мышления пользователю
 */
export async function analyzeWithDeepThinking(userPrompt, options = {}) {
  const { hasReference = false, referenceDescription = null, chatHistory = [], onThinkingUpdate = null } = options;

  if (!anthropic) {
    log.warn('Claude API not configured, using basic mode');
    return createBasicPrompt(userPrompt, options);
  }

  try {
    // Уведомляем о начале глубокого анализа
    if (onThinkingUpdate) {
      onThinkingUpdate({ stage: 'analyzing', message: 'Анализирую запрос...' });
    }

    const detectedContext = detectRequestContext(userPrompt);
    const knownInfo = extractKnownInfo(chatHistory);

    let contextMessage = `## REQUEST ANALYSIS

**User Request:** "${userPrompt}"
**Detected Type:** ${detectedContext.type}
**Has Reference:** ${hasReference ? 'Yes' : 'No'}
${referenceDescription ? `**Reference Description:** ${referenceDescription}` : ''}

**Known Details:**
${Object.entries(knownInfo).filter(([_, v]) => v).map(([k, v]) => `- ${k}: ${v}`).join('\n') || 'None'}

**Chat Context:**
${chatHistory.slice(-5).map(m => `${m.role}: ${m.content?.substring(0, 150)}`).join('\n') || 'New conversation'}

---

Perform DEEP ANALYSIS of this creative request. Think step by step about:
1. What is the real goal?
2. Who is the audience?
3. What psychological triggers to use?
4. What visual strategy will work best?
5. How to craft the perfect prompt?

Show your complete thinking process.`;

    // Используем extended thinking если доступно
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16000,
      thinking: {
        type: 'enabled',
        budget_tokens: 10000
      },
      system: DEEP_THINKING_PROMPT,
      messages: [{ role: 'user', content: contextMessage }]
    });

    // Извлекаем thinking и response
    let thinkingContent = '';
    let responseContent = '';

    for (const block of response.content) {
      if (block.type === 'thinking') {
        thinkingContent = block.thinking;
      } else if (block.type === 'text') {
        responseContent = block.text;
      }
    }

    // Уведомляем о процессе мышления
    if (onThinkingUpdate && thinkingContent) {
      onThinkingUpdate({
        stage: 'thinking',
        message: 'Глубокий анализ...',
        thinking: thinkingContent
      });
    }

    // Парсим JSON результат
    const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      log.error('Failed to parse deep thinking response');
      return createBasicPrompt(userPrompt, options);
    }

    const result = JSON.parse(jsonMatch[0]);

    // Добавляем thinking процесс в результат
    result.thinking_content = thinkingContent;
    result.deep_thinking_used = true;

    log.debug('Deep thinking analysis complete', {
      model: result.suggested_model,
      confidence: result.confidence_score,
      thinkingLength: thinkingContent?.length
    });

    return result;

  } catch (error) {
    log.error('Deep thinking error', { error: error.message });
    // Fallback к обычному режиму
    return analyzeAndEnhancePrompt(userPrompt, options);
  }
}

/**
 * Системный промпт для Creative Brain (генерация промпта) - УЛУЧШЕННЫЙ
 */
export const GENERATION_SYSTEM_PROMPT = `You are a Creative Director AI that creates detailed prompts for image generation.

## YOUR ROLE:
1. Understand the creative task (any language)
2. Create detailed, effective prompt for image generation
3. Select optimal model based on requirements
4. Extract text if needed

## OUTPUT FORMAT (JSON):
{
  "task_understanding": "what user wants in detail",
  "enhanced_prompt": "detailed prompt in English for image generation",
  "creative_type": "banner | social | product | infographic | branding | character | ui | meme | other",
  "complexity": "simple | medium | complex | composite",

  "needs_text": true/false,
  "text_content": "exact text if needs_text=true, otherwise null",
  "text_style": "description of text style if needs_text=true",

  "suggested_model": "nano-banana-pro | nano-banana | flux-dev | flux-schnell | kontext",
  "reference_purpose": "style | character | composition | product | null",
  "needs_character_consistency": true/false,

  "negative_prompt": "blurry, low quality, distorted, ugly, amateur, deformed",
  "style_keywords": ["keyword1", "keyword2"],
  "reasoning": "brief explanation of choices in Russian"
}

## MODEL SELECTION RULES:

### nano-banana-pro - BEST FOR TEXT:
- Text longer than 4 words
- Infographics, diagrams
- Character consistency
- Complex compositions
- Multi-language text
- Professional quality

### nano-banana - FAST TEXT:
- Short text (1-4 words)
- Quick generation
- Budget optimization

### flux-dev - GENERAL PURPOSE:
- Standard images
- Style transfer
- Product photos
- Backgrounds
- No/minimal text

### flux-schnell - DRAFTS:
- Previews
- Prototypes
- Memes
- Testing

### kontext - EDITING:
- Image editing
- Text replacement
- Background changes
- Style adjustments

## PROMPT ENGINEERING - 6 FACTORS:

1. **SUBJECT**: Who/what is in the image
2. **COMPOSITION**: Camera angle, framing
3. **ACTION**: What's happening
4. **ENVIRONMENT**: Background, atmosphere, lighting
5. **STYLE**: Visual aesthetic, quality level
6. **TEXT**: If needed - exact text and styling

## DOMAIN-SPECIFIC ADDITIONS:

### For Casino/Gambling:
- Casino aesthetic, golden accents, luxury feel
- Neon lights, excitement, winning atmosphere
- Professional promotional banner
- Vibrant, eye-catching colors

### For Affiliate/Advertising:
- High conversion focus
- Clear CTA visibility
- Trust elements
- Urgency markers

### Always include quality markers:
- "4K, sharp details, professional"
- "high quality, vibrant colors"
- Negative: "blurry, low quality, distorted, amateur, watermark"

Respond ONLY with valid JSON.`;

/**
 * Обработка ответов пользователя на вопросы - УЛУЧШЕННАЯ
 * Теперь извлекает количество вариаций из ответов
 * PATCH 5: Добавлена поддержка Vision analysis и Identity Lock
 */
export async function processUserAnswers(originalPrompt, answers, options = {}) {
  const { hasReference = false, deepThinking = false, visionAnalysis = null, referenceUrl = null } = options;

  // Извлекаем количество вариаций из ответов
  let variationsCount = 1;
  if (answers.variations_count) {
    const match = answers.variations_count.match(/(\d+)/);
    if (match) {
      variationsCount = Math.min(parseInt(match[1]), 5);
    }
  }

  // PATCH 5: Detect reference usage mode from answers
  let referenceUsage = null;
  if (answers.reference_usage) {
    const usage = answers.reference_usage.toLowerCase();
    if (usage.includes('identity') || usage.includes('lock') || usage.includes('референс')) {
      referenceUsage = 'identity_lock';
    } else if (usage.includes('редактир') || usage.includes('edit')) {
      referenceUsage = 'edit';
    } else if (usage.includes('стиль') || usage.includes('style') || usage.includes('вдохновен')) {
      referenceUsage = 'style';
    }
  }

  // Формируем обогащённый промпт из ответов (без variations_count - это не для промпта)
  let enrichedPrompt = originalPrompt;

  // PATCH 5: Add Vision context to enriched prompt if available
  if (visionAnalysis) {
    enrichedPrompt += '\n\n## REFERENCE IMAGE ANALYSIS:';
    if (visionAnalysis.has_character && visionAnalysis.character_description) {
      enrichedPrompt += `\nCharacter: ${visionAnalysis.character_description}`;
      if (visionAnalysis.character_pose) {
        enrichedPrompt += `\nPose: ${visionAnalysis.character_pose}`;
      }
      if (visionAnalysis.character_clothing) {
        enrichedPrompt += `\nClothing: ${visionAnalysis.character_clothing}`;
      }
    }
    if (visionAnalysis.background_description) {
      enrichedPrompt += `\nBackground: ${visionAnalysis.background_description}`;
    }
    if (visionAnalysis.style) {
      enrichedPrompt += `\nStyle: ${visionAnalysis.style}`;
    }
    if (visionAnalysis.colors?.length > 0) {
      enrichedPrompt += `\nColors: ${visionAnalysis.colors.join(', ')}`;
    }
    if (visionAnalysis.recreation_prompt) {
      enrichedPrompt += `\nRecreation hint: ${visionAnalysis.recreation_prompt}`;
    }
  }

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

  // PATCH 5: Force google-nano-pro model for Identity Lock mode
  if (referenceUsage === 'identity_lock') {
    result.suggested_model = 'google-nano-pro';
    result.reference_usage = 'identity_lock';
    result.needs_character_consistency = true;
    log.info('Identity Lock mode activated', {
      model: 'google-nano-pro',
      hasVisionAnalysis: !!visionAnalysis,
      hasCharacter: visionAnalysis?.has_character
    });
  } else if (referenceUsage) {
    result.reference_usage = referenceUsage;
  }

  // Pass through Vision analysis for potential use downstream
  if (visionAnalysis) {
    result.vision_analysis = visionAnalysis;
  }

  return result;
}

/**
 * Анализ и улучшение промпта с помощью Claude (main function) - УЛУЧШЕННАЯ
 */
export async function analyzeAndEnhancePrompt(userPrompt, options = {}) {
  const {
    hasReference = false,
    width = null,
    height = null,
    referenceDescription = null,
    deepThinking = false,
    onThinkingUpdate = null
  } = options;

  // Если Deep Thinking включён - используем расширенный анализ
  if (deepThinking) {
    return analyzeWithDeepThinking(userPrompt, options);
  }

  // Если Claude недоступен — возвращаем базовый результат
  if (!anthropic) {
    log.warn('Claude API not configured, returning basic prompt');
    return createBasicPrompt(userPrompt, options);
  }

  try {
    // Детектируем контекст для лучшего промпта
    const detectedContext = detectRequestContext(userPrompt);

    // Формируем сообщение для Claude
    let message = `User request: ${userPrompt}`;
    message += `\nDetected content type: ${detectedContext.type}`;
    message += `\nReference provided: ${hasReference ? 'YES' : 'NO'}`;

    if (hasReference && referenceDescription) {
      message += `\nReference description: ${referenceDescription}`;
    }

    if (width && height) {
      message += `\nTarget size: ${width}x${height}`;
    }

    message += '\n\nCreate an optimized generation plan. Focus on what makes sense for this content type.';

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: GENERATION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: message }]
    });

    // Парсим JSON из ответа
    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      log.error('Failed to parse Claude response', { response: text });
      return createBasicPrompt(userPrompt, options);
    }

    const result = JSON.parse(jsonMatch[0]);
    result.detected_context = detectedContext.type;

    log.debug('Prompt analyzed and enhanced', {
      original: userPrompt.substring(0, 50),
      model: result.suggested_model,
      needsText: result.needs_text,
      creativeType: result.creative_type,
      context: detectedContext.type
    });

    return result;

  } catch (error) {
    log.error('Claude API error', { error: error.message });
    return createBasicPrompt(userPrompt, options);
  }
}

/**
 * Улучшение промпта (alias for backward compatibility)
 */
export async function enhancePrompt(userPrompt, options = {}) {
  return analyzeAndEnhancePrompt(userPrompt, options);
}

/**
 * Базовый промпт без Claude (fallback) - УЛУЧШЕННЫЙ
 */
function createBasicPrompt(userPrompt, options = {}) {
  const { hasReference } = options;

  // Определяем нужен ли текст
  const textContent = extractTextContent(userPrompt);
  const needsText = textContent !== null;

  // Определяем язык
  const language = detectLanguage(userPrompt);

  // Детектируем контекст
  const detectedContext = detectRequestContext(userPrompt);

  // Базовое улучшение промпта в зависимости от контекста
  let enhancedPrompt = userPrompt;
  let styleAdditions = '';

  switch (detectedContext.type) {
    case 'CASINO_GAMBLING':
      styleAdditions = 'casino aesthetic, golden accents, luxury feel, neon lights, excitement, professional promotional banner, vibrant colors, winning atmosphere';
      break;
    case 'AFFILIATE':
      styleAdditions = 'high conversion advertising, clear CTA, trust elements, professional marketing material, eye-catching design';
      break;
    case 'SOCIAL_MEDIA':
      styleAdditions = 'social media optimized, engaging, trendy, scroll-stopping, vibrant colors';
      break;
    case 'PRODUCT':
      styleAdditions = 'product photography, clean background, professional lighting, commercial quality';
      break;
    case 'CHARACTER':
      styleAdditions = 'character design, expressive, detailed, consistent style';
      break;
    default:
      styleAdditions = 'high quality, professional, sharp details, vibrant colors';
  }

  enhancedPrompt = `${userPrompt}, ${styleAdditions}, 4K quality`;

  // Определяем модель
  let suggestedModel = 'flux-dev';
  if (needsText) {
    const wordCount = textContent.split(/\s+/).length;
    suggestedModel = wordCount > 4 ? 'nano-banana-pro' : 'nano-banana';
  }
  if (hasReference) {
    suggestedModel = 'kontext';
  }

  return {
    task_understanding: userPrompt,
    enhanced_prompt: enhancedPrompt,
    creative_type: detectedContext.type.toLowerCase().replace('_', ''),
    complexity: 'simple',
    needs_text: needsText,
    text_content: textContent,
    text_style: needsText ? 'bold letters with glow effect, high contrast' : null,
    suggested_model: suggestedModel,
    reference_purpose: hasReference ? 'style' : null,
    needs_character_consistency: false,
    negative_prompt: 'blurry, low quality, distorted text, ugly, amateur, watermark, deformed',
    style_keywords: styleAdditions.split(', ').slice(0, 5),
    reasoning: 'Базовый режим (Claude недоступен)',
    detected_context: detectedContext.type
  };
}

/**
 * Извлечение текста из промпта - УЛУЧШЕННОЕ
 */
export function extractTextContent(prompt) {
  // Ищем текст в кавычках (разные типы)
  const quotePatterns = [
    /[""]([^""]+)[""]/,           // "text"
    /[«»]([^«»]+)[»«]/,           // «text»
    /['']([^'']+)['']/,           // 'text'
    /"([^"]+)"/,                   // "text"
    /'([^']+)'/                    // 'text'
  ];

  for (const pattern of quotePatterns) {
    const match = prompt.match(pattern);
    if (match) return match[1].trim();
  }

  // Ищем после ключевых слов
  const keywordPatterns = [
    /(?:текст|text|надпись|слова|написать)[:\s]+["«']?([^"«»'',.\n]+)["»']?/i,
    /(?:с текстом|with text)[:\s]+["«']?([^"«»'',.\n]+)["»']?/i
  ];

  for (const pattern of keywordPatterns) {
    const match = prompt.match(pattern);
    if (match) return match[1].trim();
  }

  // Ищем явные паттерны бонусов/CTA
  const ctaPatterns = [
    /(\d+[%€$₽]\s*(?:бонус|bonus|off|скидка)?)/i,
    /(?:BONUS|WELCOME|FREE SPINS?|GET|WIN|CLAIM)\s+[\d%$€]+/i,
    /(?:Получи|Забери|Выиграй)\s+[\d%]+/i
  ];

  for (const pattern of ctaPatterns) {
    const match = prompt.match(pattern);
    if (match) return match[0].trim();
  }

  return null;
}

/**
 * Извлечение размера из промпта
 */
export function extractSizeFromPrompt(prompt) {
  // Паттерн 1: "100x600", "100×600", "100X600"
  const xPattern = prompt.match(/(\d{2,4})\s*[xXхХ×]\s*(\d{2,4})/);
  if (xPattern) {
    return { width: parseInt(xPattern[1]), height: parseInt(xPattern[2]) };
  }

  // Паттерн 2: "100 на 600", "100 by 600"
  const naPattern = prompt.match(/(\d{2,4})\s*(?:на|by)\s*(\d{2,4})/i);
  if (naPattern) {
    return { width: parseInt(naPattern[1]), height: parseInt(naPattern[2]) };
  }

  // Паттерн 3: "размер 100 600", "size 100 600"
  const sizePattern = prompt.match(/(?:размер|size)\s*[:\s]*(\d{2,4})\s+(\d{2,4})/i);
  if (sizePattern) {
    return { width: parseInt(sizePattern[1]), height: parseInt(sizePattern[2]) };
  }

  // Паттерн 4: "100*600"
  const starPattern = prompt.match(/(\d{2,4})\s*\*\s*(\d{2,4})/);
  if (starPattern) {
    return { width: parseInt(starPattern[1]), height: parseInt(starPattern[2]) };
  }

  return null;
}

/**
 * Определение языка текста
 */
export function detectLanguage(text) {
  const cyrillicChars = (text.match(/[а-яёА-ЯЁ]/g) || []).length;
  const latinChars = (text.match(/[a-zA-Z]/g) || []).length;

  if (cyrillicChars > latinChars) {
    return 'ru';
  }
  return 'en';
}

/**
 * Генерация заголовка чата из первого сообщения - УЛУЧШЕННАЯ
 */
export async function generateChatTitle(firstMessage) {
  if (!anthropic) {
    // Берём первые 30 символов
    return firstMessage.length > 30
      ? firstMessage.substring(0, 30) + '...'
      : firstMessage;
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 50,
      messages: [{
        role: 'user',
        content: `Придумай короткое название (2-4 слова, максимум 25 символов) для чата о создании изображения. Запрос пользователя: "${firstMessage.substring(0, 100)}".

Правила:
- Только название, без кавычек
- Отражай суть запроса
- Если про казино/слоты - укажи это
- Если про баннер - укажи размер или платформу

Ответь ТОЛЬКО названием.`
      }]
    });

    return response.content[0].text.trim().substring(0, 40);
  } catch (error) {
    log.error('Generate chat title error', { error: error.message });
    return firstMessage.substring(0, 30);
  }
}

/**
 * Quick generate - генерация без вопросов
 * Используется когда пользователь нажимает "Сгенерировать сразу"
 */
export async function quickGenerate(userPrompt, options = {}) {
  // Пропускаем этап вопросов, сразу анализируем и улучшаем
  return analyzeAndEnhancePrompt(userPrompt, {
    ...options,
    skipClarification: true
  });
}
