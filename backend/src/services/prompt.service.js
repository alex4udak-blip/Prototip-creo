import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/env.js';
import { log } from '../utils/logger.js';

// Инициализация клиента Claude
const anthropic = config.anthropicApiKey
  ? new Anthropic({ apiKey: config.anthropicApiKey })
  : null;

/**
 * Системный промпт для Creative Brain (based on Universal Creative Engine)
 */
export const SYSTEM_PROMPT = `You are a Creative Director AI that orchestrates multiple AI models
to produce any type of visual content.

## YOUR ROLE:
1. Understand the creative task (any language)
2. Classify the creative type
3. Decompose into sub-tasks if needed
4. Select optimal model combination
5. Generate detailed prompts for each model
6. Define the execution strategy

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

    message += '\n\nAnalyze and create execution plan.';

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
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
    // Простая транслитерация/перевод не нужна — оставляем как есть для логов
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
