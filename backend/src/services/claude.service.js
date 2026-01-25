import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/env.js';
import { log } from '../utils/logger.js';
// Note: landing-examples.js exports are available but not used - using v0.dev-style prompts instead
import { buildPromptWithExamples, validateGeneratedHtml } from './examples-loader.service.js';
import * as ratingService from './rating.service.js';
// 2025-2026 Best Practices: v0.dev-style structured prompts
import {
  ANALYSIS_SYSTEM_PROMPT,
  CODE_GENERATION_SYSTEM_PROMPT,
  buildSystemPromptWithExamples,
  buildCodeGenerationUserPrompt
} from './prompts/landing-system-prompt.js';

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
 *
 * IMPORTANT: This system is ADAPTIVE - it can handle ANY game type,
 * not just predefined mechanics. Claude should understand the user's
 * intent and create appropriate game logic.
 */
const LANDING_SYSTEM_PROMPT = `You are an expert landing page generator for gambling/casino affiliate marketing.

Your role:
1. UNDERSTAND user requests (slot names, game types, prizes, languages)
2. ANALYZE what kind of interactive element they want
3. PLAN asset requirements and game mechanics
4. GENERATE production-ready HTML/CSS/JS code

## ADAPTIVE GAME UNDERSTANDING:
You can create ANY type of interactive landing page game. Common patterns include:
- Fortune wheels (spin to win)
- Gift box selection (pick to reveal)
- Grid/crash games (step by step progression)
- Scratch cards (reveal prizes)
- Slot machines (spin reels)
- Progress loaders (loading bar preland)
- Board games (dice/moves)
- Memory games (flip cards)
- Mini-games based on popular games (Aviator, Chicken Road, Plinko, etc.)

But you're NOT LIMITED to these! If the user describes a custom mechanic, understand and implement it.
The key principle: PLAYER ALWAYS WINS (games are rigged for marketing conversion).

## WHEN ANALYZING A REQUEST:
1. Identify the BRAND/SLOT name (can be real casino game or fictional)
2. Determine the game MECHANIC (interaction type)
3. Extract PRIZES and LANGUAGE
4. Understand the VISUAL STYLE they want
5. List what ASSETS would be needed

## Critical Requirements:
- Player ALWAYS wins (rigged games)
- Mobile responsive (viewport meta, touch events)
- Redirect to offer URL after win
- Sounds integration (spin.mp3, win.mp3)
- Clean, production-ready code
- NO external dependencies (inline CSS/JS)

## Asset Paths Convention:
- Background: assets/background.png
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
 * Extended system prompt with examples for high-quality landing generation
 * Based on production-proven landing page templates
 */
const LANDING_CODE_SYSTEM_PROMPT = `You are an expert landing page generator for gambling/casino affiliate marketing.

## YOUR TASK
Generate a COMPLETE, PRODUCTION-READY HTML file with inline CSS and JavaScript.

## CRITICAL QUALITY REQUIREMENTS (MUST FOLLOW):

