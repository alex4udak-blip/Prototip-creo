import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/env.js';
import { log } from '../utils/logger.js';
import { buildExampleBasedPrompt, getExampleForMechanic } from './landing-examples.js';

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
  "slotName": "extracted or inferred slot/brand name",
  "isRealSlot": true/false (if it's a known casino/slot game),
  "mechanicType": "descriptive type - can be standard (wheel, boxes, crash, slot) OR custom description based on what user wants",
  "mechanicDescription": "detailed description of how the game should work",
  "prizes": ["prize1", "prize2", ...] (extract from request or generate appropriate ones),
  "language": "detected language code (en, de, es, ru, etc.)",
  "theme": "visual theme description (colors, mood, style)",
  "style": "art style (cartoon, realistic, neon, dark, bright, etc.)",
  "offerUrl": "extracted URL or null",
  "assetsNeeded": [
    { "type": "background|character|element|logo", "description": "detailed description of what to generate" }
  ],
  "soundsNeeded": ["spin", "win", "click"],
  "confidence": 0-100
}

IMPORTANT: For mechanicType, don't limit yourself to predefined types!
- If user asks for "wheel" or "колесо фортуны" → mechanicType: "wheel"
- If user asks for "Chicken Road" or "crash game" → mechanicType: "crash"
- If user asks for "Aviator style" → mechanicType: "aviator"
- If user asks for "plinko" → mechanicType: "plinko"
- If user describes something custom → mechanicType: brief descriptive name

The mechanicDescription field should contain a clear explanation of how the game works, so code generation can implement it correctly.`,
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
 * Uses example-based prompting for higher quality output
 * @param {Object} spec - Game specification from analysis
 * @param {Object} assets - Generated asset paths
 * @param {Object} colors - Color palette
 * @returns {Promise<string>} Complete HTML code
 */
export async function generateLandingCode(spec, assets, colors) {
  const client = getClient();

  // Build example-based system prompt for this mechanic type
  const systemPrompt = buildExampleBasedPrompt(spec.mechanicType);
  const prompt = buildCodeGenerationPrompt(spec, assets, colors);

  log.info('Claude: Generating landing code with examples', {
    mechanicType: spec.mechanicType,
    slotName: spec.slotName,
    exampleType: getExampleForMechanic(spec.mechanicType).type
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

    log.info('Claude: Code generation complete', { htmlLength: html.length });

    return html;
  } catch (error) {
    log.error('Claude: Code generation failed', { error: error.message });
    throw error;
  }
}

/**
 * Stream code generation for real-time updates
 * Uses example-based prompting for higher quality output
 * @param {Object} spec - Game specification
 * @param {Object} assets - Asset paths
 * @param {Object} colors - Color palette
 * @param {Function} onChunk - Callback for each chunk
 * @returns {Promise<string>} Complete HTML
 */
export async function generateLandingCodeStream(spec, assets, colors, onChunk) {
  const client = getClient();

  // Build example-based system prompt for this mechanic type
  const systemPrompt = buildExampleBasedPrompt(spec.mechanicType);
  const prompt = buildCodeGenerationPrompt(spec, assets, colors);

  log.info('Claude: Starting streaming code generation with examples', {
    mechanicType: spec.mechanicType,
    exampleType: getExampleForMechanic(spec.mechanicType).type
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
 * This function creates ADAPTIVE prompts based on the mechanic type
 * and user's original description, NOT hardcoded examples
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

  // Use mechanicDescription from analysis if available, otherwise build adaptive prompt
  const mechanicDescription = spec.mechanicDescription
    ? `## GAME MECHANIC REQUIREMENTS:\n${spec.mechanicDescription}`
    : buildAdaptiveMechanicPrompt(spec);

  return `Generate a complete landing page for this game:

## BRAND/SLOT: "${spec.slotName || 'Fortune Casino'}"

## GAME TYPE: ${spec.mechanicType}
${spec.theme ? `## THEME: ${spec.theme}` : ''}
${spec.style ? `## STYLE: ${spec.style}` : ''}

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

${mechanicDescription}

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
 * Build adaptive mechanic prompt based on the game type
 * This function generates INTELLIGENT descriptions for ANY mechanic,
 * not just predefined ones
 */
