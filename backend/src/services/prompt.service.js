import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/env.js';
import { log } from '../utils/logger.js';

// Инициализация клиента Claude
const anthropic = config.anthropicApiKey
  ? new Anthropic({ apiKey: config.anthropicApiKey })
  : null;

/**
 * Системный промпт для Clarification Agent
 * Задаёт уточняющие вопросы перед генерацией
 */
export const CLARIFICATION_SYSTEM_PROMPT = `You are a Creative Director AI assistant that helps users create perfect banners and visual content.

## YOUR ROLE:
Before generating an image, you MUST ask clarifying questions to understand the user's needs better.
This is critical for producing high-quality results.

## ANALYZE THE REQUEST AND DECIDE:

If the request is CLEAR and SPECIFIC (has style, colors, size, text, etc.) - respond with:
{
  "needs_clarification": false,
  "ready_to_generate": true
}

If the request is VAGUE or INCOMPLETE - respond with clarifying questions:
{
  "needs_clarification": true,
  "questions": [
    {
      "id": "style",
      "question": "Какой стиль баннера вам нужен?",
      "type": "single_choice",
      "options": [
        {"value": "modern", "label": "Современный/Минималистичный"},
        {"value": "casino", "label": "Казино/Игровой"},
        {"value": "premium", "label": "Премиум/Люкс"},
        {"value": "fun", "label": "Яркий/Весёлый"}
      ]
    },
    {
      "id": "colors",
      "question": "Какая цветовая гамма?",
      "type": "single_choice",
      "options": [
        {"value": "gold_black", "label": "Золото + Чёрный"},
        {"value": "blue_purple", "label": "Синий + Фиолетовый"},
        {"value": "red_orange", "label": "Красный + Оранжевый"},
        {"value": "custom", "label": "Другое (напишу)"}
      ]
    }
  ],
  "summary": "Чтобы создать идеальный баннер, мне нужно уточнить несколько деталей."
}

## QUESTION TYPES:
- single_choice: User picks one option
- multiple_choice: User can pick multiple
- text_input: Free text answer
- confirm: Yes/No question

## QUESTIONS TO CONSIDER (pick 2-4 most relevant):

### For banners/ads:
- Стиль (современный, ретро, минималистичный, игровой)
- Цветовая гамма
- Текст на баннере (какой именно?)
- Целевая аудитория
- Где будет использоваться (Facebook, Instagram, сайт)?

### For social media:
- Платформа (Instagram, TikTok, YouTube)?
- Формат (пост, сторис, обложка)?
- Настроение (весёлое, серьёзное, вдохновляющее)?

### For product images:
- Тип продукта
- Фон (белый, градиент, lifestyle)?
- Нужны ли декоративные элементы?

### For characters/mascots:
- Стиль (мультяшный, реалистичный, пиксельный)?
- Эмоция/поза
- Возраст/пол персонажа

## RULES:
1. Ask 2-4 questions MAX (not more!)
2. Questions should be in RUSSIAN
3. Make options clear and helpful
4. Don't ask obvious questions
5. If user provided reference image - ask less questions
6. Always include a "summary" explaining why you're asking

Respond ONLY with valid JSON, no markdown.`;

/**
 * Системный промпт для Creative Brain (генерация промпта)
 */
export const GENERATION_SYSTEM_PROMPT = `You are a Creative Director AI that creates detailed prompts for image generation.

## YOUR ROLE:
1. Understand the creative task (any language)
2. Create detailed, effective prompt for image generation
3. Select optimal model
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

### Use nano-banana-pro when:
- Text longer than 4 words needed
- Infographics, diagrams, charts
- Character consistency across images (with reference)
- Complex compositions requiring reasoning
- Multi-language text
- Professional/commercial quality required

### Use nano-banana when:
- Short text (1-4 words) needed
- Fast generation with text
- Budget optimization with text

### Use flux-dev when:
- Standard image generation
- Style transfer with reference
- Product photos
- Backgrounds and environments
- No text or minimal text

### Use flux-schnell when:
- Drafts and previews
- Rapid prototyping
- Memes and quick content
- Testing concepts

### Use kontext when:
- Editing existing images
- Text replacement/correction
- Background changes
- Style adjustments
- Iterative refinement

## PROMPT ENGINEERING RULES:

### Structure (6 factors):
1. SUBJECT: Who/what is in the image
2. COMPOSITION: Camera angle, framing, position
3. ACTION: What's happening
4. ENVIRONMENT: Background, atmosphere, lighting
5. STYLE: Visual aesthetic, quality level
6. TEXT: If needed, exact text and styling

### For gambling/casino:
- Add: casino aesthetic, golden accents, luxury feel, neon lights, excitement
- Include: high quality, professional promotional banner, vibrant colors

### Always include:
- Quality markers: "4K, sharp details, professional"
- Negative prompt: "blurry, low quality, distorted, amateur"`;

/**
 * Проверка нужны ли уточняющие вопросы
 */
