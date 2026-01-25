/**
 * Landing Generator Service v3 — SMART LANDING GENERATOR
 *
 * АРХИТЕКТУРА: AI понимает → AI генерирует ВСЁ
 *
 * КЛЮЧЕВОЙ ПРИНЦИП:
 * Система работает ТОЛЬКО по описанию пользователя!
 * НЕТ зависимости от архивов или шаблонов.
 *
 * Flow:
 * 1. Пользователь даёт ОПИСАНИЕ: "Колесо фортуны в стиле Gates of Olympus"
 * 2. AI анализирует → понимает механику, стиль, что нужно сгенерировать
 * 3. AI генерирует ВСЁ с нуля:
 *    - Ассеты через Gemini multi-turn (консистентный стиль!)
 *    - HTML/CSS/JS код через AI
 *    - Подбирает звуки из библиотеки
 * 4. Собирает готовый ZIP с лендингом
 *
 * Поддерживает ЛЮБЫЕ механики — не хардкод!
 */
import { GoogleGenAI } from '@google/genai';
import { Runware } from '@runware/sdk-js';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/env.js';
import { log } from '../utils/logger.js';

// Initialize clients (lazy initialization - only when API keys available)
let ai = null;
let runwareClient = null;

function getAI() {
  if (!ai && config.googleApiKey) {
    ai = new GoogleGenAI({ apiKey: config.googleApiKey });
  }
  return ai;
}

