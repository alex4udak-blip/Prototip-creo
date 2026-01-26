import { Router } from 'express';
import { authMiddleware as auth, adminMiddleware } from '../middleware/auth.middleware.js';
import { log } from '../utils/logger.js';
import { pool } from '../db/connection.js';
import * as orchestrator from '../services/landing/orchestrator.service.js';
import * as assembler from '../services/landing/assembler.service.js';
import * as claudeService from '../services/claude.service.js';
import * as ratingService from '../services/rating.service.js';
import { sendLandingUpdate } from '../websocket/handler.js';

const router = Router();

// ===========================================
// STATIC ROUTES (must be before dynamic :landingId)
// ===========================================

/**
 * GET /api/landing/v2/health
 * Health check for landing generator (no auth required)
 */
router.get('/health', (req, res) => {
  const orchestratorHealth = orchestrator.checkHealth();
  const claudeHealth = claudeService.checkHealth();

  res.json({
    status: 'ok',
    orchestrator: orchestratorHealth,
    claude: claudeHealth,
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/landing/v2/mechanics
 * Get list of supported game mechanics
 */
router.get('/mechanics', auth, (req, res) => {
  res.json({
    mechanics: [
      {
        id: 'wheel',
        name: 'Fortune Wheel',
        description: 'Spin the wheel to win prizes',
        complexity: 'simple'
      },
      {
        id: 'boxes',
        name: 'Gift Boxes',
        description: 'Pick a box to reveal your prize',
        complexity: 'simple'
      },
      {
        id: 'crash',
        name: 'Crash Road',
        description: 'Advance through cells avoiding obstacles',
        complexity: 'complex'
      },
      {
        id: 'board',
        name: 'Board Game',
        description: 'Roll dice and move on the board',
        complexity: 'complex'
      },
      {
        id: 'scratch',
        name: 'Scratch Card',
        description: 'Scratch to reveal prizes',
        complexity: 'simple'
      },
      {
        id: 'loader',
        name: 'Progress Loader',
        description: 'Loading animation prelander',
        complexity: 'simple'
      },
      {
        id: 'slot',
        name: 'Mini Slot',
        description: 'Spinning slot machine simulation',
        complexity: 'medium'
      }
    ]
  });
});

/**
 * GET /api/landing/v2/templates
 * Get available templates
 */
router.get('/templates', auth, async (req, res) => {
  const { type } = req.query;

  try {
    let query = `SELECT id, name, type, description, thumbnail_url, default_config
                 FROM landing_templates WHERE is_active = true`;
    const params = [];

    if (type) {
      query += ` AND type = $1`;
      params.push(type);
    }

    query += ` ORDER BY name`;

    const result = await pool.query(query, params);

    res.json({ templates: result.rows });
  } catch (error) {
    log.error('Failed to list templates', { error: error.message });
    res.status(500).json({ error: 'Failed to list templates' });
  }
});

/**
 * GET /api/landing/v2/stats/learning
 * Get learning statistics (how the system is improving)
 * IMPORTANT: Must be BEFORE dynamic :landingId routes
 */
router.get('/stats/learning', auth, async (req, res) => {
  try {
    const stats = await ratingService.getLearningStats();
    res.json(stats);
  } catch (error) {
    log.error('Failed to get learning stats', { error: error.message });
    res.status(500).json({ error: 'Failed to get learning stats' });
  }
});

/**
 * GET /api/landing/v2/list
 * List user's landings
 */
router.get('/list', auth, async (req, res) => {
  const userId = req.user.id;
  const { limit = 20, offset = 0 } = req.query;

  // Validate and sanitize pagination params
  const safeLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
  const safeOffset = Math.max(parseInt(offset) || 0, 0);

  try {
    const result = await pool.query(
      `SELECT id, landing_id, type, slot_name, language, status,
              prizes, palette, preview_path, downloads_count,
              created_at, updated_at
       FROM landings
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, safeLimit, safeOffset]
    );

    // Also get file-based landings
    const fileLandings = await assembler.listLandings(userId);

    res.json({
      landings: result.rows,
      fileLandings: fileLandings,
      total: result.rowCount
    });
  } catch (error) {
    log.error('Failed to list landings', { error: error.message });
    res.status(500).json({ error: 'Failed to list landings' });
  }
});

/**
 * POST /api/landing/v2/generate
 * Start landing page generation
 */
router.post('/generate', auth, async (req, res) => {
  const userId = req.user.id;
  const { prompt, screenshot, prizes, offerUrl, language, mechanicType } = req.body;

  if (!prompt || prompt.trim().length < 5) {
    return res.status(400).json({
      error: 'Prompt must be at least 5 characters'
    });
  }

  // Validate mechanicType if provided (whitelist)
  const VALID_MECHANICS = ['wheel', 'boxes', 'crash', 'board', 'scratch', 'loader', 'slot'];
  if (mechanicType && !VALID_MECHANICS.includes(mechanicType)) {
    return res.status(400).json({
      error: `Invalid mechanicType. Must be one of: ${VALID_MECHANICS.join(', ')}`
    });
  }

  // Validate screenshot size (max 2MB base64 ≈ 1.5MB image)
  const MAX_SCREENSHOT_SIZE = 2 * 1024 * 1024; // 2MB
  if (screenshot && screenshot.length > MAX_SCREENSHOT_SIZE) {
    return res.status(400).json({
      error: 'Screenshot too large. Maximum size is 2MB'
    });
  }

  try {
    // Create generation session
    const session = orchestrator.createSession(userId);

    // Start generation asynchronously
    // Don't await - let it run in background and use WebSocket for updates
    orchestrator.generateLanding(session, {
      prompt: prompt.trim(),
      screenshotBase64: screenshot,
      prizes,
      offerUrl,
      language,
      mechanicType
    }).catch(error => {
      log.error('Background generation failed', {
        landingId: session.id,
        error: error.message
      });

      // CRITICAL: Propagate error to client via WebSocket
      // Client was waiting for updates and needs to know about failure
      try {
        sendLandingUpdate(userId, session.id, {
          type: 'landing_error',
          state: 'error',
          progress: session.progress || 0,
          error: error.message,
          errorCode: error.code || 'GENERATION_FAILED',
          timestamp: new Date().toISOString()
        });
      } catch (wsError) {
        log.warn('Could not send error via WebSocket', { error: wsError.message });
      }
    });

    // Return session ID immediately
    res.status(202).json({
      landingId: session.id,
      status: 'started',
      message: 'Generation started. Subscribe to WebSocket for updates.'
    });

  } catch (error) {
    log.error('Failed to start generation', { error: error.message });
    res.status(500).json({ error: 'Failed to start generation' });
  }
});

/**
 * POST /api/landing/v2/analyze
 * Analyze request without generating (for preview/validation)
 */
router.post('/analyze', auth, async (req, res) => {
  const { prompt, screenshot } = req.body;

  if (!prompt || prompt.trim().length < 5) {
    return res.status(400).json({ error: 'Prompt required' });
  }

  // Validate screenshot size (same as /generate - max 2MB)
  const MAX_SCREENSHOT_SIZE = 2 * 1024 * 1024;
  if (screenshot && screenshot.length > MAX_SCREENSHOT_SIZE) {
    return res.status(400).json({
      error: 'Screenshot too large. Maximum size is 2MB'
    });
  }

  try {
    const analysis = await claudeService.analyzeRequest(
      prompt.trim(),
      screenshot
    );

    res.json(analysis);
  } catch (error) {
    log.error('Analysis failed', { error: error.message });
    res.status(500).json({ error: 'Analysis failed' });
  }
});

// ===========================================
// DYNAMIC ROUTES (with :landingId parameter)
// ===========================================

/**
 * GET /api/landing/v2/status/:landingId
 * Get generation status
 * First checks in-memory sessions, then falls back to file/DB storage
 * This allows session recovery after server restart
 */
router.get('/status/:landingId', auth, async (req, res) => {
  const { landingId } = req.params;
  const userId = req.user.id;

  // First, check in-memory session (for active generations)
  const session = orchestrator.getSession(landingId);

  if (session) {
    // Verify ownership
    if (session.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    return res.json({
      landingId: session.id,
      state: session.state,
      progress: session.progress,
      message: session.getStateMessage(),
      analysis: session.analysis,
      palette: session.palette,
      error: session.error,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt
    });
  }

  // No in-memory session - check if landing exists in file storage or DB
  // This handles the case after server restart where old sessions are lost
  try {
    // Check database
    const dbResult = await pool.query(
      `SELECT id, status FROM landings WHERE landing_id = $1 AND user_id = $2`,
      [landingId, userId]
    );

    if (dbResult.rows.length > 0) {
      const dbLanding = dbResult.rows[0];
      // Landing exists in DB - it was completed
      return res.json({
        landingId,
        state: 'complete',
        progress: 100,
        message: 'Генерация завершена',
        analysis: null,
        palette: null,
        error: null
      });
    }

    // Check file storage
    const landing = await assembler.getLanding(landingId, userId);

    if (landing) {
      // Landing exists in file storage - it was completed
      return res.json({
        landingId,
        state: 'complete',
        progress: 100,
        message: 'Генерация завершена',
        analysis: landing.analysis,
        palette: landing.palette,
        error: null
      });
    }

    // Landing doesn't exist anywhere - session is stale
    return res.status(404).json({
      error: 'Session expired',
      code: 'SESSION_EXPIRED',
      message: 'Generation session expired after server restart. Please start a new generation.'
    });
  } catch (error) {
    log.error('Failed to check landing status', { landingId, error: error.message });
    return res.status(500).json({ error: 'Failed to check status' });
  }
});

/**
 * GET /api/landing/v2/:landingId/preview
 * Get landing HTML for iframe preview
 * CRITICAL: Rewrites asset paths to absolute URLs for correct preview
 */
router.get('/:landingId/preview', auth, async (req, res) => {
  const { landingId } = req.params;
  const userId = req.user.id;

  try {
    let html = await assembler.getLandingHtml(landingId, userId);

    if (!html) {
      return res.status(404).json({ error: 'Landing not found' });
    }

    // CRITICAL: Rewrite relative asset paths to absolute API paths
    // Preview is served from /api/landing/v2/:id/preview, but assets are in
    // /api/landing/v2/:id/assets/... so we need to rewrite paths
    const baseAssetUrl = `/api/landing/v2/${landingId}/asset`;

    // Replace relative asset paths with absolute paths
    // Pattern 1: assets/filename.ext
    html = html.replace(
      /(['"])(assets\/[^'"]+)(['"])/g,
      (match, q1, path, q2) => `${q1}${baseAssetUrl}/${path.replace('assets/', '')}${q2}`
    );

    // Pattern 2: sounds/filename.ext
    html = html.replace(
      /(['"])(sounds\/[^'"]+)(['"])/g,
      (match, q1, path, q2) => `${q1}${baseAssetUrl}/${path}${q2}`
    );

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(html);
  } catch (error) {
    log.error('Failed to get preview', { error: error.message });
    res.status(500).json({ error: 'Failed to get preview' });
  }
});

/**
 * GET /api/landing/v2/:landingId/asset/*
 * Serve individual landing assets (images, sounds) for preview
 * NOTE: No auth required - assets are served by landingId (UUID) which is unguessable
 * This allows iframe preview to load assets without passing auth token
 */
router.get('/:landingId/asset/*', async (req, res) => {
  const { landingId } = req.params;
  // Get the asset path from URL (everything after /asset/)
  const assetPath = req.params[0];

  if (!assetPath) {
    return res.status(400).json({ error: 'Asset path required' });
  }

  try {
    // Get landing by UUID only - no user check needed for asset preview
    const landing = await assembler.getLandingByUUID(landingId);

    if (!landing || !landing.landingDir) {
      return res.status(404).json({ error: 'Landing not found' });
    }

    const fs = await import('fs/promises');
    const path = await import('path');

    // SECURITY: Strong path traversal prevention
    // 1. Decode URL encoding (handles %2e%2e and similar)
    const decodedPath = decodeURIComponent(assetPath);

    // 2. Normalize path to resolve all . and .. components
    const normalizedBase = path.normalize(landing.landingDir);
    const fullPath = path.resolve(landing.landingDir, decodedPath);

    // 3. Verify the resolved path starts with the landing directory
    // path.resolve handles all traversal tricks (.., encoded variants, etc.)
    if (!fullPath.startsWith(normalizedBase + path.sep) && fullPath !== normalizedBase) {
      log.warn('Path traversal attempt blocked', {
        landingId,
        originalPath: assetPath,
        resolvedPath: fullPath,
        basePath: normalizedBase
      });
      return res.status(403).json({ error: 'Invalid asset path' });
    }

    // 4. Additional check: no null bytes (can bypass some checks)
    if (assetPath.includes('\0') || decodedPath.includes('\0')) {
      return res.status(400).json({ error: 'Invalid characters in path' });
    }

    // Check if file exists - try exact path first, then fallback to different extensions
    let finalPath = fullPath;
    try {
      await fs.access(fullPath);
    } catch {
      // File not found with exact extension - try common alternatives
      // This handles cases where HTML has .jpg but file is .png or .webp
      const baseName = fullPath.replace(/\.[^/.]+$/, ''); // Remove extension
      // Image and audio extensions to try
      const extensions = ['.png', '.webp', '.jpg', '.jpeg', '.gif', '.svg', '.mp3', '.wav', '.ogg'];

      let found = false;
      for (const ext of extensions) {
        const altPath = baseName + ext;
        try {
          await fs.access(altPath);
          finalPath = altPath;
          found = true;
          log.debug('Asset found with alternative extension', {
            requested: fullPath,
            found: altPath
          });
          break;
        } catch {
          // Try next extension
        }
      }

      if (!found) {
        return res.status(404).json({ error: 'Asset not found' });
      }
    }

    // Determine content type from actual file path (may differ from requested)
    const ext = path.extname(finalPath).toLowerCase();
    const contentTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg'
    };

    const contentType = contentTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');

    // Stream the file
    const { createReadStream } = await import('fs');
    const stream = createReadStream(finalPath);
    stream.pipe(res);
  } catch (error) {
    log.error('Failed to serve asset', { landingId, assetPath, error: error.message });
    res.status(500).json({ error: 'Failed to serve asset' });
  }
});

/**
 * GET /api/landing/v2/:landingId/download
 * Download landing as ZIP
 */
router.get('/:landingId/download', auth, async (req, res) => {
  const { landingId } = req.params;
  const userId = req.user.id;

  try {
    const zipStream = await assembler.getLandingZipStream(landingId, userId);

    if (!zipStream) {
      return res.status(404).json({ error: 'Landing ZIP not found' });
    }

    // Increment download count
    await pool.query(
      `UPDATE landings SET downloads_count = downloads_count + 1
       WHERE landing_id = $1 AND user_id = $2`,
      [landingId, userId]
    ).catch(() => {}); // Ignore if not in DB

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${landingId}.zip"`);

    zipStream.pipe(res);
  } catch (error) {
    log.error('Failed to download', { error: error.message });
    res.status(500).json({ error: 'Failed to download' });
  }
});

// ===========================================
// RATING ROUTES
// ===========================================

/**
 * POST /api/landing/v2/:landingId/rate
 * Rate a landing (1-5 stars)
 */
router.post('/:landingId/rate', auth, async (req, res) => {
  const { landingId } = req.params;
  const userId = req.user.id;
  const {
    score,
    feedbackText,
    designScore,
    codeQualityScore,
    animationScore,
    relevanceScore,
    positiveAspects,
    negativeAspects
  } = req.body;

  // Validate score
  if (!score || score < 1 || score > 5) {
    return res.status(400).json({ error: 'Score must be between 1 and 5' });
  }

  try {
    // Get the DB landing ID
    const landingResult = await pool.query(
      `SELECT id FROM landings WHERE landing_id = $1 AND user_id = $2`,
      [landingId, userId]
    );

    if (landingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Landing not found' });
    }

    const dbLandingId = landingResult.rows[0].id;

    const result = await ratingService.rateLanding({
      landingId: dbLandingId,
      userId,
      score,
      feedbackText,
      designScore,
      codeQualityScore,
      animationScore,
      relevanceScore,
      positiveAspects,
      negativeAspects
    });

    // CRITICAL: Update generation feedback with final score for learning system
    // This connects user ratings to the generation that produced the landing
    try {
      await ratingService.updateGenerationFeedbackScore(dbLandingId, score);
      log.info('Generation feedback score updated', { dbLandingId, score });
    } catch (updateError) {
      log.warn('Could not update generation feedback score', {
        dbLandingId,
        error: updateError.message
      });
    }

    res.json({
      success: true,
      rating: result.rating,
      landingStats: result.landingStats
    });
  } catch (error) {
    log.error('Failed to rate landing', { error: error.message });
    res.status(500).json({ error: 'Failed to rate landing' });
  }
});

/**
 * GET /api/landing/v2/:landingId/rating
 * Get rating for a landing
 */
router.get('/:landingId/rating', auth, async (req, res) => {
  const { landingId } = req.params;
  const userId = req.user.id;

  try {
    const landingResult = await pool.query(
      `SELECT id FROM landings WHERE landing_id = $1 AND user_id = $2`,
      [landingId, userId]
    );

    if (landingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Landing not found' });
    }

    const dbLandingId = landingResult.rows[0].id;
    const avgRating = await ratingService.getLandingAvgRating(dbLandingId);
    const ratings = await ratingService.getLandingRatings(dbLandingId);

    res.json({
      avgRating,
      ratings
    });
  } catch (error) {
    log.error('Failed to get rating', { error: error.message });
    res.status(500).json({ error: 'Failed to get rating' });
  }
});

/**
 * POST /api/landing/v2/admin/import-examples
 * Import curated examples from filesystem to database
 * This bootstraps the RLHF learning system with known-good examples
 */
router.post('/admin/import-examples', auth, adminMiddleware, async (req, res) => {
  try {
    // Dynamic import to avoid loading on startup
    const { addCuratedExample } = await import('../services/rating.service.js');
    const fs = await import('fs/promises');
    const path = await import('path');

    const examplesDir = path.join(process.cwd(), 'docs', 'examples');

    // Example metadata
    const curatedExamples = {
      '585_landing_archive': { type: 'wheel', name: 'Gates of Olympus Premium Wheel', language: 'pl', features: ['animated-loader', 'wheel-8-sectors', 'spin-animation', 'win-celebration', 'modal-popup', 'sound-integration'] },
      '684_landing_archive': { type: 'boxes', name: 'Amazon Style Gift Hunt', language: 'es', features: ['box-selection', 'character-guide', 'speech-bubbles', 'progress-multiplier', '3d-effects'] },
      '688_landing_archive': { type: 'crash', name: 'Grid Road Game', language: 'en', features: ['grid-layout', 'step-progression', 'multiplier-display', 'character-movement'] },
      '691_landing_archive': { type: 'wheel', name: 'French Wheel with Loader', language: 'fr', features: ['animated-loader', 'progress-bar', 'wheel-spin', 'sector-highlight', 'effects-rings'] }
    };

    const results = { imported: 0, skipped: 0, failed: 0 };

    for (const [dirName, metadata] of Object.entries(curatedExamples)) {
      try {
        const htmlPath = path.join(examplesDir, dirName, 'index.html');
        const html = await fs.readFile(htmlPath, 'utf-8');

        const result = await addCuratedExample({
          name: metadata.name,
          mechanicType: metadata.type,
          language: metadata.language,
          htmlCode: html,
          features: metadata.features
        });

        if (result) {
          results.imported++;
        } else {
          results.skipped++;
        }
      } catch (e) {
        log.warn('Failed to import example', { dir: dirName, error: e.message });
        results.failed++;
      }
    }

    const stats = await ratingService.getLearningStats();

    res.json({
      success: true,
      results,
      learningStats: stats
    });
  } catch (error) {
    log.error('Failed to import examples', { error: error.message });
    res.status(500).json({ error: 'Failed to import examples' });
  }
});

// ===========================================
// OTHER DYNAMIC ROUTES
// ===========================================

/**
 * DELETE /api/landing/v2/:landingId
 * Delete a landing
 */
router.delete('/:landingId', auth, async (req, res) => {
  const { landingId } = req.params;
  const userId = req.user.id;

  try {
    // Delete from database
    await pool.query(
      `DELETE FROM landings WHERE landing_id = $1 AND user_id = $2`,
      [landingId, userId]
    );

    // Delete files
    await assembler.deleteLanding(landingId, userId);

    // Clean up session if exists
    orchestrator.deleteSession(landingId);

    res.json({ success: true });
  } catch (error) {
    log.error('Failed to delete landing', { error: error.message });
    res.status(500).json({ error: 'Failed to delete landing' });
  }
});

/**
 * GET /api/landing/v2/:landingId
 * Get landing details (must be LAST among GET routes with :landingId)
 */
router.get('/:landingId', auth, async (req, res) => {
  const { landingId } = req.params;
  const userId = req.user.id;

  try {
    // Try database first
    const result = await pool.query(
      `SELECT * FROM landings WHERE landing_id = $1 AND user_id = $2`,
      [landingId, userId]
    );

    if (result.rows.length > 0) {
      return res.json(result.rows[0]);
    }

    // Try file-based storage
    const landing = await assembler.getLanding(landingId, userId);

    if (!landing) {
      return res.status(404).json({ error: 'Landing not found' });
    }

    res.json(landing);
  } catch (error) {
    log.error('Failed to get landing', { error: error.message });
    res.status(500).json({ error: 'Failed to get landing' });
  }
});

export default router;