### 1. RESPONSIVE DESIGN
Use relative units (em, rem, %, vh, vw) NOT fixed pixels:
\`\`\`css
html { font-size: min(4.5px + 5.5*(100vw - 375px)/1545, 10px); }
@media(min-width: 1024px) { html { font-size: clamp(5px, 0.85vh, 10px) !important; } }
body { font-size: 80%; }
@media(max-width: 1023px) { body { font-size: 110%; } }
\`\`\`

### 2. VIEWPORT META (EXACT)
\`\`\`html
<meta name="viewport" content="width=device-width, user-scalable=no, initial-scale=0.9, maximum-scale=0.9, minimum-scale=0.9, viewport-fit=cover">
\`\`\`

### 3. LOADER WITH PROGRESS BAR
Always include a loader with animated progress bar:
\`\`\`html
<div class="loader" id="loader">
    <img class="loader__logo" src="assets/logo.png" alt="logo">
    <div class="loader__progress">
        <div class="loader__progress-line" id="progressLine"></div>
    </div>
</div>
\`\`\`

### 4. CONFIG OBJECT (ALWAYS AT TOP OF SCRIPT)
\`\`\`javascript
const CONFIG = {
    winSector: 1,  // Which sector wins
    prizes: ['1500€', '100€', '50€', '25€', '10€', '100€', '50€', '25€'],
    offerUrl: '{{OFFER_URL}}',  // Will be replaced
    useSound: true
};
\`\`\`

### 5. SOUND INTEGRATION
\`\`\`javascript
const sounds = {
    spin: new Audio('sounds/spin.mp3'),
    win: new Audio('sounds/win.mp3')
};
function playSound(name) {
    if (!CONFIG.useSound) return;
    try { sounds[name].currentTime = 0; sounds[name].play().catch(() => {}); } catch(e) {}
}
\`\`\`

### 6. WIN MODAL WITH REDIRECT
After win animation, show modal then redirect:
\`\`\`javascript
function showModal() {
    modal.classList.add('is--active');
    document.body.classList.add('is--modal-open');
    // Auto-redirect after 3 seconds
    setTimeout(() => {
        const urlParams = window.location.search || '';
        window.location.href = CONFIG.offerUrl + urlParams;
    }, 3000);
}
\`\`\`

### 7. PROTECTION CODE (ALWAYS INCLUDE)
\`\`\`javascript
// Block right-click, selection, DevTools
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('selectstart', e => e.preventDefault());
document.addEventListener('keydown', e => {
    if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['I','J','C'].includes(e.key)) || (e.ctrlKey && e.key === 'u')) {
        e.preventDefault();
    }
});
\`\`\`

### 8. CSS STRUCTURE (FOLLOW THIS PATTERN)
\`\`\`css
/* Reset */
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { height: 100%; scroll-behavior: smooth; }

/* Body wrapper with background */
.body-wrapper {
    position: relative;
    display: flex;
    min-height: 100vh;
    overflow: hidden;
    background-repeat: no-repeat;
    background-position: center;
    background-size: cover;
    background-image: url('assets/background.png');
}

/* Container with flex centering */
.container-wrap { display: flex; flex: 1 1 auto; flex-direction: column; justify-content: center; width: 100%; }
.container { position: relative; display: flex; flex: 1 1 auto; flex-direction: column; justify-content: center; width: 100%; padding: 0 16px; overflow: hidden; }

/* Logo animation */
.logo { position: relative; z-index: 7; display: block; width: 90em; margin: 0 auto; animation: 2s scaleLogo ease-in-out infinite; }
@keyframes scaleLogo { 0%, 100% { transform: scale(0.9); } 50% { transform: scale(1); } }

/* Button with pulse */
.button {
    display: flex; align-items: center; justify-content: center;
    padding: 1em 3em; border: none; border-radius: 1em;
    font-weight: 900; font-size: 4em; text-transform: uppercase;
    cursor: pointer; animation: 2s pulseButton ease-in-out infinite;
}
@keyframes pulseButton { 0%, 65%, 100% { transform: rotate(-4deg); } 15%, 50% { transform: rotate(4deg); } }
\`\`\`

### 9. WHEEL GAME SPECIFIC
For wheel games, use this structure:
- 8 sectors with configurable prizes
- CSS keyframe animations for each winning sector (spinTo1-spinTo8)
- Wheel frame image overlaying wheel
- Pointer/arrow at top
- Central spin button

### 10. CRASH/CHICKEN ROAD GAME SPECIFIC
For crash games:
- Grid of cells (e.g., 5 columns, 5 rows)
- Character that advances row by row
- Each row shows safe/danger cells after selection
- Player always wins (predetermined safe path)
- Multiplier display that increases with each successful step

## QUALITY CHECKLIST:
✓ All CSS inline in <style> tag
✓ All JS inline in <script> tag
✓ Responsive (em units, media queries)
✓ Loader with progress
✓ CONFIG object with offerUrl
✓ Sound integration
✓ Win modal with auto-redirect
✓ Protection code
✓ Mobile-first design
✓ Smooth animations
✓ Touch events for mobile
✓ No console errors
✓ Background image fills screen
✓ All assets used from provided paths

Return ONLY the HTML code, no explanations or markdown code blocks.`;

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

  log.info('Claude: Analyzing request with Extended Thinking (v0.dev-style prompts)', { promptLength: prompt.length, hasScreenshot: !!screenshotBase64 });

  try {
    // Use 2025-2026 best practices: XML-structured system prompt
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      // Enable Extended Thinking for better analysis (Chain-of-Thought)
      thinking: {
        type: 'enabled',
        budget_tokens: THINKING_BUDGET
      },
      system: ANALYSIS_SYSTEM_PROMPT,
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
 * Uses RLHF-style learning: prioritizes top-rated examples for better quality
 * @param {Object} spec - Game specification from analysis
 * @param {Object} assets - Generated asset paths
 * @param {Object} colors - Color palette
 * @returns {Promise<{html: string, validation: Object, examplesUsed: Array}>} HTML code, validation result, and examples used
 */
export async function generateLandingCode(spec, assets, colors) {
  const client = getClient();
  const examplesUsed = [];

  // LEARNING SYSTEM: Try to get TOP-RATED examples from database first
  // This is the key to "learning" - high-rated landings become examples
  let dbExamples = null;
  try {
    dbExamples = await ratingService.getBestExamplesForMechanic(spec.mechanicType, 2);
    if (dbExamples && dbExamples.length > 0) {
      log.info('Claude: Using top-rated examples from feedback system', {
        count: dbExamples.length,
        ratings: dbExamples.map(e => e.avg_rating)
      });
      for (const ex of dbExamples) {
        examplesUsed.push(ex.id);
        // Mark example as used for tracking
        await ratingService.markExampleUsed(ex.id).catch(() => {});
      }
    }
  } catch (e) {
    log.warn('Could not load DB examples', { error: e.message });
  }

  // 2025-2026 Best Practice: Use structured v0.dev-style prompts with examples
  // Build system prompt with examples using semantic similarity approach
  let systemPrompt;

  if (dbExamples && dbExamples.length > 0) {
    // Use v0.dev-style XML-structured prompt with top-rated examples
    systemPrompt = buildSystemPromptWithExamples(dbExamples, spec.mechanicType);
    log.info('Claude: Using v0.dev-style prompt with DB examples', {
      exampleCount: dbExamples.length,
      avgRating: dbExamples.reduce((sum, e) => sum + (e.avg_rating || 5), 0) / dbExamples.length
    });
  } else {
    // Try filesystem examples as fallback
    try {
      const fsExamples = await buildPromptWithExamples(spec.mechanicType, 1);
      if (fsExamples) {
        // Combine v0.dev base prompt with filesystem examples
        systemPrompt = CODE_GENERATION_SYSTEM_PROMPT + '\n\n' + fsExamples;
        log.info('Claude: Using v0.dev-style prompt with filesystem examples');
      } else {
        // Pure v0.dev-style prompt without examples
        systemPrompt = CODE_GENERATION_SYSTEM_PROMPT;
        log.info('Claude: Using pure v0.dev-style prompt (no examples)');
      }
    } catch (e) {
      log.warn('Could not load filesystem examples', { error: e.message });
      systemPrompt = CODE_GENERATION_SYSTEM_PROMPT;
    }
  }

  // Build user prompt using structured XML format (v0.dev best practice)
  const prompt = buildCodeGenerationUserPrompt(spec, assets, colors);

  log.info('Claude: Generating landing code with learning system', {
    mechanicType: spec.mechanicType,
    slotName: spec.slotName,
    hasDbExamples: !!(dbExamples && dbExamples.length > 0),
    examplesUsed
  });

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }]
    });

    let html = response.content[0]?.text || '';

    // Clean up if wrapped in markdown code blocks
    html = html.replace(/^```html?\n?/i, '').replace(/\n?```$/i, '');

    // Validate generated HTML
    const validation = validateGeneratedHtml(html);

    log.info('Claude: Code generation complete', {
      htmlLength: html.length,
      valid: validation.valid,
      score: validation.score,
      issues: validation.issues
    });

    return { html, validation, examplesUsed };
  } catch (error) {
    log.error('Claude: Code generation failed', { error: error.message });
    throw error;
  }
}

