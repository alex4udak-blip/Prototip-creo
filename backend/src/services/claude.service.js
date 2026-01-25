import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/env.js';
import { log } from '../utils/logger.js';

// Lazy initialization
let anthropic = null;

/**
 * Extract JSON from text - handles nested objects and strings with special chars correctly
 * @param {string} text - Text potentially containing JSON
 * @returns {Object|null} Parsed JSON or null
 */
function extractJSON(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }

  // Try to parse directly first
  try {
    return JSON.parse(text.trim());
  } catch {
    // Continue to extraction
  }

  // Find first { and match balanced braces, accounting for strings
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let end = -1;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];

    // Handle escape sequences
    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\' && inString) {
      escaped = true;
      continue;
    }

    // Handle string boundaries
    if (char === '"') {
      inString = !inString;
      continue;
    }

    // Only count braces outside of strings
    if (!inString) {
      if (char === '{') depth++;
      if (char === '}') depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  if (end === -1) {
    log.warn('JSON extraction failed - unbalanced braces', { start, textLength: text.length });
    return null;
  }

  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch (e) {
    log.error('JSON extraction failed', { error: e.message, substring: text.slice(start, Math.min(start + 100, end + 1)) });
    return null;
  }
}

function getClient() {
  if (!anthropic && config.anthropicApiKey) {
    anthropic = new Anthropic({
      apiKey: config.anthropicApiKey
    });
  }
  if (!anthropic) {
    throw new Error('Anthropic API key not configured');
  }
  return anthropic;
}

/**
 * Claude model configuration from env
 * Using Claude Sonnet 4.5 - recommended for production
 */
const MODEL = config.claude?.model || 'claude-sonnet-4-5-20250929';
const MAX_TOKENS = config.claude?.maxTokens || 8192;
const THINKING_BUDGET = config.claude?.thinkingBudget || 2048;

/**
 * System prompt for landing page generation
 * Claude acts as the "brain" - understanding, planning, generating code
 */
const LANDING_SYSTEM_PROMPT = `You are an expert landing page generator for gambling/casino affiliate marketing.

Your role:
1. UNDERSTAND user requests (slot names, game types, prizes, languages)
2. PLAN asset requirements and game mechanics
3. GENERATE production-ready HTML/CSS/JS code

## Game Types You Support:
- wheel: Fortune wheel with sectors and prizes
- boxes: Gift box selection game
- crash: Character advances avoiding obstacles (Chicken Road style)
- board: Board game with dice and moves
- scratch: Scratch card reveal
- loader: Progress bar prelander
- slot: Mini slot machine simulation

## Critical Requirements:
- Player ALWAYS wins (rigged games)
- Mobile responsive (viewport meta, touch events)
- Redirect to offer URL after win
- Sounds integration (spin.mp3, win.mp3)
- Clean, production-ready code
- NO external dependencies (inline CSS/JS)

## Asset Paths Convention:
- Background: assets/bg.webp
- Logo: assets/logo.png
- Game elements: assets/{element}.png
- Sounds: sounds/{sound}.mp3

## When Generating Code:
- Use CSS custom properties for colors
- Include all animations inline
- Add 18+ disclaimer for gambling
- Support both desktop and mobile
- Include proper meta tags

Respond in JSON format when analyzing/planning.
Respond with complete HTML when generating code.`;

/**
 * Analyze user request and extract structured data
 * @param {string} prompt - User's natural language request
 * @param {string} [screenshotBase64] - Optional screenshot for analysis
 * @returns {Promise<Object>} Structured analysis
 */
export async function analyzeRequest(prompt, screenshotBase64 = null) {
  const client = getClient();

  const messages = [
    {
      role: 'user',
      content: buildAnalysisContent(prompt, screenshotBase64)
    }
  ];

  log.info('Claude: Analyzing request with Extended Thinking', { promptLength: prompt.length, hasScreenshot: !!screenshotBase64 });

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      // Enable Extended Thinking for better analysis
      thinking: {
        type: 'enabled',
        budget_tokens: THINKING_BUDGET
      },
      system: `${LANDING_SYSTEM_PROMPT}

For this request, analyze and return a JSON object with:
{
  "slotName": "extracted or inferred slot name",
  "isRealSlot": true/false (if it's a known slot game),
  "mechanicType": "wheel|boxes|crash|board|scratch|loader|slot",
  "prizes": ["prize1", "prize2", ...],
  "language": "detected language code (en, de, es, ru, etc.)",
  "theme": "visual theme description",
  "style": "art style (cartoon, realistic, neon, etc.)",
  "offerUrl": "extracted URL or null",
  "assetsNeeded": [
    { "type": "background|character|element|logo", "description": "what to generate" }
  ],
  "soundsNeeded": ["spin", "win", "click"],
  "confidence": 0-100
}`,
      messages
    });

    // Extract thinking and response
    let thinkingContent = null;
    let textContent = null;

    for (const block of response.content) {
      if (block.type === 'thinking') {
        thinkingContent = block.thinking;
        log.info('Claude: Thinking process', { thinkingLength: thinkingContent?.length });
      } else if (block.type === 'text') {
        textContent = block.text;
      }
    }

    // Extract JSON from response - find balanced braces
    const analysis = extractJSON(textContent || '');
    if (analysis) {
      // Add thinking to analysis for frontend display
      analysis._thinking = thinkingContent;

      log.info('Claude: Analysis complete', {
        slotName: analysis.slotName,
        mechanicType: analysis.mechanicType,
        confidence: analysis.confidence,
        hadThinking: !!thinkingContent
      });
      return analysis;
    }

    throw new Error('Failed to parse analysis response');
  } catch (error) {
    log.error('Claude: Analysis failed', { error: error.message });
    throw error;
  }
}

