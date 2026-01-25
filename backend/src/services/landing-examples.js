/**
 * Production-quality landing page code examples
 * These are extracted from real, working landing pages
 * Claude uses these as reference for generating new landings
 */

/**
 * Core HTML structure that ALL landings must follow
 */
export const CORE_HTML_STRUCTURE = `<!DOCTYPE html>
<html lang="{{LANGUAGE}}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, user-scalable=no, initial-scale=0.9, maximum-scale=0.9, minimum-scale=0.9, viewport-fit=cover">
    <meta name="theme-color" content="{{THEME_COLOR}}">
    <title>{{SLOT_NAME}}</title>
    <style>
        /* CSS HERE */
    </style>
</head>
<body>
    <!-- LOADER -->
    <div class="loader" id="loader">
        <img class="loader__logo" src="assets/logo.png" alt="logo">
        <div class="loader__progress">
            <div class="loader__progress-line" id="progressLine"></div>
        </div>
    </div>

    <!-- MAIN CONTENT -->
    <div class="body-wrapper">
        <!-- GAME CONTENT HERE -->
    </div>

    <!-- WIN MODAL -->
    <div class="modal" id="modal">
        <!-- MODAL CONTENT HERE -->
    </div>

    <script>
        // CONFIG (ALWAYS AT TOP)
        const CONFIG = {
            offerUrl: '{{OFFER_URL}}',
            useSound: true
            // game-specific config here
        };

        // SOUNDS
        const sounds = {
            spin: new Audio('sounds/spin.mp3'),
            win: new Audio('sounds/win.mp3')
        };

        function playSound(name) {
            if (!CONFIG.useSound) return;
            try { sounds[name].currentTime = 0; sounds[name].play().catch(() => {}); } catch(e) {}
        }

        // PROTECTION
        document.addEventListener('contextmenu', e => e.preventDefault());
        document.addEventListener('selectstart', e => e.preventDefault());
        document.addEventListener('keydown', e => {
            if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['I','J','C'].includes(e.key)) || (e.ctrlKey && e.key === 'u')) {
                e.preventDefault();
            }
        });

        // GAME LOGIC HERE
    </script>
</body>
</html>`;

/**
 * Core CSS patterns used in ALL landings
 */
export const CORE_CSS = `
/* === RESET === */
* { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; user-select: none; }
html, body { height: 100%; scroll-behavior: smooth; }

/* === RESPONSIVE BASE === */
html { font-size: min(4.5px + 5.5*(100vw - 375px)/1545, 10px); }
@media(min-width: 1024px) { html { font-size: clamp(5px, 0.85vh, 10px) !important; } }
body { font-size: 80%; font-family: 'Roboto', sans-serif; }
@media(max-width: 1023px) { body { font-size: 110%; } }

/* === LOADER === */
.loader {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    background: linear-gradient(180deg, #1a1a2e 0%, #0a0a15 100%);
}
.loader.is--loaded { display: none; }
.loader__logo { max-width: 300px; width: 80%; margin-bottom: 30px; }
.loader__progress {
    width: 80%;
    max-width: 300px;
    height: 20px;
    background: rgba(255,255,255,0.1);
    border-radius: 10px;
    overflow: hidden;
}
.loader__progress-line {
    width: 0%;
    height: 100%;
    background: linear-gradient(90deg, #ff6600, #ffd700);
    border-radius: 10px;
    transition: width 0.3s ease;
}

/* === BODY WRAPPER === */
.body-wrapper {
    position: relative;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background-image: url('assets/background.png');
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
}

/* === MODAL === */
.modal {
    position: fixed;
    inset: 0;
    display: none;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    background: rgba(0,0,0,0.9);
}
.modal.is--active { display: flex; }
.modal__content {
    background: linear-gradient(180deg, #1a1a2e 0%, #0a0a15 100%);
    border: 3px solid #ffd700;
    border-radius: 20px;
    padding: 30px;
    text-align: center;
    max-width: 90%;
    animation: modalIn 0.5s ease;
}
@keyframes modalIn {
    from { opacity: 0; transform: scale(0.8); }
    to { opacity: 1; transform: scale(1); }
}

/* === BUTTON === */
.button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 1.5em 4em;
    background: linear-gradient(180deg, #ff6600 0%, #cc5500 100%);
    border: none;
    border-radius: 1em;
    font-size: 2em;
    font-weight: 900;
    color: white;
    text-transform: uppercase;
    cursor: pointer;
    box-shadow: 0 6px 0 #993300, 0 10px 30px rgba(255,102,0,0.4);
    transition: transform 0.1s;
    animation: pulse 1.5s ease-in-out infinite;
}
.button:active { transform: translateY(4px); box-shadow: 0 2px 0 #993300; }
@keyframes pulse {
    0%, 100% { box-shadow: 0 6px 0 #993300, 0 10px 30px rgba(255,102,0,0.4); }
    50% { box-shadow: 0 6px 0 #993300, 0 10px 50px rgba(255,102,0,0.7); }
}
`;

