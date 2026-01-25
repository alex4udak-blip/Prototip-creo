import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/env.js';
import { log } from '../../utils/logger.js';
import * as claudeService from '../claude.service.js';
import * as serperService from '../serper.service.js';
import * as geminiService from '../gemini.service.js';
import { removeBackground } from '../runware.service.js';
import { assembleLanding } from './assembler.service.js';
import { extractPalette } from './palette.service.js';
import { sendLandingUpdate } from '../../websocket/handler.js';

/**
 * Landing Generation States
 */
export const STATES = {
  IDLE: 'idle',
  ANALYZING: 'analyzing',
  FETCHING_REFERENCE: 'fetching_reference',
  EXTRACTING_PALETTE: 'extracting_palette',
  GENERATING_ASSETS: 'generating_assets',
  REMOVING_BACKGROUNDS: 'removing_backgrounds',
  GENERATING_CODE: 'generating_code',
  ASSEMBLING: 'assembling',
  COMPLETE: 'complete',
  ERROR: 'error'
};

/**
 * Supported game mechanics
 */
export const MECHANICS = {
  WHEEL: 'wheel',
  BOXES: 'boxes',
  CRASH: 'crash',
  BOARD: 'board',
  SCRATCH: 'scratch',
  LOADER: 'loader',
  SLOT: 'slot'
};

/**
 * Active generation sessions
 * Map<landingId, LandingSession>
 */
const sessions = new Map();

/**
 * Landing generation session
 */
class LandingSession {
  constructor(id, userId) {
    this.id = id;
    this.userId = userId;
    this.state = STATES.IDLE;
    this.progress = 0;
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.error = null;

    // Analysis results
    this.analysis = null;
    this.referenceImage = null;
    this.palette = null;

    // Generated content
    this.assets = {};
    this.sounds = {};
    this.html = null;

    // Final output
    this.zipPath = null;
    this.previewPath = null;

    // Event listeners
    this.listeners = new Set();
  }

  /**
   * Update session state and notify listeners
   */
  setState(state, data = {}) {
    this.state = state;
    this.updatedAt = new Date();

    if (data.progress !== undefined) {
      this.progress = data.progress;
    }
    if (data.error) {
      this.error = data.error;
    }

    const event = {
      landingId: this.id,
      state: this.state,
      progress: this.progress,
      message: data.message || this.getStateMessage(),
      timestamp: this.updatedAt.toISOString(),
      // Include analysis if available
      analysis: this.analysis || null
    };

    // Notify all listeners
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (e) {
        log.error('Listener error', { error: e.message });
      }
    }

    // Send WebSocket update to user
    try {
      sendLandingUpdate(this.userId, this.id, event);
    } catch (e) {
      log.debug('WebSocket update failed (not critical)', { error: e.message });
    }

    log.info('Landing session state change', {
      landingId: this.id,
      state,
      progress: this.progress
    });
  }

  /**
   * Get human-readable state message
   */
  getStateMessage() {
    const messages = {
      [STATES.IDLE]: 'Готов к генерации',
      [STATES.ANALYZING]: 'Анализирую запрос...',
      [STATES.FETCHING_REFERENCE]: 'Ищу референсы слота...',
      [STATES.EXTRACTING_PALETTE]: 'Извлекаю цветовую палитру...',
      [STATES.GENERATING_ASSETS]: 'Генерирую ассеты...',
      [STATES.REMOVING_BACKGROUNDS]: 'Удаляю фоны с ассетов...',
      [STATES.GENERATING_CODE]: 'Генерирую HTML/CSS/JS...',
      [STATES.ASSEMBLING]: 'Собираю ZIP архив...',
      [STATES.COMPLETE]: 'Готово!',
      [STATES.ERROR]: `Ошибка: ${this.error}`
    };
    return messages[this.state] || this.state;
  }

  /**
   * Add event listener
   */
  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
}

/**
 * Create new landing generation session
 * @param {number} userId - User ID
 * @returns {LandingSession}
 */
export function createSession(userId) {
  const id = uuidv4();
  const session = new LandingSession(id, userId);
  sessions.set(id, session);

  log.info('Created landing session', { landingId: id, userId });

  return session;
}

/**
 * Get existing session
 * @param {string} landingId - Landing ID
 * @returns {LandingSession|null}
 */
export function getSession(landingId) {
  return sessions.get(landingId) || null;
}