async function getRunwareClient() {
  if (!runwareClient && config.runwareApiKey) {
    runwareClient = new Runware({ apiKey: config.runwareApiKey });
    await runwareClient.ensureConnection();
    log.info('Runware client connected');
  }
  return runwareClient;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Примеры механик (для UI, система понимает ЛЮБЫЕ)
export const MECHANIC_EXAMPLES = {
  WHEEL: 'wheel',
  BOXES: 'boxes',
  CRASH: 'crash',
  SCRATCH: 'scratch',
  SLOTS: 'slots',
  CARDS: 'cards',
  PLINKO: 'plinko',
  MINES: 'mines',
  TOWER: 'tower',
  CUSTOM: 'custom'
};

export const MECHANIC_TYPES = MECHANIC_EXAMPLES;

// Темы для UI (система понимает любые стили)
export const THEMES = {
  casino: { name: 'Casino', style: 'luxury casino', colors: 'gold, red, black' },
  candy: { name: 'Candy', style: 'sweet bonanza candy', colors: 'pink, purple, yellow' },
  greek: { name: 'Greek', style: 'gates of olympus mythology', colors: 'gold, blue, white' },
  christmas: { name: 'Christmas', style: 'festive holiday', colors: 'red, green, gold' },
  neon: { name: 'Neon', style: 'cyberpunk neon', colors: 'cyan, magenta, purple' }
};

export const LEGACY_THEMES = THEMES;

// ============================================================================
// MAIN GENERATION FUNCTION
// ============================================================================

/**
 * ГЛАВНАЯ ФУНКЦИЯ — Генерация лендинга по описанию
 *
 * Пользователь просто пишет что хочет, AI делает всё остальное!
 *
 * @param {Object} input - входные данные
 * @param {string} input.description - описание лендинга (ОБЯЗАТЕЛЬНО)
 * @param {Buffer} input.referenceImage - референс (опционально, для стиля)
 * @param {string} input.slotName - название слота (опционально, для поиска референса)
 * @param {Object} input.customization - доп. настройки (prizes, cta, offerUrl)
 * @param {Function} onProgress - callback прогресса
 * @returns {Object} Готовый лендинг пакет
 */
export async function generateLanding(input, onProgress) {
  // Legacy API support
  if (typeof input === 'string') {
    const description = `${input} game landing page`;
    const theme = arguments[1];
    const options = arguments[2] || {};
    const legacyProgress = arguments[3];
    return generateLanding({ description, theme, customization: options }, legacyProgress);
  }

  const {
    description,
    referenceImage,
    slotName,
    customization = {}
  } = input;

  const sessionId = uuidv4();
  const startTime = Date.now();

  log.info('=== STARTING SMART LANDING GENERATION ===', {
    sessionId,
    description: description?.substring(0, 100),
    hasReference: !!referenceImage,
    slotName
  });

  const progress = (data) => {
    if (onProgress) {
      onProgress({ sessionId, ...data });
    }
    log.info(`[${sessionId}] ${data.message || data.status}`, { progress: data.progress });
  };

  try {
    // ========================================
    // STEP 1: AI ПОНИМАЕТ ЗАПРОС
    // ========================================
    progress({
      status: 'analyzing',
      message: 'AI анализирует ваш запрос...',
      progress: 5
    });

    const understanding = await understandRequest({
      description,
      referenceImage,
      slotName,
      customization
    });

    log.info('Request understood', {
      sessionId,
      mechanic: understanding.mechanic,
      theme: understanding.theme,
      assetsNeeded: understanding.assets.length
    });

    progress({
      status: 'understood',
      message: `Механика: ${understanding.mechanic}. Стиль: ${understanding.theme}. Нужно ${understanding.assets.length} ассетов.`,
      progress: 15,
      understanding
    });

    // ========================================
    // STEP 2: AI ГЕНЕРИРУЕТ АССЕТЫ
    // ========================================
    progress({
      status: 'generating_assets',
      message: 'AI генерирует графику...',
      progress: 20
    });

    const assets = await generateAssets(understanding, (assetProgress) => {
      progress({
        status: 'generating_assets',
        message: `Генерирую: ${assetProgress.current}...`,
        progress: 20 + Math.round(assetProgress.percent * 0.4), // 20-60%
        currentAsset: assetProgress.current
      });
    });

    // ВАЛИДАЦИЯ: Должно быть минимум 2 ассета с URL
    const assetsWithUrls = assets.filter(a => a.url);
    if (assetsWithUrls.length < 2) {
      throw new Error(`Failed to generate enough assets. Got ${assetsWithUrls.length}, need at least 2.`);
    }

    log.info('Assets generated', {
      sessionId,
      count: assets.length,
      withUrls: assetsWithUrls.length,
      types: assets.map(a => a.type)
    });

    // ========================================
    // STEP 3: AI ГЕНЕРИРУЕТ КОД
    // ========================================
    progress({
      status: 'generating_code',
      message: 'AI пишет код лендинга...',
      progress: 65
    });

    const code = await generateCode(understanding, assets, customization);

    log.info('Code generated', {
      sessionId,
      htmlLength: code.html.length,
      cssLength: code.css.length,
      jsLength: code.js.length
    });

    // ========================================
    // STEP 4: ПОДБИРАЕМ ЗВУКИ
    // ========================================
    progress({
      status: 'selecting_sounds',
      message: 'Подбираю звуки...',
      progress: 80
    });

    const sounds = await selectSounds(understanding);

    // ========================================
    // STEP 5: СОБИРАЕМ ПАКЕТ
    // ========================================
    progress({
      status: 'assembling',
      message: 'Собираю лендинг...',
      progress: 90
    });

    const landingPackage = assembleLandingPackage({
      sessionId,
      understanding,
      assets,
      code,
      sounds,
      customization,
      generationTime: Date.now() - startTime
    });

    progress({
      status: 'complete',
      message: `Готово! Механика: ${understanding.mechanic}, ${assets.length} ассетов, ${Math.round((Date.now() - startTime) / 1000)}с`,
      progress: 100,
      package: landingPackage
    });

    log.info('=== LANDING GENERATION COMPLETE ===', {
      sessionId,
      mechanic: understanding.mechanic,
      assetsCount: assets.length,
      timeMs: Date.now() - startTime
    });

    return landingPackage;

  } catch (error) {
    log.error('Landing generation failed', {
      sessionId,
      error: error.message,
      stack: error.stack
    });

    progress({
      status: 'error',
      message: `Ошибка: ${error.message}`,
      progress: 0,
      error: error.message
    });

    throw error;
  }
}

// ============================================================================
// STEP 1: AI ПОНИМАЕТ ЗАПРОС
// ============================================================================

/**
 * AI анализирует запрос и понимает что нужно сделать
 * ДИНАМИЧЕСКИ — без хардкода механик!
 */
async function understandRequest({ description, referenceImage, slotName, customization }) {
  const aiClient = getAI();
  if (!aiClient) {
    throw new Error('Gemini API not configured. Cannot understand request without AI.');
  }

  // Собираем контекст для AI
  let contextParts = [];

  // Расширенный промпт для понимания ЛЮБОЙ механики
  contextParts.push({
    text: `You are an expert at understanding gambling/casino landing page requests.
You can understand ANY game mechanic - not just common ones!

Analyze this request and return a detailed JSON specification.

USER REQUEST: "${description || 'gambling game landing page'}"
${slotName ? `INSPIRED BY SLOT: "${slotName}"` : ''}
${customization?.prizes ? `PRIZES: ${customization.prizes.join(', ')}` : ''}
${customization?.offerUrl ? `OFFER URL: ${customization.offerUrl}` : ''}

IMPORTANT: Detect the EXACT mechanic from the description. Don't default to wheel!
Common mechanics: wheel, boxes, crash, scratch, slots, cards, plinko, mines, tower, dice, roulette, coinflip
But you can detect ANY custom mechanic the user describes!

Return JSON with this EXACT structure:
{
  "mechanic": "detected mechanic name (be specific!)",
  "mechanicDescription": "How this specific mechanic works - be detailed",
  "theme": "detected visual theme",
  "themeDescription": "Visual style description from the request",
  "colorPalette": {
    "primary": "#HEX",
    "secondary": "#HEX",
    "accent": "#HEX",
    "background": "#HEX"
  },
  "gameLogic": {
    "playerAction": "what the player does (spin | click | scratch | pick | tap | swipe | etc)",
    "alwaysWin": true,
    "winProbability": 1.0,
    "prizes": ["100€", "50€", "25€"],
    "redirectOnWin": true
  },
  "texts": {
    "headline": "Main attention grabber",
    "subheadline": "Supporting text",
    "ctaButton": "Action button text",
    "winMessage": "Celebration message"
  },
  "soundTheme": "epic | cartoon | neon | classic | universal"
}

DO NOT include "assets" in response - they will be generated separately!
Focus on understanding WHAT the user wants.`
  });

  // Добавляем референс если есть
  if (referenceImage) {
    const base64 = Buffer.isBuffer(referenceImage)
      ? referenceImage.toString('base64')
      : referenceImage;

    contextParts.push({
      inlineData: {
        mimeType: 'image/png',
        data: base64
      }
    });
    contextParts.push({
      text: 'Above is a reference image. Extract the visual style, colors, theme, and game mechanic from it.'
    });
  }

  // Если есть название слота, добавляем в контекст
  if (slotName && !referenceImage) {
    contextParts.push({
      text: `The slot "${slotName}" should inspire the visual style. Research its typical colors, characters, and theme.`
    });
  }

  // Retry logic — AI должен понять запрос
  const maxRetries = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      log.info(`Understanding request (attempt ${attempt}/${maxRetries})`, {
        description: description?.substring(0, 50)
      });

      const response = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: contextParts
      });

      const text = response.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error('AI response did not contain JSON');
      }

      const understanding = JSON.parse(jsonMatch[0]);

      // Валидация — должны быть ключевые поля
      if (!understanding.mechanic) {
        throw new Error('AI did not detect game mechanic');
      }

      // Теперь ДИНАМИЧЕСКИ генерируем список ассетов для ЭТОЙ механики
      const assets = await generateAssetListDynamically(
        understanding.mechanic,
        understanding.theme || 'casino',
        description
      );

      // Собираем полное понимание запроса
      const fullUnderstanding = {
        mechanic: understanding.mechanic,
        mechanicDescription: understanding.mechanicDescription || `${understanding.mechanic} game`,
        theme: understanding.theme || 'casino',
        themeDescription: understanding.themeDescription || 'Professional game style',
        colorPalette: understanding.colorPalette || {
          primary: '#FFD700',
          secondary: '#1a1a2e',
          accent: '#e74c3c',
          background: '#0a0a1a'
        },
        assets, // ДИНАМИЧЕСКИ сгенерированные!
        gameLogic: {
          playerAction: understanding.gameLogic?.playerAction || 'click',
          alwaysWin: understanding.gameLogic?.alwaysWin ?? true,
          prizes: understanding.gameLogic?.prizes || customization?.prizes || ['100€', '50€', '25€'],
          redirectOnWin: understanding.gameLogic?.redirectOnWin ?? true
        },
        texts: {
          headline: understanding.texts?.headline || 'PLAY & WIN!',
          subheadline: understanding.texts?.subheadline || 'Try your luck!',
          ctaButton: understanding.texts?.ctaButton || 'PLAY NOW',
          winMessage: understanding.texts?.winMessage || 'Congratulations!'
        },
        soundTheme: understanding.soundTheme || 'universal'
      };

      log.info('Request understood successfully', {
        mechanic: fullUnderstanding.mechanic,
        theme: fullUnderstanding.theme,
        assetsCount: fullUnderstanding.assets.length
      });

      return fullUnderstanding;

    } catch (error) {
      lastError = error;
      log.warn(`Understanding attempt ${attempt} failed`, { error: error.message });

      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * attempt)); // Exponential backoff
      }
    }
  }

  // ВСЕ попытки провалились — выбрасываем ошибку, НЕ фоллбэк на wheel!
  throw new Error(`Failed to understand request after ${maxRetries} attempts: ${lastError?.message}`);
}