/**
 * Generate complete HTML/CSS/JS for a landing page
 * @param {Object} spec - Game specification from analysis
 * @param {Object} assets - Generated asset paths
 * @param {Object} colors - Color palette
 * @returns {Promise<string>} Complete HTML code
 */
export async function generateLandingCode(spec, assets, colors) {
  const client = getClient();

  const prompt = buildCodeGenerationPrompt(spec, assets, colors);

  log.info('Claude: Generating landing code', {
    mechanicType: spec.mechanicType,
    slotName: spec.slotName
  });

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: `${LANDING_SYSTEM_PROMPT}

Generate a COMPLETE, production-ready HTML file with inline CSS and JS.
The code must:
1. Be mobile responsive
2. Include all animations
3. Have the player ALWAYS win
4. Redirect to offer URL after win
5. Include sound effects
6. Have proper meta tags
7. Include 18+ disclaimer

Return ONLY the HTML code, no explanations.`,
      messages: [{ role: 'user', content: prompt }]
    });

    let html = response.content[0]?.text || '';

    // Clean up if wrapped in markdown code blocks
    html = html.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '');

    log.info('Claude: Code generation complete', { htmlLength: html.length });

    return html;
  } catch (error) {
    log.error('Claude: Code generation failed', { error: error.message });
    throw error;
  }
}

/**
 * Stream code generation for real-time updates
 * @param {Object} spec - Game specification
 * @param {Object} assets - Asset paths
 * @param {Object} colors - Color palette
 * @param {Function} onChunk - Callback for each chunk
 * @returns {Promise<string>} Complete HTML
 */
export async function generateLandingCodeStream(spec, assets, colors, onChunk) {
  const client = getClient();

  const prompt = buildCodeGenerationPrompt(spec, assets, colors);

  log.info('Claude: Starting streaming code generation', {
    mechanicType: spec.mechanicType
  });

  let html = '';

  try {
    const stream = await client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: `${LANDING_SYSTEM_PROMPT}

Generate a COMPLETE, production-ready HTML file with inline CSS and JS.
Return ONLY the HTML code, no explanations or markdown.`,
      messages: [{ role: 'user', content: prompt }]
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.text) {
        html += event.delta.text;
        if (onChunk) {
          onChunk(event.delta.text);
        }
      }
    }

    // Clean up markdown if present
    html = html.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '');

    log.info('Claude: Streaming complete', { htmlLength: html.length });

    return html;
  } catch (error) {
    log.error('Claude: Streaming failed', { error: error.message });
    throw error;
  }
}

/**
 * Generate game mechanic logic based on type
 * @param {string} mechanicType - Type of game
 * @param {Object} config - Game configuration
 * @returns {Promise<string>} JavaScript code
 */
export async function generateGameLogic(mechanicType, gameConfig) {
  const client = getClient();

  const prompt = `Generate JavaScript game logic for a ${mechanicType} game:

Configuration:
${JSON.stringify(gameConfig, null, 2)}

Requirements:
- Player MUST always win
- Include all animations
- Handle touch events for mobile
- Play sounds at appropriate moments
- Redirect to CONFIG.offerUrl after win
- Use requestAnimationFrame for smooth animations

Return ONLY the JavaScript code (no HTML, no explanations).`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: 'You are a JavaScript game developer. Generate clean, efficient code.',
      messages: [{ role: 'user', content: prompt }]
    });

    let js = response.content[0]?.text || '';
    js = js.replace(/^```javascript?\n?/i, '').replace(/\n?```$/i, '');

    return js;
  } catch (error) {
    log.error('Claude: Game logic generation failed', { error: error.message });
    throw error;
  }
}

/**
 * Build content array for analysis request
 */
function buildAnalysisContent(prompt, screenshotBase64) {
  const content = [];

  if (screenshotBase64) {
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/png',
        data: screenshotBase64.replace(/^data:image\/\w+;base64,/, '')
      }
    });
    content.push({
      type: 'text',
      text: `Analyze this screenshot and the following request:\n\n${prompt}`
    });
  } else {
    content.push({
      type: 'text',
      text: prompt
    });
  }

  return content;
}

/**
 * Build prompt for code generation
 */
function buildCodeGenerationPrompt(spec, assets, colors) {
  return `Generate a complete ${spec.mechanicType} landing page.

## Slot/Brand: ${spec.slotName || 'Custom Casino'}

## Prizes: ${JSON.stringify(spec.prizes || ['€500', '€200', '100 FS'])}

## Language: ${spec.language || 'en'}

## Offer URL: ${spec.offerUrl || '{{OFFER_URL}}'}

## Color Palette:
- Primary: ${colors?.primary || '#FFD700'}
- Secondary: ${colors?.secondary || '#1E3A5F'}
- Accent: ${colors?.accent || '#FF6B6B'}
- Background: ${colors?.background || '#0D1117'}

## Assets Available:
${Object.entries(assets || {}).map(([key, path]) => `- ${key}: ${path}`).join('\n')}

## Sounds Available:
- sounds/spin.mp3
- sounds/win.mp3
- sounds/click.mp3

## Theme: ${spec.theme || 'casino'}
## Style: ${spec.style || 'modern'}

Generate the complete HTML file with:
1. All CSS inline in <style>
2. All JS inline in <script>
3. Proper viewport meta
4. 18+ disclaimer
5. Mobile responsive design
6. Smooth animations
7. Sound effects integration
8. Win logic (player always wins)
9. Redirect after win`;
}

/**
 * Check Claude API availability
 */
export function checkHealth() {
  return {
    configured: !!config.anthropicApiKey,
    model: MODEL
  };
}

export default {
  analyzeRequest,
  generateLandingCode,
  generateLandingCodeStream,
  generateGameLogic,
  checkHealth
};