/**
 * Delete session
 * @param {string} landingId - Landing ID
 */
export function deleteSession(landingId) {
  sessions.delete(landingId);
}

/**
 * Main landing generation pipeline
 * @param {LandingSession} session - Active session
 * @param {Object} request - Generation request
 * @param {string} request.prompt - User's natural language request
 * @param {string} [request.screenshotBase64] - Optional reference screenshot
 * @param {Array<string>} [request.prizes] - Prize list
 * @param {string} [request.offerUrl] - Offer redirect URL
 * @param {string} [request.language] - Target language
 * @returns {Promise<Object>} Generation result
 */
export async function generateLanding(session, request) {
  const { prompt, screenshotBase64, prizes, offerUrl, language } = request;

  try {
    // ============================================
    // STEP 1: Analyze request with Claude
    // ============================================
    session.setState(STATES.ANALYZING, { progress: 5 });

    const analysis = await claudeService.analyzeRequest(prompt, screenshotBase64);
    session.analysis = analysis;

    // Override with explicit parameters if provided
    if (prizes) analysis.prizes = prizes;
    if (offerUrl) analysis.offerUrl = offerUrl;
    if (language) analysis.language = language;

    log.info('Analysis complete', {
      landingId: session.id,
      slotName: analysis.slotName,
      mechanicType: analysis.mechanicType,
      hadThinking: !!analysis._thinking
    });

    // Send thinking first if available
    if (analysis._thinking) {
      session.setState(STATES.ANALYZING, {
        progress: 8,
        message: `🧠 Claude думает: ${analysis._thinking.slice(0, 150)}...`
      });
    }

    // Send analysis update to frontend
    session.setState(STATES.ANALYZING, {
      progress: 10,
      message: `✅ Анализ завершён: ${analysis.slotName || 'Custom'} → ${analysis.mechanicType}`
    });

    // ============================================
    // STEP 2: Fetch reference image if real slot
    // ============================================
    if (analysis.isRealSlot && analysis.slotName) {
      session.setState(STATES.FETCHING_REFERENCE, {
        progress: 15,
        message: `Ищу референс для ${analysis.slotName}...`
      });

      try {
        const refImage = await serperService.getSlotReferenceImage(analysis.slotName);
        session.referenceImage = refImage;

        log.info('Reference image fetched', {
          landingId: session.id,
          source: refImage.source,
          provider: refImage.provider
        });

        session.setState(STATES.FETCHING_REFERENCE, {
          progress: 20,
          message: `Референс найден: ${refImage.provider || 'unknown'}`
        });
      } catch (e) {
        log.warn('Failed to fetch reference image, continuing without', {
          error: e.message
        });
        session.setState(STATES.FETCHING_REFERENCE, {
          progress: 20,
          message: 'Референс не найден, использую дефолты'
        });
      }
    }

    // ============================================
    // STEP 3: Extract color palette
    // ============================================
    session.setState(STATES.EXTRACTING_PALETTE, {
      progress: 25,
      message: 'Извлекаю цветовую палитру...'
    });

    let palette = {
      primary: '#FFD700',
      secondary: '#1E3A5F',
      accent: '#FF6B6B',
      background: '#0D1117'
    };

    if (session.referenceImage) {
      try {
        palette = await extractPalette(session.referenceImage.buffer);
        log.info('Palette extracted', { palette });
        session.setState(STATES.EXTRACTING_PALETTE, {
          progress: 30,
          message: `Палитра: ${palette.primary}, ${palette.accent}`
        });
      } catch (e) {
        log.warn('Palette extraction failed, using defaults', { error: e.message });
      }
    }

    session.palette = palette;

    // ============================================
    // STEP 4: Generate assets with Gemini
    // ============================================
    session.setState(STATES.GENERATING_ASSETS, {
      progress: 35,
      message: 'Генерирую графику с помощью Gemini...'
    });

    const assets = await generateAssets(session, analysis, palette);
    session.assets = assets;

    session.setState(STATES.GENERATING_ASSETS, {
      progress: 55,
      message: `Сгенерировано ${Object.keys(assets).length} ассетов`
    });

    // ============================================
    // STEP 5: Remove backgrounds from transparent assets
    // ============================================
    session.setState(STATES.REMOVING_BACKGROUNDS, {
      progress: 60,
      message: 'Убираю фоны с элементов...'
    });

    await processTransparentAssets(session.assets);

    // ============================================
    // STEP 6: Generate HTML/CSS/JS with Claude
    // ============================================
    session.setState(STATES.GENERATING_CODE, {
      progress: 70,
      message: 'Claude генерирует код лендинга...'
    });

    const html = await claudeService.generateLandingCode(
      analysis,
      session.assets,
      palette
    );
    session.html = html;

    session.setState(STATES.GENERATING_CODE, {
      progress: 85,
      message: `HTML готов (${Math.round(html.length / 1024)}KB)`
    });

    // ============================================
    // STEP 7: Assemble ZIP
    // ============================================
    session.setState(STATES.ASSEMBLING, {
      progress: 90,
      message: 'Собираю ZIP архив...'
    });

    const result = await assembleLanding({
      landingId: session.id,
      userId: session.userId,
      html: session.html,
      assets: session.assets,
      sounds: session.sounds,
      analysis: session.analysis
    });

    session.zipPath = result.zipPath;
    session.previewPath = result.previewPath;

    // ============================================
    // COMPLETE
    // ============================================
    session.setState(STATES.COMPLETE, {
      progress: 100,
      message: '✅ Лендинг готов к скачиванию!'
    });

    return {
      landingId: session.id,
      zipPath: session.zipPath,
      previewPath: session.previewPath,
      analysis: session.analysis,
      palette: session.palette
    };

  } catch (error) {
    log.error('Landing generation failed', {
      landingId: session.id,
      error: error.message,
      stack: error.stack
    });

    session.setState(STATES.ERROR, {
      error: error.message
    });

    throw error;
  }
}