/**
 * ДИНАМИЧЕСКАЯ генерация списка ассетов через AI
 * НЕТ хардкода! AI сам определяет что нужно для любой механики
 */
async function generateAssetListDynamically(mechanic, theme, description) {
  const prompt = `You are an expert game asset designer. Generate a complete asset list for a ${mechanic} gambling landing page.

USER DESCRIPTION: "${description}"
THEME: ${theme}

Think about what visual elements are needed for this SPECIFIC game mechanic.
Be creative - don't use generic templates!

Return JSON array of assets with this structure:
[
  {
    "type": "background | character | wheel | box | button | logo | effect | ui | card | multiplier | scratch | plinko | mine | tower",
    "name": "Human readable name",
    "description": "Detailed visual description for image generation",
    "width": 1920,
    "height": 1080,
    "zIndex": 1,
    "transparent": true,
    "animated": false
  }
]

RULES:
1. ALWAYS include: background (zIndex: 1), main game element, CTA button, win effects
2. Think about what makes THIS specific mechanic work visually
3. Include multiple states if needed (e.g., closed/open for boxes, normal/crashed for crash games)
4. Add decorative elements that fit the theme
5. Be specific in descriptions - they will be used for AI image generation

EXAMPLES:
- For "plinko": Need board with pegs, ball, multiplier buckets at bottom
- For "mines": Need grid of tiles, bomb icon, gem icon, revealed states
- For "tower": Need tower levels, climbing character, danger indicators
- For "dice": Need dice faces, rolling animation states, bet display
- For "roulette": Need wheel, ball, betting table, chip stacks

Generate 5-8 assets that are PERFECT for "${mechanic}" game. Be creative!`;

  try {
    const response = await getAI().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ text: prompt }]
    });

    const text = response.text || '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);

    if (jsonMatch) {
      const assets = JSON.parse(jsonMatch[0]);

      // Валидация — каждый ассет должен иметь базовые поля
      const validAssets = assets.filter(a =>
        a.type && a.name && a.description && a.width && a.height
      );

      if (validAssets.length >= 3) {
        log.info('Dynamic asset list generated', {
          mechanic,
          count: validAssets.length,
          types: validAssets.map(a => a.type)
        });
        return validAssets;
      }
    }

    // Если AI вернул невалидные данные — генерируем минимальный набор
    log.warn('AI returned invalid asset list, generating minimal set', { mechanic });
    return generateMinimalAssetList(mechanic, theme);

  } catch (error) {
    log.error('Dynamic asset generation failed', { error: error.message });
    return generateMinimalAssetList(mechanic, theme);
  }
}

/**
 * Минимальный набор ассетов — НЕ хардкод конкретных механик,
 * а универсальный шаблон который работает для ЛЮБОЙ механики
 */
function generateMinimalAssetList(mechanic, theme) {
  // Универсальный минимальный набор для ЛЮБОЙ механики
  return [
    {
      type: 'background',
      name: 'Background',
      description: `${theme} themed background for ${mechanic} game, atmospheric lighting, professional quality`,
      width: 1920,
      height: 1080,
      zIndex: 1,
      transparent: false
    },
    {
      type: mechanic, // Тип = сама механика (wheel, plinko, mines, etc.)
      name: `Main ${mechanic} Element`,
      description: `The main ${mechanic} game element, detailed, ${theme} style, high quality render`,
      width: 1024,
      height: 1024,
      zIndex: 10,
      transparent: true
    },
    {
      type: 'button',
      name: 'Play Button',
      description: `Glowing PLAY button, ${theme} style, inviting to click`,
      width: 400,
      height: 150,
      zIndex: 50,
      transparent: true
    },
    {
      type: 'effect',
      name: 'Win Celebration',
      description: `Celebration effects for winning, ${theme} style sparkles confetti fireworks`,
      width: 512,
      height: 512,
      zIndex: 100,
      transparent: true,
      animated: true
    }
  ];
}