/**
 * WHEEL game example - complete working code
 */
export const WHEEL_EXAMPLE = {
  type: 'wheel',
  description: 'Fortune wheel with 8 sectors, spin animation, win modal',
  html: `
<div class="wheel-container">
    <div class="wheel" id="wheel">
        <div class="wheel__sectors">
            <!-- 8 sectors with prizes -->
        </div>
    </div>
    <div class="wheel__pointer"></div>
    <button class="wheel__spin-btn" id="spinBtn">SPIN</button>
</div>
`,
  css: `
.wheel-container {
    position: relative;
    width: 90vw;
    max-width: 400px;
    margin: 0 auto;
}
.wheel {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    border-radius: 50%;
    overflow: hidden;
}
.wheel__sectors {
    position: absolute;
    inset: 0;
    background: url('assets/wheel.png') center/contain no-repeat;
    transition: transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99);
}
.wheel__pointer {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%) translateY(-20%);
    width: 15%;
    height: 15%;
    background: url('assets/pointer.png') center/contain no-repeat;
    z-index: 10;
}
.wheel__spin-btn {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 25%;
    height: 25%;
    border-radius: 50%;
    background: linear-gradient(180deg, #ffd700 0%, #ff9900 100%);
    border: 4px solid #fff;
    font-size: 2em;
    font-weight: 900;
    color: #333;
    cursor: pointer;
    z-index: 20;
}

/* Spin animations for each winning sector */
@keyframes spinTo1 { to { transform: rotate(1800deg); } }
@keyframes spinTo2 { to { transform: rotate(1845deg); } }
@keyframes spinTo3 { to { transform: rotate(1890deg); } }
@keyframes spinTo4 { to { transform: rotate(1935deg); } }
@keyframes spinTo5 { to { transform: rotate(1980deg); } }
@keyframes spinTo6 { to { transform: rotate(2025deg); } }
@keyframes spinTo7 { to { transform: rotate(2070deg); } }
@keyframes spinTo8 { to { transform: rotate(2115deg); } }
`,
  js: `
const wheel = document.querySelector('.wheel__sectors');
const spinBtn = document.getElementById('spinBtn');
let isSpinning = false;

spinBtn.addEventListener('click', () => {
    if (isSpinning) return;
    isSpinning = true;
    spinBtn.disabled = true;

    playSound('spin');

    // Always win sector 1 (main prize)
    wheel.style.animation = 'spinTo1 4s cubic-bezier(0.17, 0.67, 0.12, 0.99) forwards';

    setTimeout(() => {
        playSound('win');
        showModal();
    }, 4500);
});

function showModal() {
    document.getElementById('modal').classList.add('is--active');
    setTimeout(() => {
        window.location.href = CONFIG.offerUrl + window.location.search;
    }, 3000);
}
`
};

/**
 * BOXES game example - gift box selection
 */