/**
 * Generate assets using Gemini multi-turn chat
 * @param {LandingSession} session
 * @param {Object} analysis
 * @param {Object} palette
 * @returns {Promise<Object>} Asset paths
 */
async function generateAssets(session, analysis, palette) {
  const assets = {};
  const mechanicType = analysis.mechanicType || MECHANICS.WHEEL;

  // Create dedicated Gemini chat for consistent style
  const chatId = `landing_${session.id}`;

  // Define assets to generate based on mechanic type
  const assetPlan = getAssetPlan(mechanicType, analysis);

  let assetIndex = 0;
  const totalAssets = assetPlan.length;

  for (const asset of assetPlan) {
    assetIndex++;
    const progress = 35 + Math.floor((assetIndex / totalAssets) * 20);

    session.setState(STATES.GENERATING_ASSETS, {
      progress,
      message: `Генерирую ${asset.name}...`
    });

    try {
      const prompt = buildAssetPrompt(asset, analysis, palette);

      // Use Gemini to generate image
      const result = await geminiService.sendMessageStream(
        chatId,
        prompt,
        [],
        { expectedImages: 1, width: asset.width || 1024, height: asset.height || 1024 }
      );

      if (result.images && result.images.length > 0) {
        assets[asset.key] = {
          path: result.images[0].path,
          url: result.images[0].url,
          needsTransparency: asset.needsTransparency,
          width: asset.width,
          height: asset.height
        };

        log.info('Asset generated', {
          key: asset.key,
          path: result.images[0].path
        });
      }
    } catch (error) {
      log.error('Asset generation failed', {
        asset: asset.key,
        error: error.message
      });
      // Continue with other assets
    }
  }

  return assets;
}

/**
 * Get asset plan based on mechanic type
 */