// ============================================================================
// STEP 2: AI ГЕНЕРИРУЕТ АССЕТЫ
// ============================================================================

/**
 * Генерация всех ассетов через Gemini multi-turn chat
 * Multi-turn гарантирует КОНСИСТЕНТНЫЙ стиль!
 */
async function generateAssets(understanding, onProgress) {
  const { assets, theme, themeDescription, colorPalette } = understanding;
  const generatedAssets = [];

  // Создаём multi-turn chat для консистентного стиля
  const systemPrompt = `You are a professional game asset designer.
You create high-quality assets for gambling/casino landing pages.

CURRENT PROJECT STYLE:
- Theme: ${theme} - ${themeDescription}
- Colors: Primary ${colorPalette.primary}, Secondary ${colorPalette.secondary}, Accent ${colorPalette.accent}
- All assets must have CONSISTENT STYLE throughout the project

CRITICAL RULES:
1. Generate on WHITE BACKGROUND (will be removed for transparency)
2. Keep SAME style across all assets - this is CRITICAL
3. Rich details, professional game quality
4. Clean edges for easy background removal
5. Text must be readable with good contrast`;

  const chatConfig = {
    responseModalities: ['TEXT', 'IMAGE'],
    systemInstruction: systemPrompt,
    thinkingConfig: { thinkingBudget: 2048 },
    safetySettings: [
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' }
    ]
  };

  const chat = getAI().chats.create({
    model: config.gemini?.model || 'gemini-3-pro-image-preview',
    config: chatConfig
  });

  // Генерируем каждый ассет
  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];

    onProgress({
      current: asset.name,
      index: i,
      total: assets.length,
      percent: (i / assets.length) * 100
    });

    try {
      const prompt = `Generate: ${asset.name}

Description: ${asset.description}

Style: Same ${theme} style as previous assets!
Colors: Use ${colorPalette.primary}, ${colorPalette.secondary}, ${colorPalette.accent}
Resolution: ${asset.width}x${asset.height} pixels
${asset.transparent ? 'WHITE BACKGROUND for transparency removal!' : 'Full background, no transparency needed.'}

IMPORTANT: Keep CONSISTENT with all previous assets in this chat!`;

      const response = await chat.sendMessageStream({ message: prompt });

      let imageData = null;
      for await (const chunk of response) {
        const parts = chunk.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          if (part.inlineData) {
            imageData = part.inlineData;
          }
        }
      }

      if (imageData) {
        // Сохраняем изображение
        const url = await saveImage(imageData.data, imageData.mimeType, asset.type);

        // Убираем фон если нужно
        let finalUrl = url;
        if (asset.transparent) {
          try {
            const result = await removeBackground(url);
            if (result?.url) finalUrl = result.url;
          } catch (e) {
            log.warn('Background removal failed', { asset: asset.name });
          }
        }

        generatedAssets.push({
          ...asset,
          url: finalUrl,
          rawUrl: url,
          generated: true
        });

        log.info('Asset generated', { name: asset.name, url: finalUrl });
      } else {
        log.warn('No image generated for asset', { name: asset.name });
      }

      // Rate limiting
      await new Promise(r => setTimeout(r, 500));

    } catch (error) {
      log.error('Asset generation failed', { asset: asset.name, error: error.message });
    }
  }

  return generatedAssets;
}

// ============================================================================
// STEP 3: AI ГЕНЕРИРУЕТ КОД
// ============================================================================

/**
 * AI генерирует HTML/CSS/JS код для лендинга
 */
async function generateCode(understanding, assets, customization) {
  const { mechanic, colorPalette, gameLogic, texts } = understanding;

  const codePrompt = `Generate complete HTML, CSS, and JavaScript code for a ${mechanic} gambling landing page.

GAME MECHANICS:
- Type: ${mechanic}
- Player action: ${gameLogic.playerAction}
- Always wins: ${gameLogic.alwaysWin}
- Prizes: ${gameLogic.prizes.join(', ')}
- Redirect on win: ${gameLogic.redirectOnWin}
${customization.offerUrl ? `- Offer URL: ${customization.offerUrl}` : ''}

VISUAL STYLE:
- Primary color: ${colorPalette.primary}
- Secondary color: ${colorPalette.secondary}
- Accent color: ${colorPalette.accent}
- Background color: ${colorPalette.background}

TEXTS:
- Headline: ${texts.headline}
- CTA Button: ${texts.ctaButton}
- Win message: ${texts.winMessage}

ASSETS AVAILABLE:
${assets.map(a => `- ${a.name}: ${a.url}`).join('\n')}

REQUIREMENTS:
1. Mobile-first responsive design
2. Smooth animations using CSS transforms
3. Sound effects support (spin.mp3, win.mp3)
4. Always-win logic - player ALWAYS gets a prize
5. Redirect to offer URL on win after delay
6. Touch-friendly for mobile
7. Fast loading, optimized

Return JSON with this exact structure:
{
  "html": "<!DOCTYPE html>...",
  "css": "/* styles */...",
  "js": "// game logic..."
}

Make the code production-ready and engaging!`;

  try {
    const response = await getAI().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ text: codePrompt }]
    });

    const text = response.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const code = JSON.parse(jsonMatch[0]);
      return {
        html: code.html || generateDefaultHTML(understanding, assets, customization),
        css: code.css || generateDefaultCSS(understanding),
        js: code.js || generateDefaultJS(understanding, customization)
      };
    }
  } catch (error) {
    log.error('Code generation failed', { error: error.message });
  }

  // Fallback to default templates
  return {
    html: generateDefaultHTML(understanding, assets, customization),
    css: generateDefaultCSS(understanding),
    js: generateDefaultJS(understanding, customization)
  };
}

