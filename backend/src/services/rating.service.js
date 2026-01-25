/**
 * Rating Service - Enables RLHF-style learning for landing generation
 *
 * How it works:
 * 1. User generates a landing
 * 2. User rates it (1-5 stars) with optional feedback
 * 3. High-rated landings (4.5+) auto-promote to examples
 * 4. Next generation uses best-rated examples as few-shot prompts
 * 5. System continuously improves based on human feedback
 */

import db from '../db/index.js';
import { log } from '../utils/logger.js';

/**
 * Submit a rating for a landing
 */
export async function rateLanding({
  landingId,
  userId,
  score,
  feedbackText,
  designScore,
  codeQualityScore,
  animationScore,
  relevanceScore,
  positiveAspects,
  negativeAspects
}) {
  try {
    const result = await db.query(`
      INSERT INTO landing_ratings (
        landing_id, user_id, score, feedback_text,
        design_score, code_quality_score, animation_score, relevance_score,
        positive_aspects, negative_aspects
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (user_id, landing_id) WHERE user_id IS NOT NULL
      DO UPDATE SET
        score = EXCLUDED.score,
        feedback_text = EXCLUDED.feedback_text,
        design_score = EXCLUDED.design_score,
        code_quality_score = EXCLUDED.code_quality_score,
        animation_score = EXCLUDED.animation_score,
        relevance_score = EXCLUDED.relevance_score,
        positive_aspects = EXCLUDED.positive_aspects,
        negative_aspects = EXCLUDED.negative_aspects,
        updated_at = NOW()
      RETURNING *
    `, [
      landingId,
      userId,
      score,
      feedbackText || null,
      designScore || null,
      codeQualityScore || null,
      animationScore || null,
      relevanceScore || null,
      JSON.stringify(positiveAspects || []),
      JSON.stringify(negativeAspects || [])
    ]);

    log.info('Landing rated', {
      landingId,
      userId,
      score,
      hasDetailedFeedback: !!(designScore || codeQualityScore)
    });

    // Check if this triggered auto-promotion (via DB trigger)
    const avgResult = await db.query(`
      SELECT AVG(score)::DECIMAL(3,2) as avg_score, COUNT(*) as count
      FROM landing_ratings WHERE landing_id = $1
    `, [landingId]);

    const { avg_score, count } = avgResult.rows[0];

    return {
      rating: result.rows[0],
      landingStats: {
        avgScore: parseFloat(avg_score),
        ratingCount: parseInt(count),
        isPromoted: parseFloat(avg_score) >= 4.5 && parseInt(count) >= 3
      }
    };
  } catch (error) {
    log.error('Failed to rate landing', { landingId, error: error.message });
    throw error;
  }
}

/**
 * Get ratings for a landing
 */
export async function getLandingRatings(landingId) {
  const result = await db.query(`
    SELECT
      lr.*,
      u.email as user_email
    FROM landing_ratings lr
    LEFT JOIN users u ON u.id = lr.user_id
    WHERE lr.landing_id = $1
    ORDER BY lr.created_at DESC
  `, [landingId]);

  return result.rows;
}

/**
 * Get average rating for a landing
 */
export async function getLandingAvgRating(landingId) {
  const result = await db.query(`
    SELECT
      AVG(score)::DECIMAL(3,2) as avg_score,
      AVG(design_score)::DECIMAL(3,2) as avg_design,
      AVG(code_quality_score)::DECIMAL(3,2) as avg_code_quality,
      AVG(animation_score)::DECIMAL(3,2) as avg_animation,
      AVG(relevance_score)::DECIMAL(3,2) as avg_relevance,
      COUNT(*) as rating_count
    FROM landing_ratings
    WHERE landing_id = $1
  `, [landingId]);

  return result.rows[0];
}

/**
 * Get best examples for a mechanic type (for few-shot learning)
 * This is the KEY function for "learning" - it returns top-rated examples
 */
export async function getBestExamplesForMechanic(mechanicType, limit = 3) {
  try {
    // First try DB function
    const result = await db.query(`
      SELECT * FROM get_best_examples($1, $2)
    `, [mechanicType, limit]);

    if (result.rows.length > 0) {
      log.info('Using DB examples for generation', {
        mechanicType,
        count: result.rows.length,
        avgRatings: result.rows.map(r => r.avg_rating)
      });
      return result.rows;
    }

    // Fallback: get any active examples
    const fallback = await db.query(`
      SELECT id, name, html_code, features, avg_rating, usage_count
      FROM landing_examples
      WHERE is_active = true
      ORDER BY avg_rating DESC, is_curated DESC
      LIMIT $1
    `, [limit]);

    return fallback.rows;
  } catch (error) {
    log.warn('Could not get DB examples', { error: error.message });
    return [];
  }
}

/**
 * Record generation feedback (what worked, what didn't)
 */