function getAssetPlan(mechanicType, analysis) {
  const plans = {
    [MECHANICS.WHEEL]: [
      { key: 'background', name: 'фон', width: 1920, height: 1080, needsTransparency: false },
      { key: 'logo', name: 'логотип', width: 512, height: 256, needsTransparency: true },
      { key: 'wheel', name: 'колесо', width: 800, height: 800, needsTransparency: true },
      { key: 'wheelFrame', name: 'рамку колеса', width: 900, height: 900, needsTransparency: true },
      { key: 'pointer', name: 'указатель', width: 128, height: 200, needsTransparency: true },
      { key: 'button', name: 'кнопку SPIN', width: 256, height: 80, needsTransparency: true }
    ],
    [MECHANICS.BOXES]: [
      { key: 'background', name: 'фон', width: 1920, height: 1080, needsTransparency: false },
      { key: 'logo', name: 'логотип', width: 512, height: 256, needsTransparency: true },
      { key: 'boxClosed', name: 'закрытую коробку', width: 300, height: 350, needsTransparency: true },
      { key: 'boxOpen', name: 'открытую коробку', width: 300, height: 350, needsTransparency: true },
      { key: 'character', name: 'персонажа', width: 400, height: 600, needsTransparency: true }
    ],
    [MECHANICS.CRASH]: [
      { key: 'background', name: 'фон', width: 1920, height: 1080, needsTransparency: false },
      { key: 'logo', name: 'логотип', width: 512, height: 256, needsTransparency: true },
      { key: 'characterIdle', name: 'персонажа (стоит)', width: 256, height: 256, needsTransparency: true },
      { key: 'characterMove', name: 'персонажа (идёт)', width: 256, height: 256, needsTransparency: true },
      { key: 'characterLose', name: 'персонажа (проиграл)', width: 256, height: 256, needsTransparency: true },
      { key: 'obstacle1', name: 'препятствие 1', width: 200, height: 200, needsTransparency: true },
      { key: 'obstacle2', name: 'препятствие 2', width: 200, height: 200, needsTransparency: true },
      { key: 'cellDefault', name: 'ячейку (обычную)', width: 128, height: 128, needsTransparency: true },
      { key: 'cellActive', name: 'ячейку (активную)', width: 128, height: 128, needsTransparency: true }
    ],
    [MECHANICS.LOADER]: [
      { key: 'background', name: 'фон', width: 1920, height: 1080, needsTransparency: false },
      { key: 'logo', name: 'логотип', width: 512, height: 256, needsTransparency: true }
    ],
    [MECHANICS.SCRATCH]: [
      { key: 'background', name: 'фон', width: 1920, height: 1080, needsTransparency: false },
      { key: 'logo', name: 'логотип', width: 512, height: 256, needsTransparency: true },
      { key: 'scratchCard', name: 'скретч-карту', width: 500, height: 300, needsTransparency: false },
      { key: 'prize', name: 'приз', width: 400, height: 200, needsTransparency: true }
    ]
  };

  return plans[mechanicType] || plans[MECHANICS.WHEEL];
}

/**
 * Build prompt for asset generation
 */
function buildAssetPrompt(asset, analysis, palette) {
  const slotName = analysis.slotName || 'casino';
  const theme = analysis.theme || 'casino luxury';
  const style = analysis.style || 'modern vibrant';

  const basePrompt = `Create a ${asset.name} for "${slotName}" slot game landing page.
Theme: ${theme}
Style: ${style}
Colors: primary ${palette.primary}, secondary ${palette.secondary}`;

  const transparencyInstruction = asset.needsTransparency
    ? '\nIMPORTANT: Generate on SOLID WHITE BACKGROUND (#FFFFFF) for easy background removal. No shadows on background.'
    : '\nFull scene, no empty corners.';

  const sizeInstruction = `\nDimensions: ${asset.width}x${asset.height} pixels`;

  return basePrompt + transparencyInstruction + sizeInstruction;
}

/**
 * Process assets that need transparent backgrounds
 */
async function processTransparentAssets(assets) {
  for (const [key, asset] of Object.entries(assets)) {
    if (asset.needsTransparency && asset.path) {
      try {
        log.info('Removing background from asset', { key });

        // Read the image file
        const fs = await import('fs/promises');
        const imageBuffer = await fs.readFile(asset.path);

        // Remove background using Runware
        const transparentBuffer = await removeBackground(imageBuffer);

        // Save the processed image
        await fs.writeFile(asset.path, transparentBuffer);

        log.info('Background removed successfully', { key });
      } catch (error) {
        log.warn('Background removal failed', {
          key,
          error: error.message
        });
        // Keep the original asset
      }
    }
  }
}

/**
 * Get all active sessions
 */
export function getActiveSessions() {
  return Array.from(sessions.values()).filter(
    s => s.state !== STATES.COMPLETE && s.state !== STATES.ERROR
  );
}

/**
 * Check service health
 */
export function checkHealth() {
  return {
    activeSessions: sessions.size,
    claudeConfigured: !!config.anthropicApiKey,
    serperConfigured: !!config.serperApiKey,
    geminiConfigured: !!config.googleApiKey
  };
}

export default {
  STATES,
  MECHANICS,
  createSession,
  getSession,
  deleteSession,
  generateLanding,
  getActiveSessions,
  checkHealth
};
