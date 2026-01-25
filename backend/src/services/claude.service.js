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
      system: LANDING_CODE_SYSTEM_PROMPT,
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
      system: LANDING_CODE_SYSTEM_PROMPT,
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
  // Build asset paths with correct format
  const assetPaths = Object.entries(assets || {}).map(([key, asset]) => {
    // Extract just the filename for the asset path
    const assetPath = typeof asset === 'string' ? asset : (asset.url || asset.path || `assets/${key}.png`);
    // Normalize to assets/ folder for the final HTML
    const normalizedPath = assetPath.includes('assets/') ? assetPath : `assets/${key}.png`;
    return `- ${key}: "${normalizedPath}" (use this EXACT path in HTML)`;
  }).join('\n');

  const mechanicPrompts = {
    wheel: `
## WHEEL GAME REQUIREMENTS:
- 8 sectors wheel with configurable prizes
- Wheel spins and stops on winning sector (sector 1 = main prize)
- Use CSS keyframe animations: @keyframes spinTo1, spinTo2, etc.
- Include wheel frame overlay for visual depth
- Pointer/arrow at top pointing to winning sector
- Central "SPIN" button
- Prize text visible on sectors
- Vibrate on mobile when spinning (if supported)`,
    crash: `
## CRASH/CHICKEN ROAD GAME REQUIREMENTS:
- Grid layout: 5 columns x 5 rows of cells
- Character starts at bottom, advances up row by row
- Player clicks on a cell in each row to advance
- After clicking, reveal safe/danger cells (player always picks safe)
- Multiplier increases: x1.2 → x1.5 → x2 → x3 → x5
- Character animation when moving
- Show "WIN" modal after completing all rows
- Use cell images for default/active/danger states`,
    boxes: `
## GIFT BOX GAME REQUIREMENTS:
- 3-5 gift boxes displayed
- Player selects one box
- Box opens with animation
- Prize revealed
- Other boxes show "empty" or smaller prizes
- Win celebration effect (confetti/coins)`,
    loader: `
## LOADER/PRELANDER REQUIREMENTS:
- Progress bar filling to 100%
- "Checking bonus..." or similar text
- Auto-redirect after completion
- Logo and branding visible`
  };

  return `Generate a complete ${spec.mechanicType.toUpperCase()} landing page.

## BRAND/SLOT: "${spec.slotName || 'Fortune Casino'}"

## PRIZES TO SHOW: ${JSON.stringify(spec.prizes || ['€1500', '€500', '€200', '€100', '€50', '100 FS', '50 FS', '25 FS'])}

## LANGUAGE: ${spec.language || 'en'} (use this language for ALL text)

## OFFER URL: "${spec.offerUrl || '{{OFFER_URL}}'}" (redirect here after win)

## COLOR PALETTE (USE THESE COLORS):
- Primary (gold/accent): ${colors?.primary || '#FFD700'}
- Secondary (text/elements): ${colors?.secondary || '#1E3A5F'}
- Accent (buttons/highlights): ${colors?.accent || '#FF6B6B'}
- Background: ${colors?.background || '#0D1117'}

## ASSETS PROVIDED (USE EXACT PATHS):
${assetPaths || '- background: "assets/background.png"\n- logo: "assets/logo.png"'}

## SOUNDS (INCLUDE IN CONFIG):
- sounds/spin.mp3 (for spinning/action)
- sounds/win.mp3 (for win celebration)
${mechanicPrompts[spec.mechanicType] || mechanicPrompts.wheel}

## IMPORTANT REMINDERS:
1. Use em/rem units, NOT px for sizes (responsive!)
2. Include loader with progress bar at start
3. CONFIG object with offerUrl at top of script
4. Player ALWAYS wins (rigged)
5. Auto-redirect 3s after showing win modal
6. Add protection code (block right-click, F12)
7. Background image should cover full screen
8. Include all animations inline
9. Mobile-first responsive design
10. Use provided asset paths EXACTLY`;
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