/**
 * Default HTML template — ИСПОЛЬЗУЕТ ВСЕ СГЕНЕРИРОВАННЫЕ КАРТИНКИ!
 * Каждый ассет = отдельный слой с z-index
 */
function generateDefaultHTML(understanding, assets, customization) {
  const { mechanic, texts, colorPalette } = understanding;

  // Сортируем ассеты по z-index для правильного порядка слоёв
  const sortedAssets = [...assets].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

  // Группируем по типам для структуры HTML
  const bgAsset = assets.find(a => a.type === 'background');
  const mainGameAssets = assets.filter(a =>
    a.type !== 'background' && a.type !== 'effect' && a.type !== 'button'
  );
  const effectAssets = assets.filter(a => a.type === 'effect');
  const buttonAsset = assets.find(a => a.type === 'button');

  // Генерируем HTML для каждого слоя
  const generateLayerHTML = (asset, extraClasses = '') => {
    if (!asset?.url) return '';

    const id = asset.name.toLowerCase().replace(/\s+/g, '-');
    const animated = asset.animated ? 'animated' : '';
    const transparent = asset.transparent ? 'transparent' : '';

    return `    <img
      id="${id}"
      class="layer layer-${asset.type} ${animated} ${transparent} ${extraClasses}"
      src="${asset.url}"
      alt="${asset.name}"
      data-type="${asset.type}"
      data-zindex="${asset.zIndex || 10}"
      style="z-index: ${asset.zIndex || 10};"
    >`;
  };

  // Генерируем все слои игры
  const gameLayersHTML = mainGameAssets
    .map(asset => generateLayerHTML(asset, 'game-element'))
    .filter(Boolean)
    .join('\n');

  // Эффекты победы (скрыты по умолчанию)
  const effectsHTML = effectAssets
    .map(asset => generateLayerHTML(asset, 'win-effect hidden'))
    .filter(Boolean)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${texts.headline}</title>
  <style>
${generateDefaultCSS(understanding)}

/* Layer positioning - КАЖДАЯ КАРТИНКА = СЛОЙ */
.layer {
  position: absolute;
  max-width: 100%;
  height: auto;
  pointer-events: none;
  transition: transform 0.3s ease;
}

.layer.game-element {
  pointer-events: auto;
  cursor: pointer;
}

.layer.game-element:hover {
  transform: scale(1.02);
}

.layer.win-effect {
  opacity: 0;
  transition: opacity 0.5s ease;
}

.layer.win-effect.visible {
  opacity: 1;
}

/* Z-index layers - автоматически из data-атрибутов */
${sortedAssets.map(a => `.layer[data-zindex="${a.zIndex || 10}"] { z-index: ${a.zIndex || 10}; }`).join('\n')}

/* Mechanic-specific positioning */
.game-area {
  position: relative;
  width: 100%;
  max-width: 800px;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.layer-${mechanic},
.layer-wheel,
.layer-box,
.layer-card,
.layer-dice {
  width: 80%;
  max-width: 500px;
}

.layer-ui,
.layer-frame {
  width: 90%;
  max-width: 600px;
}

.layer-character {
  width: 40%;
  max-width: 300px;
  bottom: 0;
  right: 5%;
}

.layer-button {
  width: auto;
  max-width: 300px;
  cursor: pointer;
  pointer-events: auto;
}

.layer-effect {
  width: 100%;
  pointer-events: none;
}
  </style>
</head>
<body>
  <div class="landing" id="landing">
    <!-- LAYER 1: Background -->
    ${bgAsset ? `<img class="background layer" src="${bgAsset.url}" alt="Background" style="z-index: 1;">` : ''}

    <!-- Header -->
    <header class="header" style="z-index: 1000;">
      <h1 class="headline">${texts.headline}</h1>
      <p class="subheadline">${texts.subheadline || 'Try your luck!'}</p>
    </header>

    <!-- GAME AREA: Все игровые слои -->
    <main class="game-area" id="game-area">
${gameLayersHTML}

      <!-- Win effects (hidden until win) -->
${effectsHTML}
    </main>

    <!-- CTA Button -->
    <div class="cta-container" style="z-index: 1000;">
      ${buttonAsset
        ? `<img id="cta-btn" class="layer layer-button" src="${buttonAsset.url}" alt="${texts.ctaButton}">`
        : `<button class="cta-btn" id="cta-btn">${texts.ctaButton}</button>`
      }
    </div>

    <!-- Win Modal -->
    <div class="win-modal hidden" id="win-modal" style="z-index: 2000;">
      <div class="win-content">
        <h2 class="win-title">${texts.winMessage}</h2>
        <p class="win-prize" id="win-prize"></p>
        <button class="claim-btn" id="claim-btn">CLAIM NOW</button>
      </div>
    </div>
  </div>

  <!-- Sounds -->
  <audio id="sound-spin" src="sounds/spin.mp3" preload="auto"></audio>
  <audio id="sound-win" src="sounds/win.mp3" preload="auto"></audio>

  <!-- Game config -->
  <script>
    window.GAME_CONFIG = {
      mechanic: '${mechanic}',
      assets: ${JSON.stringify(assets.map(a => ({
        id: a.name.toLowerCase().replace(/\s+/g, '-'),
        type: a.type,
        url: a.url,
        zIndex: a.zIndex,
        animated: a.animated
      })))},
      prizes: ${JSON.stringify(understanding.gameLogic.prizes)},
      offerUrl: '${customization?.offerUrl || '#'}',
      alwaysWin: ${understanding.gameLogic.alwaysWin}
    };
  </script>
  <script>
${generateDefaultJS(understanding, customization)}
  </script>
</body>
</html>`;
}

/**
 * Default CSS template
 */
function generateDefaultCSS(understanding) {
  const { colorPalette } = understanding;

  return `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --primary: ${colorPalette.primary};
  --secondary: ${colorPalette.secondary};
  --accent: ${colorPalette.accent};
  --background: ${colorPalette.background};
}

body {
  font-family: 'Segoe UI', system-ui, sans-serif;
  background: var(--background);
  min-height: 100vh;
  overflow-x: hidden;
}

.landing {
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
}

.background {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: -1;
}

.header {
  text-align: center;
  padding: 40px 20px;
  z-index: 10;
}

.headline {
  font-size: clamp(2rem, 8vw, 4rem);
  font-weight: 900;
  color: var(--primary);
  text-shadow: 0 4px 20px rgba(0,0,0,0.5);
  margin-bottom: 10px;
}

.subheadline {
  font-size: clamp(1rem, 4vw, 1.5rem);
  color: white;
  opacity: 0.9;
}

.game-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 600px;
  z-index: 10;
}