export const BOXES_EXAMPLE = {
  type: 'boxes',
  description: 'Gift box selection game with shake animation, reward popups',
  html: `
<div class="boxes-area">
    <div class="boxes-container" id="boxesContainer">
        <!-- Boxes generated by JS -->
    </div>
</div>
`,
  css: `
.boxes-area {
    padding: 20px;
}
.boxes-container {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 15px;
    max-width: 400px;
    margin: 0 auto;
}
.box {
    position: relative;
    width: 80px;
    height: 80px;
    cursor: pointer;
    transition: transform 0.3s;
}
.box img {
    width: 100%;
    height: 100%;
    object-fit: contain;
}
.box img.open { display: none; }
.box.opened img.closed { display: none; }
.box.opened img.open { display: block; }
.box:not(.opened):hover { transform: scale(1.1); }

@keyframes shake {
    0%, 100% { transform: rotate(0); }
    25% { transform: rotate(-10deg); }
    75% { transform: rotate(10deg); }
}
.box.shaking { animation: shake 0.5s ease; }

.box-reward {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    background: #1a1a2e;
    border: 2px solid #ffd700;
    border-radius: 10px;
    padding: 8px 12px;
    white-space: nowrap;
    opacity: 0;
    animation: rewardPop 0.5s ease forwards;
}
@keyframes rewardPop {
    0% { opacity: 0; transform: translateX(-50%) translateY(20px) scale(0); }
    100% { opacity: 1; transform: translateX(-50%) translateY(-10px) scale(1); }
}
`,
  js: `
const container = document.getElementById('boxesContainer');
const rewards = [
    { cash: 500, fs: 100 },
    { cash: 600, fs: 50 },
    { cash: 400, fs: 100 }
];
let opened = 0;
const requiredBoxes = 3;

// Create 9 boxes
for (let i = 0; i < 9; i++) {
    const box = document.createElement('button');
    box.className = 'box';
    box.innerHTML = \`
        <img src="assets/box-closed.png" class="closed" alt="">
        <img src="assets/box-open.png" class="open" alt="">
    \`;
    box.onclick = () => openBox(box);
    container.appendChild(box);
}

function openBox(box) {
    if (box.classList.contains('opened') || opened >= requiredBoxes) return;

    box.classList.add('shaking');
    playSound('spin');

    setTimeout(() => {
        box.classList.remove('shaking');
        box.classList.add('opened');

        const reward = rewards[opened];
        showReward(box, reward);
        opened++;

        if (opened >= requiredBoxes) {
            setTimeout(() => {
                playSound('win');
                showModal();
            }, 1000);
        }
    }, 500);
}

function showReward(box, reward) {
    const popup = document.createElement('div');
    popup.className = 'box-reward';
    popup.innerHTML = \`<span style="color:#00ff88">+€\${reward.cash}</span> + <span style="color:#00d4ff">\${reward.fs} FS</span>\`;
    box.appendChild(popup);
    setTimeout(() => popup.remove(), 2000);
}
`
};

/**
 * CRASH/CHICKEN ROAD game example
 */
