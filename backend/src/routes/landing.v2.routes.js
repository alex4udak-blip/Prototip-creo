import { Router } from 'express';
import { authMiddleware as auth } from '../middleware/auth.middleware.js';
import { log } from '../utils/logger.js';
import { pool } from '../db/connection.js';
import * as orchestrator from '../services/landing/orchestrator.service.js';
import * as assembler from '../services/landing/assembler.service.js';
import * as claudeService from '../services/claude.service.js';
import * as ratingService from '../services/rating.service.js';

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
 * GET /api/landing/v2/list
 * List user's landings
 */
router.get('/list', auth, async (req, res) => {
  const userId = req.user.id;
  const { limit = 20, offset = 0 } = req.query;

  try {
    const result = await pool.query(
      `SELECT id, landing_id, type, slot_name, language, status,
              prizes, palette, preview_path, downloads_count,
              created_at, updated_at
       FROM landings
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, parseInt(limit), parseInt(offset)]
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
 */
router.get('/status/:landingId', auth, async (req, res) => {
  const { landingId } = req.params;

  const session = orchestrator.getSession(landingId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  // Verify ownership
  if (session.userId !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  res.json({
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
});

/**
 * GET /api/landing/v2/:landingId/preview
 * Get landing HTML for iframe preview
 */
router.get('/:landingId/preview', auth, async (req, res) => {
  const { landingId } = req.params;
  const userId = req.user.id;

  try {
    const html = await assembler.getLandingHtml(landingId, userId);

    if (!html) {
      return res.status(404).json({ error: 'Landing not found' });
    }

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    log.error('Failed to get preview', { error: error.message });
    res.status(500).json({ error: 'Failed to get preview' });
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
 * GET /api/landing/v2/stats/learning
 * Get learning statistics (how the system is improving)
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