.cta-container {
  padding: 30px;
  z-index: 10;
}

.cta-btn {
  background: linear-gradient(145deg, var(--primary), var(--accent));
  color: white;
  font-size: clamp(1.2rem, 5vw, 2rem);
  font-weight: 700;
  padding: 20px 60px;
  border: none;
  border-radius: 50px;
  cursor: pointer;
  text-transform: uppercase;
  box-shadow: 0 10px 40px rgba(0,0,0,0.4);
  transition: all 0.3s ease;
}

.cta-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 15px 50px rgba(0,0,0,0.5);
}

.cta-btn:active {
  transform: scale(0.98);
}

.win-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  opacity: 1;
  transition: opacity 0.3s;
}

.win-modal.hidden {
  opacity: 0;
  pointer-events: none;
}

.win-content {
  text-align: center;
  padding: 40px;
  background: linear-gradient(145deg, var(--secondary), var(--background));
  border-radius: 30px;
  border: 3px solid var(--primary);
  animation: popIn 0.5s ease;
}

@keyframes popIn {
  0% { transform: scale(0); }
  80% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

.win-title {
  font-size: 2.5rem;
  color: var(--primary);
  margin-bottom: 20px;
}

.win-prize {
  font-size: 4rem;
  font-weight: 900;
  color: white;
  margin-bottom: 30px;
}

.claim-btn {
  background: var(--accent);
  color: white;
  font-size: 1.5rem;
  font-weight: 700;
  padding: 15px 40px;
  border: none;
  border-radius: 50px;
  cursor: pointer;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

/* Mobile optimizations */
@media (max-width: 768px) {
  .landing {
    padding: 10px;
  }

  .header {
    padding: 20px 10px;
  }

  .cta-btn {
    padding: 15px 40px;
  }
}`;
}

/**
 * Default JS template — РАБОТАЕТ С КАРТИНКАМИ-СЛОЯМИ!
 */
function generateDefaultJS(understanding, customization) {
  const { mechanic, gameLogic } = understanding;
  const offerUrl = customization?.offerUrl || 'https://example.com/offer';

  return `
// Game state
const CONFIG = window.GAME_CONFIG || {
  mechanic: '${mechanic}',
  prizes: ${JSON.stringify(gameLogic.prizes)},
  offerUrl: '${offerUrl}',
  alwaysWin: ${gameLogic.alwaysWin}
};

let isPlaying = false;

// DOM elements
const ctaBtn = document.getElementById('cta-btn');
const winModal = document.getElementById('win-modal');
const winPrize = document.getElementById('win-prize');
const claimBtn = document.getElementById('claim-btn');
const gameArea = document.getElementById('game-area');
const soundSpin = document.getElementById('sound-spin');
const soundWin = document.getElementById('sound-win');

// Get all game elements (layers)
const gameElements = document.querySelectorAll('.game-element');
const winEffects = document.querySelectorAll('.win-effect');

// Sound helpers
function playSound(audio) {
  if (audio) {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }
}

function getRandomPrize() {
  return CONFIG.prizes[Math.floor(Math.random() * CONFIG.prizes.length)];
}

// Animation based on mechanic type
function animateGame() {
  const mechanic = CONFIG.mechanic;

  // Find main game element
  const mainElement = document.querySelector('.layer-' + mechanic) ||
                      document.querySelector('.game-element');

  if (!mainElement) {
    console.warn('No main game element found');
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    // Apply mechanic-specific animation
    switch(mechanic) {
      case 'wheel':
        // Spin animation
        const rotations = 5 + Math.random() * 3; // 5-8 full rotations
        const finalAngle = rotations * 360 + Math.random() * 360;
        mainElement.style.transition = 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)';
        mainElement.style.transform = 'rotate(' + finalAngle + 'deg)';
        setTimeout(resolve, 4000);
        break;

      case 'boxes':
      case 'box':
        // Shake then reveal
        mainElement.classList.add('shake');
        setTimeout(() => {
          mainElement.classList.remove('shake');
          mainElement.style.transform = 'scale(1.1)';
          mainElement.style.filter = 'brightness(1.3)';
          setTimeout(resolve, 500);
        }, 1500);
        break;

      case 'scratch':
        // Fade reveal
        mainElement.style.transition = 'opacity 2s ease';
        mainElement.style.opacity = '0.3';
        setTimeout(resolve, 2000);
        break;

      case 'crash':
        // Move up then "crash"
        mainElement.style.transition = 'transform 2s ease-out';
        mainElement.style.transform = 'translateY(-100px) scale(1.2)';
        setTimeout(() => {
          mainElement.classList.add('shake');
          setTimeout(resolve, 500);
        }, 2000);
        break;

      case 'plinko':
        // Bounce animation
        mainElement.classList.add('bounce');
        setTimeout(() => {
          mainElement.classList.remove('bounce');
          resolve();
        }, 3000);
        break;

      case 'cards':
      case 'card':
        // Flip animation
        mainElement.style.transition = 'transform 1s ease';
        mainElement.style.transform = 'rotateY(180deg)';
        setTimeout(resolve, 1000);
        break;

      default:
        // Generic pulse animation
        mainElement.classList.add('pulse');
        setTimeout(() => {
          mainElement.classList.remove('pulse');
          mainElement.style.transform = 'scale(1.05)';
          resolve();
        }, 2000);
    }
  });
}