export async function checkNeedsClarification(userPrompt, options = {}) {
  const { hasReference = false, chatHistory = [] } = options;

  if (!anthropic) {
    log.warn('Claude API not configured, skipping clarification');
    return { needs_clarification: false, ready_to_generate: true };
  }

  try {
    // Собираем контекст из истории чата
    let context = '';
    if (chatHistory.length > 0) {
      context = '\n\nПредыдущие сообщения в чате:\n';
      for (const msg of chatHistory.slice(-6)) { // Последние 6 сообщений
        context += `${msg.role === 'user' ? 'User' : 'AI'}: ${msg.content}\n`;
      }
    }

    const message = `User request: ${userPrompt}
Reference image provided: ${hasReference ? 'YES' : 'NO'}
${context}

Analyze if this request needs clarification or is ready for generation.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: CLARIFICATION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: message }]
    });

    const text = response.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      log.error('Failed to parse clarification response', { response: text });
      return { needs_clarification: false, ready_to_generate: true };
    }

    const result = JSON.parse(jsonMatch[0]);

    log.debug('Clarification check result', {
      needsClarification: result.needs_clarification,
      questionsCount: result.questions?.length || 0
    });

    return result;

  } catch (error) {
    log.error('Clarification check error', { error: error.message });
    return { needs_clarification: false, ready_to_generate: true };
  }
}

/**
 * Обработка ответов пользователя на вопросы
 */
export async function processUserAnswers(originalPrompt, answers, options = {}) {
  const { hasReference = false } = options;

  // Формируем обогащённый промпт из ответов
  let enrichedPrompt = originalPrompt;

  const answerDescriptions = [];
  for (const [questionId, answer] of Object.entries(answers)) {
    if (answer && answer !== 'skip') {
      answerDescriptions.push(`${questionId}: ${answer}`);
    }
  }

  if (answerDescriptions.length > 0) {
    enrichedPrompt += `\n\nUser preferences:\n${answerDescriptions.join('\n')}`;
  }

  // Теперь генерируем финальный промпт
  return analyzeAndEnhancePrompt(enrichedPrompt, { hasReference, ...options });
}

/**
 * Анализ и улучшение промпта с помощью Claude (main function)
 */
export async function analyzeAndEnhancePrompt(userPrompt, options = {}) {
  const { hasReference = false, width = null, height = null, referenceDescription = null } = options;

  // Если Claude недоступен — возвращаем базовый результат
  if (!anthropic) {
    log.warn('Claude API not configured, returning basic prompt');
    return createBasicPrompt(userPrompt, options);
  }

  try {
    // Формируем сообщение для Claude
    let message = `User request: ${userPrompt}`;
    message += `\nReference provided: ${hasReference ? 'YES' : 'NO'}`;

    if (hasReference && referenceDescription) {
      message += `\nReference description: ${referenceDescription}`;
    }

    if (width && height) {
      message += `\nTarget size: ${width}x${height}`;
    }

    message += '\n\nCreate detailed generation plan.';

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

    log.debug('Prompt analyzed and enhanced', {
      original: userPrompt.substring(0, 50),
      model: result.suggested_model,
      needsText: result.needs_text,
      creativeType: result.creative_type
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
 * Базовый промпт без Claude (fallback)
 */
function createBasicPrompt(userPrompt, options = {}) {
  const { hasReference } = options;

  // Определяем нужен ли текст
  const textContent = extractTextContent(userPrompt);
  const needsText = textContent !== null;

  // Определяем язык
  const language = detectLanguage(userPrompt);

  // Базовое улучшение промпта
  let enhancedPrompt = userPrompt;
  if (language === 'ru') {
    enhancedPrompt = `Professional promotional banner, ${userPrompt}, high quality, sharp details, vibrant colors, casino aesthetic, luxury feel`;
  } else {
    enhancedPrompt = `Professional promotional banner, ${userPrompt}, high quality, sharp details, vibrant colors`;
  }

  // Определяем модель
  let suggestedModel = 'flux-dev';
  if (needsText) {
    const wordCount = textContent.split(' ').length;
    suggestedModel = wordCount > 4 ? 'nano-banana-pro' : 'nano-banana';
  }
  if (hasReference) {
    suggestedModel = 'kontext';
  }

  return {
    task_understanding: userPrompt,
    enhanced_prompt: enhancedPrompt,
    creative_type: 'banner',
    complexity: 'simple',
    needs_text: needsText,
    text_content: textContent,
    text_style: needsText ? 'bold golden letters with glow effect' : null,
    suggested_model: suggestedModel,
    reference_purpose: hasReference ? 'style' : null,
    needs_character_consistency: false,
    negative_prompt: 'blurry, low quality, distorted text, ugly, amateur, watermark, deformed',
    style_keywords: ['promotional', 'professional', 'vibrant'],
    reasoning: 'Базовый режим (Claude недоступен)'
  };
}

/**
 * Извлечение текста из промпта
 */
export function extractTextContent(prompt) {
  // Ищем текст в кавычках
  const quotedMatch = prompt.match(/["«»'']([^"«»'']+)["«»'']/);
  if (quotedMatch) {
    return quotedMatch[1].trim();
  }

  // Ищем после ключевых слов
  const keywordMatch = prompt.match(/(?:текст|text|надпись|слова)[:\s]+([^,.]+)/i);
  if (keywordMatch) {
    return keywordMatch[1].trim();
  }

  // Ищем явные паттерны бонусов
  const bonusMatch = prompt.match(/(\d+[%€$₽]\s*(?:бонус|bonus)?|\bBONUS\s+\d+[%€$]?|\bWELCOME\s+\d+)/i);
  if (bonusMatch) {
    return bonusMatch[1].trim();
  }

  return null;
}

/**
 * Определение языка текста
 */
export function detectLanguage(text) {
  // Простая проверка на кириллицу
  const cyrillicChars = (text.match(/[а-яёА-ЯЁ]/g) || []).length;
  const latinChars = (text.match(/[a-zA-Z]/g) || []).length;

  if (cyrillicChars > latinChars) {
    return 'ru';
  }
  return 'en';
}

/**
 * Генерация заголовка чата из первого сообщения
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
        content: `Придумай короткое название (2-4 слова, максимум 30 символов) для чата, где пользователь попросил: "${firstMessage}". Ответь ТОЛЬКО названием, без кавычек и пояснений.`
      }]
    });

    return response.content[0].text.trim().substring(0, 50);
  } catch (error) {
    log.error('Generate chat title error', { error: error.message });
    return firstMessage.substring(0, 30);
  }
}
