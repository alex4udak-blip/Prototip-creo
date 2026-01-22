import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/env.js';
import { log } from '../utils/logger.js';

// Инициализация клиента Claude
const anthropic = config.anthropicApiKey
  ? new Anthropic({ apiKey: config.anthropicApiKey })
  : null;

// Системный промпт для улучшения запросов
const SYSTEM_PROMPT = `Ты эксперт по созданию промптов для AI-генерации рекламных баннеров.
Специализация: гемблинг, беттинг, казино, крипто, арбитраж трафика.

Твоя задача: превратить описание на русском в детальный промпт на английском для генерации изображения.

ВАЖНО:
1. Определи нужен ли текст на баннере. Если в запросе упоминается конкретный текст, бонус, проценты — needs_text: true
2. Если есть текст — извлеки его точно как написано (сохраняй язык оригинала)
3. Для гемблинга добавляй: casino aesthetic, golden accents, luxury feel, neon lights, excitement
4. Всегда добавляй: professional promotional banner, high quality, sharp details, vibrant colors

Ответ ТОЛЬКО в JSON формате:
{
  "enhanced_prompt": "детальный промпт на английском для image generation",
  "negative_prompt": "blurry, low quality, distorted text, ugly, amateur, watermark, signature",
  "needs_text": true/false,
  "text_content": "точный текст для баннера если needs_text=true, иначе null",
  "text_style": "описание стиля текста (bold golden letters, neon glow, etc) если needs_text=true",
  "style_keywords": ["ключевые слова стиля"],
  "suggested_model": "flux-dev | flux-schnell | nano-banana | kontext",
  "reasoning": "краткое объяснение выбора модели на русском"
}

Правила выбора модели:
- nano-banana: когда нужен ТОЧНЫЙ текст на баннере (бонусы, проценты, названия)
- kontext: когда есть референс-картинка для редактирования/стилизации
- flux-schnell: для быстрых черновиков или простых запросов
- flux-dev: для качественных баннеров без сложного текста`;

/**
 * Улучшение промпта с помощью Claude
 */
export async function enhancePrompt(userPrompt, options = {}) {
  const { hasReference = false, size = null, referenceDescription = null } = options;

  // Если Claude недоступен — возвращаем базовый результат
  if (!anthropic) {
    log.warn('Claude API not configured, returning basic prompt');
    return createBasicPrompt(userPrompt, options);
  }

  try {
    // Формируем сообщение для Claude
    let message = `Описание баннера: ${userPrompt}`;

    if (hasReference) {
      message += '\n\nЕсть референс-картинка для стиля.';
      if (referenceDescription) {
        message += ` Описание референса: ${referenceDescription}`;
      }
    }

    if (size) {
      message += `\nРазмер баннера: ${size}`;
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
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

    log.debug('Prompt enhanced', {
      original: userPrompt.substring(0, 50),
      model: result.suggested_model,
      needsText: result.needs_text
    });

    return result;

  } catch (error) {
    log.error('Claude API error', { error: error.message });
    return createBasicPrompt(userPrompt, options);
  }
}

/**
 * Базовый промпт без Claude (fallback)
 */
function createBasicPrompt(userPrompt, options = {}) {
  const { hasReference } = options;

  // Простое определение нужен ли текст
  const needsText = /\d+[%€$₽]|бонус|bonus|free spin|фриспин/i.test(userPrompt);

  // Извлекаем потенциальный текст
  const textMatch = userPrompt.match(/["«»']([^"«»']+)["«»']/);
  const textContent = textMatch ? textMatch[1] : null;

  return {
    enhanced_prompt: `Professional promotional banner, ${userPrompt}, high quality, sharp details, vibrant colors, casino aesthetic, luxury feel`,
    negative_prompt: 'blurry, low quality, distorted text, ugly, amateur, watermark',
    needs_text: needsText,
    text_content: textContent,
    text_style: needsText ? 'bold golden letters with glow effect' : null,
    style_keywords: ['promotional', 'casino', 'vibrant'],
    suggested_model: hasReference ? 'kontext' : (needsText ? 'nano-banana' : 'flux-dev'),
    reasoning: 'Базовый режим (Claude недоступен)'
  };
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