// Show win effects
function showWinEffects() {
  winEffects.forEach(effect => {
    effect.classList.remove('hidden');
    effect.classList.add('visible');
  });
}

// Hide win effects
function hideWinEffects() {
  winEffects.forEach(effect => {
    effect.classList.add('hidden');
    effect.classList.remove('visible');
  });
}

// Show win modal
function showWin(prize) {
  winPrize.textContent = prize;
  winModal.classList.remove('hidden');
  showWinEffects();
  playSound(soundWin);
}

// Reset game state
function resetGame() {
  const mainElement = document.querySelector('.layer-' + CONFIG.mechanic) ||
                      document.querySelector('.game-element');
  if (mainElement) {
    mainElement.style.transition = 'none';
    mainElement.style.transform = '';
    mainElement.style.filter = '';
    mainElement.style.opacity = '';
    mainElement.classList.remove('shake', 'bounce', 'pulse');
    // Force reflow
    mainElement.offsetHeight;
  }
  hideWinEffects();
}

// Main play function
async function play() {
  if (isPlaying) return;
  isPlaying = true;

  // Reset previous state
  resetGame();

  // Update button
  if (ctaBtn.tagName === 'BUTTON') {
    ctaBtn.disabled = true;
    ctaBtn.textContent = '...';
  } else {
    ctaBtn.style.opacity = '0.5';
    ctaBtn.style.pointerEvents = 'none';
  }

  playSound(soundSpin);

  // Animate game
  await animateGame();

  // Always win!
  const prize = getRandomPrize();
  showWin(prize);

  // Reset button
  isPlaying = false;
  if (ctaBtn.tagName === 'BUTTON') {
    ctaBtn.disabled = false;
    ctaBtn.textContent = 'PLAY AGAIN';
  } else {
    ctaBtn.style.opacity = '1';
    ctaBtn.style.pointerEvents = 'auto';
  }
}

// Event listeners
if (ctaBtn) {
  ctaBtn.addEventListener('click', play);
}

// Clicking any game element also plays
gameElements.forEach(el => {
  el.addEventListener('click', play);
});

if (claimBtn) {
  claimBtn.addEventListener('click', function() {
    window.location.href = CONFIG.offerUrl;
  });
}

// Close modal on background click
if (winModal) {
  winModal.addEventListener('click', function(e) {
    if (e.target === winModal) {
      winModal.classList.add('hidden');
      hideWinEffects();
    }
  });
}

console.log('Game initialized:', CONFIG.mechanic, 'with', gameElements.length, 'game elements');
`;
}

// ============================================================================
// STEP 4: ПОДБИРАЕМ ЗВУКИ
// ============================================================================

/**
 * Подбираем звуки для лендинга
 */
async function selectSounds(understanding) {
  const { soundTheme, mechanic } = understanding;

  // Импортируем sound service
  try {
    const soundService = await import('./sound.service.js');
    const soundPackage = await soundService.assembleSoundPackage({
      styleTheme: soundTheme,
      mechanicType: mechanic
    });
    return soundPackage;
  } catch (error) {
    log.warn('Sound service not available', { error: error.message });
    return {
      theme: 'universal',
      sounds: { required: [], optional: [], all: [] }
    };
  }
}

// ============================================================================
// STEP 5: СБОРКА ПАКЕТА
// ============================================================================

/**
 * Собираем финальный пакет лендинга
 */
function assembleLandingPackage({
  sessionId,
  understanding,
  assets,
  code,
  sounds,
  customization,
  generationTime
}) {
  return {
    id: sessionId,
    type: understanding.mechanic,
    mechanic: understanding.mechanic,
    theme: understanding.theme,
    createdAt: new Date().toISOString(),
    generationTimeMs: generationTime,

    // Понимание запроса
    understanding,

    // Сгенерированные ассеты
    assets: {
      all: assets,
      byType: assets.reduce((acc, a) => {
        if (!acc[a.type]) acc[a.type] = [];
        acc[a.type].push(a);
        return acc;
      }, {}),
      count: assets.length
    },

    // Сгенерированный код
    code,

    // Звуки
    sounds,

    // Legacy format для совместимости
    layers: {
      all: assets.map(a => ({
        id: a.name.toLowerCase().replace(/\s+/g, '-'),
        name: a.name,
        url: a.url,
        zIndex: a.zIndex || 10,
        animationType: a.animated ? 'ANIMATED' : 'STATIC',
        hasTransparency: a.transparent
      })),
      count: assets.length
    },

    // Конфиг
    config: {
      width: 1920,
      height: 1080,
      ...customization
    },

    // CSS анимации
    cssAnimations: generateCSSAnimations(understanding.mechanic)
  };
}

// ============================================================================
// UTILITIES
// ============================================================================

async function saveImage(base64Data, mimeType, prefix = '') {
  const ext = mimeType?.includes('jpeg') ? '.jpg' : '.png';
  const filename = `${prefix}-${uuidv4()}${ext}`;
  const filepath = path.join(config.storagePath, filename);

  if (!fs.existsSync(config.storagePath)) {
    fs.mkdirSync(config.storagePath, { recursive: true });
  }

  const buffer = Buffer.from(base64Data, 'base64');
  fs.writeFileSync(filepath, buffer);

  return `/uploads/${filename}`;
}

export async function removeBackground(imageUrl) {
  // Валидация входных данных
  if (!imageUrl || typeof imageUrl !== 'string') return null;
  if (!config.runwareApiKey) return null;

  try {
    // Проверяем что это валидный путь к файлу
    if (!imageUrl.startsWith('/uploads/')) return null;

    const filename = imageUrl.replace('/uploads/', '');
    if (!filename || filename.includes('..')) return null;

    const filepath = path.join(config.storagePath, filename);
    if (!fs.existsSync(filepath)) return null;

    // Проверяем что это файл, а не директория
    const stat = fs.statSync(filepath);
    if (!stat.isFile()) return null;

    const client = await getRunwareClient();
    if (!client) return null;

    const imageBuffer = fs.readFileSync(filepath);
    const base64 = imageBuffer.toString('base64');

    const result = await client.imageBackgroundRemoval({
      inputImage: `data:image/png;base64,${base64}`,
      outputType: 'URL',
      outputFormat: 'PNG'
    });

    if (result?.[0]?.imageURL) {
      const response = await fetch(result[0].imageURL);
      const buffer = Buffer.from(await response.arrayBuffer());

      const newFilename = `transparent-${uuidv4()}.png`;
      const newPath = path.join(config.storagePath, newFilename);
      fs.writeFileSync(newPath, buffer);

      return { url: `/uploads/${newFilename}` };
    }
  } catch (error) {
    log.error('Background removal failed', { error: error.message });
  }

  return null;
}

/**
 * Генерация CSS анимаций — динамически для ЛЮБОЙ механики
 */
function generateCSSAnimations(mechanic) {
  // Базовые анимации которые нужны всегда
  const commonAnimations = `