/**
 * Stream code generation for real-time updates
 * Uses RLHF-style learning: prioritizes top-rated examples
 * @param {Object} spec - Game specification
 * @param {Object} assets - Asset paths
 * @param {Object} colors - Color palette
 * @param {Function} onChunk - Callback for each chunk
 * @returns {Promise<{html: string, validation: Object, examplesUsed: Array}>} HTML, validation, and examples used
 */
export async function generateLandingCodeStream(spec, assets, colors, onChunk) {
  const client = getClient();
  const examplesUsed = [];

  // LEARNING SYSTEM: Try to get TOP-RATED examples from database first
  let dbExamples = null;
  try {
    dbExamples = await ratingService.getBestExamplesForMechanic(spec.mechanicType, 2);
    if (dbExamples && dbExamples.length > 0) {
      for (const ex of dbExamples) {
        examplesUsed.push(ex.id);
        await ratingService.markExampleUsed(ex.id).catch(() => {});
      }
    }
  } catch (e) {
    log.warn('Could not load DB examples', { error: e.message });
  }

  // 2025-2026 Best Practice: Use v0.dev-style XML-structured prompts
  let systemPrompt;

  if (dbExamples && dbExamples.length > 0) {
    systemPrompt = buildSystemPromptWithExamples(dbExamples, spec.mechanicType);
  } else {
    try {
      const fsExamples = await buildPromptWithExamples(spec.mechanicType, 1);
      systemPrompt = fsExamples
        ? CODE_GENERATION_SYSTEM_PROMPT + '\n\n' + fsExamples
        : CODE_GENERATION_SYSTEM_PROMPT;
    } catch (e) {
      log.warn('Could not load filesystem examples', { error: e.message });
      systemPrompt = CODE_GENERATION_SYSTEM_PROMPT;
    }
  }

  // Use structured XML user prompt (v0.dev best practice)
  const prompt = buildCodeGenerationUserPrompt(spec, assets, colors);

  log.info('Claude: Starting streaming with learning system', {
    mechanicType: spec.mechanicType,
    hasDbExamples: !!(dbExamples && dbExamples.length > 0)
  });

  let html = '';

  try {
    const stream = await client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
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

    // Validate generated HTML
    const validation = validateGeneratedHtml(html);

    log.info('Claude: Streaming complete', {
      htmlLength: html.length,
      valid: validation.valid,
      score: validation.score
    });

    return { html, validation, examplesUsed };
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

// NOTE: buildCodeGenerationPrompt and buildAdaptiveMechanicPrompt were removed
// We now use v0.dev-style XML prompts from ./prompts/landing-system-prompt.js

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