export const CRASH_EXAMPLE = {
  type: 'crash',
  description: 'Grid-based progression game, character advances avoiding dangers',
  html: `
<div class="game-area">
    <div class="multiplier" id="multiplier">x1.00</div>
    <div class="grid" id="grid">
        <!-- 5x5 grid generated by JS -->
    </div>
    <div class="character" id="character">
        <img src="assets/character.png" alt="">
    </div>
</div>
`,
  css: `
.game-area {
    position: relative;
    padding: 20px;
    max-width: 400px;
    margin: 0 auto;
}
.multiplier {
    text-align: center;
    font-size: 3em;
    font-weight: 900;
    color: #ffd700;
    text-shadow: 0 0 20px rgba(255,215,0,0.5);
    margin-bottom: 20px;
}
.grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 8px;
}
.cell {
    aspect-ratio: 1;
    background: rgba(255,255,255,0.1);
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.3s;
}
.cell:hover:not(.revealed) { background: rgba(255,255,255,0.2); }
.cell.safe { background: linear-gradient(180deg, #00ff88, #00aa55); }
.cell.danger { background: linear-gradient(180deg, #ff4444, #aa0000); }
.cell.selected { border: 3px solid #ffd700; }
.character {
    position: absolute;
    width: 60px;
    height: 60px;
    transition: all 0.3s ease;
    z-index: 10;
}
.character img { width: 100%; height: 100%; }
`,
  js: `
const grid = document.getElementById('grid');
const multiplierEl = document.getElementById('multiplier');
const character = document.getElementById('character');

const multipliers = [1.2, 1.5, 2.0, 3.0, 5.0];
let currentRow = 4; // Start at bottom
let currentMultiplier = 1.0;

// Create 5x5 grid
for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.row = row;
        cell.dataset.col = col;
        cell.onclick = () => selectCell(cell, row, col);
        grid.appendChild(cell);
    }
}

// Predetermined safe path (player always wins)
const safePath = [2, 1, 3, 2, 1]; // Column for each row

function selectCell(cell, row, col) {
    if (row !== currentRow) return; // Can only select current row

    cell.classList.add('selected');
    playSound('spin');

    // Reveal row - selected is always safe
    const rowCells = grid.querySelectorAll(\`[data-row="\${row}"]\`);
    rowCells.forEach((c, i) => {
        c.classList.add('revealed');
        if (i === col) {
            c.classList.add('safe');
        } else if (Math.random() > 0.6) {
            c.classList.add('danger');
        } else {
            c.classList.add('safe');
        }
    });

    // Update multiplier
    currentMultiplier = multipliers[4 - row] || 5.0;
    multiplierEl.textContent = \`x\${currentMultiplier.toFixed(2)}\`;

    // Move character up
    moveCharacter(row - 1, col);
    currentRow--;

    if (currentRow < 0) {
        setTimeout(() => {
            playSound('win');
            showModal();
        }, 500);
    }
}

function moveCharacter(row, col) {
    const cellSize = grid.offsetWidth / 5;
    character.style.left = \`\${col * cellSize + cellSize/2 - 30}px\`;
    character.style.top = \`\${row * cellSize + cellSize/2 - 30}px\`;
}
`
};

/**
 * Get code example for a specific mechanic type
 */
export function getExampleForMechanic(mechanicType) {
  const type = (mechanicType || '').toLowerCase();

  if (type.includes('wheel') || type.includes('spin') || type.includes('fortune') || type.includes('roulette')) {
    return WHEEL_EXAMPLE;
  }

  if (type.includes('box') || type.includes('gift') || type.includes('chest') || type.includes('pick')) {
    return BOXES_EXAMPLE;
  }

  if (type.includes('crash') || type.includes('chicken') || type.includes('road') || type.includes('grid') || type.includes('mines')) {
    return CRASH_EXAMPLE;
  }

  // Default to wheel for unknown types
  return WHEEL_EXAMPLE;
}

/**
 * Build a complete system prompt with examples
 */
export function buildExampleBasedPrompt(mechanicType) {
  const example = getExampleForMechanic(mechanicType);

  return `You are an expert gambling landing page generator.

## YOUR APPROACH
Instead of describing how to build, look at this WORKING EXAMPLE and adapt it:

### CORE STRUCTURE (ALWAYS USE):
\`\`\`html
${CORE_HTML_STRUCTURE}
\`\`\`

### CORE CSS (ALWAYS INCLUDE):
\`\`\`css
${CORE_CSS}
\`\`\`

### ${example.type.toUpperCase()} GAME EXAMPLE:
${example.description}

HTML Structure:
\`\`\`html
${example.html}
\`\`\`

CSS:
\`\`\`css
${example.css}
\`\`\`

JavaScript:
\`\`\`javascript
${example.js}
\`\`\`

## INSTRUCTIONS:
1. Use the EXACT same patterns as the example
2. Adapt colors, text, prizes to the user's request
3. Keep the same animation and interaction patterns
4. Replace placeholder assets with provided asset paths
5. Output COMPLETE HTML file - no explanations, no markdown

## QUALITY REQUIREMENTS:
- Player ALWAYS wins
- Mobile responsive (em/rem units, touch events)
- Loader with progress bar
- CONFIG object with offerUrl
- Sound integration
- Protection code (block F12, right-click)
- Auto-redirect after win

Return ONLY the complete HTML file.`;
}

export default {
  CORE_HTML_STRUCTURE,
  CORE_CSS,
  WHEEL_EXAMPLE,
  BOXES_EXAMPLE,
  CRASH_EXAMPLE,
  getExampleForMechanic,
  buildExampleBasedPrompt
};