/* Common animations */
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
@keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
@keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
@keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
@keyframes glow { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.3); } }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@keyframes slideDown { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@keyframes scaleIn { from { transform: scale(0); } to { transform: scale(1); } }
@keyframes popIn { 0% { transform: scale(0); } 80% { transform: scale(1.1); } 100% { transform: scale(1); } }

.fade-in { animation: fadeIn 0.5s ease; }
.pulse { animation: pulse 2s infinite; }
.bounce { animation: bounce 1s infinite; }
.shake { animation: shake 0.3s ease-in-out; }
.glow { animation: glow 1.5s infinite; }
.spin { animation: spin 1s linear infinite; }
`;

  // Специфичные анимации для механики — AI генерирует их в коде,
  // здесь просто даём базовый набор который работает для всего
  const mechanicAnimations = `
/* Mechanic-specific: ${mechanic} */
@keyframes game-action {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

@keyframes win-celebration {
  0% { transform: scale(0) rotate(0deg); opacity: 0; }
  50% { transform: scale(1.2) rotate(180deg); opacity: 1; }
  100% { transform: scale(1) rotate(360deg); opacity: 1; }
}

@keyframes element-reveal {
  0% { clip-path: inset(100% 0 0 0); }
  100% { clip-path: inset(0 0 0 0); }
}

.game-action { animation: game-action 0.5s ease; }
.win-celebration { animation: win-celebration 1s ease forwards; }
.element-reveal { animation: element-reveal 0.8s ease forwards; }
`;

  return commonAnimations + mechanicAnimations;
}

// ============================================================================
// LEGACY API COMPATIBILITY
// ============================================================================

export async function generateWheelLayers(session, theme, options) {
  return generateLanding({
    description: 'Fortune wheel spin to win game',
    customization: { ...options, prizes: options?.prizes }
  }, options?.onProgress);
}

export async function generateBoxesLayers(session, theme, options) {
  return generateLanding({
    description: 'Gift boxes pick to win game',
    customization: options
  }, options?.onProgress);
}

export function assembleLandingPackage_legacy(layers, config) {
  return {
    id: uuidv4(),
    type: config.type,
    layers: { all: layers, count: layers.length },
    config,
    createdAt: new Date().toISOString()
  };
}

export function validateStyleConsistency(layers) {
  const issues = [];
  const layerArray = Array.isArray(layers) ? layers : Object.values(layers);

  for (const layer of layerArray) {
    if (!layer?.url) {
      issues.push(`Layer "${layer?.id || 'unknown'}" missing URL`);
    }
  }

  return { valid: issues.length === 0, issues, layersChecked: layerArray.length };
}

export async function checkHealth() {
  return {
    available: !!config.googleApiKey,
    runwareAvailable: !!config.runwareApiKey,
    model: config.gemini?.model || 'gemini-3-pro-image-preview',
    features: ['smart-generation', 'multi-turn-consistency', 'code-generation', 'sound-selection'],
    supportedMechanics: Object.values(MECHANIC_EXAMPLES),
    supportedThemes: Object.keys(THEMES)
  };
}

// Re-export for backwards compatibility
export { assembleLandingPackage_legacy as assembleLandingPackage };

export default {
  generateLanding,
  generateWheelLayers,
  generateBoxesLayers,
  removeBackground,
  assembleLandingPackage: assembleLandingPackage_legacy,
  validateStyleConsistency,
  checkHealth,
  MECHANIC_TYPES,
  MECHANIC_EXAMPLES,
  THEMES,
  LEGACY_THEMES
};