function buildAdaptiveMechanicPrompt(spec) {
  const mechanicType = (spec.mechanicType || '').toLowerCase();
  const theme = spec.theme || '';
  const style = spec.style || '';

  // Core game patterns - adaptable templates
  const corePatterns = {
    // Spinning/rotation based games
    spinBased: ['wheel', 'fortune', 'roulette', 'spinner', 'spin'],
    // Selection/picking games
    selectionBased: ['box', 'gift', 'pick', 'choose', 'card', 'chest', 'treasure'],
    // Grid/progression games
    gridBased: ['crash', 'chicken', 'road', 'mines', 'minefield', 'grid', 'step', 'climb', 'tower'],
    // Reveal games
    revealBased: ['scratch', 'reveal', 'scratchcard', 'lottery'],
    // Slot/reel games
    slotBased: ['slot', 'machine', 'reel', 'jackpot', 'fruit'],
    // Progress/loading games
    progressBased: ['loader', 'loading', 'progress', 'preland', 'check'],
    // Board/dice games
    boardBased: ['board', 'dice', 'monopoly', 'path', 'journey'],
    // Aviation/crash betting style
    aviatorBased: ['aviator', 'plane', 'fly', 'rocket', 'crash-bet', 'multiplier'],
    // Plinko/ball drop
    plinkoBased: ['plinko', 'pachinko', 'ball', 'drop', 'bounce'],
    // Memory games
    memoryBased: ['memory', 'match', 'flip', 'pairs']
  };

  // Detect which pattern matches
  const matchPattern = (patterns) => {
    return patterns.some(p => mechanicType.includes(p) || theme.toLowerCase().includes(p));
  };

  // Generate adaptive instructions
  let instructions = `## GAME MECHANIC REQUIREMENTS:\n`;

  if (matchPattern(corePatterns.spinBased)) {
    instructions += `
This is a SPINNING game (wheel/fortune style):
- Create a circular wheel divided into sectors (6-12 sectors work best)
- Each sector shows a prize from the prizes list
- Wheel spins with CSS animation and stops on the winning sector
- Include a pointer/arrow indicating the winning position
- Add a prominent SPIN button
- Use rotation animations with easing for realistic feel
- The main prize should be in the designated winning sector
- Vibrate device on spin (if supported)
- Play spin sound during rotation, win sound on stop`;
  } else if (matchPattern(corePatterns.selectionBased)) {
    instructions += `
This is a SELECTION game (gift box/card pick style):
- Display 3-5 selectable items (boxes, cards, chests, etc.)
- Each item has closed/open states
- Player taps one item to select
- Selected item opens with animation to reveal the main prize
- Other items reveal smaller/no prizes
- Add celebration effect (confetti, sparkles, coins)
- Include "YOU WON!" celebration screen
- Play click sound on selection, win sound on reveal`;
  } else if (matchPattern(corePatterns.gridBased)) {
    instructions += `
This is a GRID/PROGRESSION game (chicken road/mines style):
- Create a grid of cells (typically 5x5 or similar)
- Character/player starts at one edge
- Player advances by selecting cells in each row/column
- After selection, reveal safe/danger cells (player ALWAYS picks safe)
- Show multiplier increasing with each successful step (x1.2 → x1.5 → x2 → x3 → x5+)
- Character moves with animation
- Complete game shows final multiplier and win modal
- Play step sound on each move, win sound on completion`;
  } else if (matchPattern(corePatterns.aviatorBased)) {
    instructions += `
This is an AVIATOR/MULTIPLIER game (crash betting style):
- Show a flying object (plane, rocket) that rises up
- Multiplier counter increases as object rises (1.00x → 2.00x → 5.00x → etc.)
- Player has a "CASH OUT" button
- Object eventually "crashes" but player always cashes out before crash
- Create tension with increasing speed
- Show win amount based on multiplier × bet
- Use smooth animations for flight path
- Play engine/rise sound during flight, win sound on cashout`;
  } else if (matchPattern(corePatterns.plinkoBased)) {
    instructions += `
This is a PLINKO/DROP game:
- Show a triangular field with pegs/obstacles
- Ball drops from top and bounces through pegs
- Bottom has prize slots with different values
- Ball always lands in the highest prize slot
- Use physics-like animation for ball bouncing
- Show prize amounts at bottom slots
- Celebrate when ball lands in winner slot
- Play bounce sounds, win sound on landing`;
  } else if (matchPattern(corePatterns.revealBased)) {
    instructions += `
This is a SCRATCH/REVEAL game:
- Create scratchable areas covering prizes
- Use canvas or CSS for scratch effect
- Player scratches to reveal symbols/prizes
- Matching symbols = WIN (always happens)
- Show celebration when winning combination revealed
- Include progress indicator for scratch completion
- Play scratch sound during interaction, win sound on reveal`;
  } else if (matchPattern(corePatterns.slotBased)) {
    instructions += `
This is a SLOT MACHINE game:
- Show 3 or more reels with symbols
- Each reel spins independently with staggered stops
- Reels stop to show winning combination
- Highlight winning line with animation
- Include lever or SPIN button
- Add jackpot celebration effect
- Play reel spin sound, win sound on jackpot`;
  } else if (matchPattern(corePatterns.progressBased)) {
    instructions += `
This is a LOADER/PRELANDER:
- Show progress bar filling from 0% to 100%
- Include loading messages (checking bonus, verifying, etc.)
- Display logo and brand elements prominently
- Auto-redirect to offer after completion
- Add subtle animations during loading
- Optional: show "bonus found" message at end`;
  } else if (matchPattern(corePatterns.boardBased)) {
    instructions += `
This is a BOARD/DICE game:
- Create a path/board with numbered positions
- Player has token that moves along path
- Dice roll determines movement
- Landing spots show prizes or actions
- Player always lands on winning spot eventually
- Include animated dice roll
- Show celebration at finish/prize`;
  } else if (matchPattern(corePatterns.memoryBased)) {
    instructions += `
This is a MEMORY/MATCH game:
- Grid of face-down cards/tiles
- Player flips two cards at a time
- Matching pairs stay revealed
- Game is rigged so matches are easy/guaranteed
- Reveal bonus prize after completing matches
- Include flip animations
- Play flip sound, match sound, win sound`;
  } else {
    // FULLY ADAPTIVE - describe based on available information
    instructions += `
Create a "${mechanicType}" game based on these characteristics:
${theme ? `- Theme/Style: ${theme}` : ''}
${style ? `- Visual approach: ${style}` : ''}

General requirements for ANY game mechanic:
- Clear call-to-action button to start game
- Interactive element that player engages with
- Visual feedback for player actions
- Progress/completion indicator
- Guaranteed win state (game is rigged for marketing)
- Celebration/win screen with prize display
- Smooth animations throughout
- Sound effects for actions and win

Design the game logic so that:
1. Player interaction is intuitive
2. There's visual excitement/anticipation
3. The win feels rewarding
4. Mobile touch events are handled
5. The game completes within 5-15 seconds typically`;
  }

  return instructions;
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