export async function recordGenerationFeedback({
  landingId,
  originalPrompt,
  mechanicType,
  slotName,
  language,
  examplesUsed,
  promptTokens,
  completionTokens
}) {
  try {
    const result = await db.query(`
      INSERT INTO generation_feedback (
        landing_id, original_prompt, mechanic_type, slot_name, language,
        examples_used, prompt_tokens, completion_tokens
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [
      landingId,
      originalPrompt,
      mechanicType,
      slotName,
      language,
      JSON.stringify(examplesUsed || []),
      promptTokens,
      completionTokens
    ]);

    return result.rows[0].id;
  } catch (error) {
    log.warn('Could not record generation feedback', { error: error.message });
    return null;
  }
}

/**
 * Update generation feedback with final score (after user rates)
 */
export async function updateGenerationFeedbackScore(landingId, finalScore) {
  try {
    await db.query(`
      UPDATE generation_feedback
      SET final_score = $2
      WHERE landing_id = $1
    `, [landingId, finalScore]);
  } catch (error) {
    log.warn('Could not update generation feedback score', { error: error.message });
  }
}

/**
 * Get successful patterns for a mechanic type
 * This helps understand what works well
 */
export async function getSuccessfulPatterns(mechanicType, minScore = 4) {
  const result = await db.query(`
    SELECT
      gf.mechanic_type,
      gf.slot_name,
      gf.examples_used,
      gf.successful_patterns,
      gf.final_score
    FROM generation_feedback gf
    WHERE gf.mechanic_type = $1
      AND gf.final_score >= $2
    ORDER BY gf.final_score DESC
    LIMIT 20
  `, [mechanicType, minScore]);

  return result.rows;
}

/**
 * Manually add a curated example (for bootstrapping)
 */
export async function addCuratedExample({
  name,
  mechanicType,
  language,
  htmlCode,
  cssCode,
  jsCode,
  configCode,
  features
}) {
  const result = await db.query(`
    INSERT INTO landing_examples (
      name, mechanic_type, language, html_code,
      css_code, js_code, config_code, features,
      is_curated, is_active, avg_rating
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, true, 5.0)
    ON CONFLICT DO NOTHING
    RETURNING *
  `, [
    name,
    mechanicType,
    language || 'en',
    htmlCode,
    cssCode || null,
    jsCode || null,
    configCode || null,
    JSON.stringify(features || [])
  ]);

  if (result.rows.length > 0) {
    log.info('Added curated example', { name, mechanicType });
  }

  return result.rows[0];
}

/**
 * Mark example as used (for tracking)
 */
export async function markExampleUsed(exampleId) {
  await db.query(`
    UPDATE landing_examples
    SET usage_count = usage_count + 1, last_used_at = NOW()
    WHERE id = $1
  `, [exampleId]);
}

/**
 * Get learning statistics
 */
export async function getLearningStats() {
  const stats = await db.query(`
    SELECT
      (SELECT COUNT(*) FROM landing_ratings) as total_ratings,
      (SELECT COUNT(*) FROM landing_examples WHERE is_active = true) as active_examples,
      (SELECT COUNT(*) FROM landing_examples WHERE is_curated = true) as curated_examples,
      (SELECT COUNT(*) FROM landing_examples WHERE is_curated = false) as auto_promoted_examples,
      (SELECT AVG(score)::DECIMAL(3,2) FROM landing_ratings) as global_avg_rating,
      (SELECT COUNT(*) FROM generation_feedback WHERE final_score >= 4) as successful_generations
  `);

  return stats.rows[0];
}

/**
 * Import filesystem examples as curated examples
 * Call this once to bootstrap the system
 */
export async function importFilesystemExamples() {
  // This will be called from examples-loader.service.js
  // to seed the database with existing examples
  log.info('Importing filesystem examples to database...');

  const { loadAllExamples } = await import('./examples-loader.service.js');
  const examples = await loadAllExamples();

  let imported = 0;
  for (const example of examples) {
    const cached = await import('./examples-loader.service.js')
      .then(m => m.examplesCache?.get(example.id));

    if (cached?.html) {
      try {
        await addCuratedExample({
          name: example.name,
          mechanicType: example.type,
          language: example.language,
          htmlCode: cached.html,
          cssCode: cached.sections?.css,
          jsCode: cached.sections?.js,
          configCode: cached.sections?.config,
          features: example.features
        });
        imported++;
      } catch (e) {
        log.warn('Failed to import example', { id: example.id, error: e.message });
      }
    }
  }

  log.info('Imported filesystem examples', { imported, total: examples.length });
  return imported;
}

export default {
  rateLanding,
  getLandingRatings,
  getLandingAvgRating,
  getBestExamplesForMechanic,
  recordGenerationFeedback,
  updateGenerationFeedbackScore,
  getSuccessfulPatterns,
  addCuratedExample,
  markExampleUsed,
  getLearningStats,
  importFilesystemExamples
};
