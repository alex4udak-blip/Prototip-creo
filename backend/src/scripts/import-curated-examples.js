#!/usr/bin/env node
/**
 * Import Curated Examples Script
 *
 * Loads existing high-quality landing examples from filesystem
 * and imports them into the database as curated examples (rating 5.0)
 *
 * This bootstraps the RLHF learning system with known-good examples
 * so the first generation will already have quality references.
 *
 * Usage: node src/scripts/import-curated-examples.js
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Navigate to project root
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

// Example metadata with quality annotations
const CURATED_EXAMPLES = {
  '585_landing_archive': {
    type: 'wheel',
    name: 'Gates of Olympus Premium Wheel',
    language: 'pl',
    features: [
      'animated-loader',
      'wheel-8-sectors',
      'spin-animation',
      'win-celebration',
      'modal-popup',
      'sound-integration',
      'protection-code',
      'responsive-design',
      'css-variables',
      'touch-events'
    ],
    quality: 5, // Premium example - use as primary reference
    description: 'Premium wheel game with all production features. Perfect for Gates of Olympus style slots.'
  },
  '684_landing_archive': {
    type: 'boxes',
    name: 'Amazon Style Gift Hunt',
    language: 'es',
    features: [
      'box-selection',
      'character-guide',
      'speech-bubbles',
      'progress-multiplier',
      '3d-effects',
      'shake-animation',
      'rewards-reveal',
      'sound-effects',
      'mobile-first'
    ],
    quality: 5, // Premium example - best boxes implementation
    description: 'Best-in-class gift box selection game with character guide and multiplier system.'
  },
  '688_landing_archive': {
    type: 'crash',
    name: 'Grid Road Game',
    language: 'en',
    features: [
      'grid-layout',
      'step-progression',
      'multiplier-display',
      'safe-path-reveal',
      'character-movement',
      'danger-indicators',
      'win-animation'
    ],
    quality: 5, // Premium example - crash/grid style
    description: 'Chicken Road style grid game with multiplier progression.'
  },
  '691_landing_archive': {
    type: 'wheel',
    name: 'French Wheel with Loader',
    language: 'fr',
    features: [
      'animated-loader',
      'progress-bar',
      'wheel-spin',
      'sector-highlight',
      'effects-rings',
      'modal-celebration',
      'responsive-units',
      'sound-integration'
    ],
    quality: 5, // Premium example - best loader implementation
    description: 'Clean wheel implementation with excellent loader and effects.'
  },
  '678_landing_archive': {
    type: 'wheel',
    name: 'German Premium Wheel',
    language: 'de',
    features: [
      'wheel-effects',
      'confetti',
      'celebration',
      'responsive'
    ],
    quality: 4,
    description: 'German wheel with confetti effects.'
  },
  '659_landing_archive': {
    type: 'boxes',
    name: 'Gift Boxes Basic',
    language: 'en',
    features: [
      'box-selection',
      'shake-animation',
      'rewards-popup'
    ],
    quality: 4,
    description: 'Simple gift box selection game.'
  }
};

/**
 * Extract code sections from HTML for structured storage
 */
function extractCodeSections(html) {
  const sections = {
    css: null,
    js: null,
    config: null
  };

  // Extract all CSS
  const styleMatches = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
  if (styleMatches) {
    sections.css = styleMatches
      .map(s => s.replace(/<\/?style[^>]*>/gi, ''))
      .join('\n\n');
  }

  // Extract all inline JavaScript
  const scriptMatches = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
  if (scriptMatches) {
    const inlineScripts = scriptMatches.filter(s => !s.includes('src='));
    sections.js = inlineScripts
      .map(s => s.replace(/<\/?script[^>]*>/gi, ''))
      .join('\n\n');
  }

  // Extract CONFIG object
  const configMatch = html.match(/const\s+CONFIG\s*=\s*\{[\s\S]*?\};/);
  if (configMatch) {
    sections.config = configMatch[0];
  }

  return sections;
}

/**
 * Analyze HTML quality for validation
 */
function analyzeQuality(html) {
  const checks = {
    hasViewport: html.includes('viewport') && html.includes('user-scalable=no'),
    hasLoader: html.includes('class="loader') || html.includes('id="loader'),
    hasConfig: html.includes('const CONFIG'),
    hasModal: html.includes('class="modal') || html.includes('id="modal'),
    hasProtection: html.includes('contextmenu') && html.includes('preventDefault'),
    hasSounds: html.includes('new Audio') || html.includes('.mp3'),
    hasResponsive: html.includes('em') && (html.includes('vw') || html.includes('vh')),
    hasAnimations: html.includes('@keyframes'),
    hasTouchEvents: html.includes('touch') || html.includes('click'),
    hasOfferUrl: html.includes('offerUrl') || html.includes('OFFER_URL')
  };

  const score = Object.values(checks).filter(Boolean).length;
  const maxScore = Object.keys(checks).length;

  return {
    checks,
    score,
    maxScore,
    percentage: Math.round((score / maxScore) * 100)
  };
}

/**
 * Main import function
 */
async function importExamples() {
  console.log('🚀 Starting Curated Examples Import...\n');

  // Dynamic import for ES modules compatibility
  const { default: db } = await import('../db/index.js');
  const { addCuratedExample, getLearningStats } = await import('../services/rating.service.js');

  const examplesDir = path.join(PROJECT_ROOT, 'docs', 'examples');
  const results = {
    imported: 0,
    skipped: 0,
    failed: 0,
    details: []
  };

  // Get stats before import
  let statsBefore;
  try {
    statsBefore = await getLearningStats();
  } catch (e) {
    console.log('⚠️  Could not get initial stats (tables might not exist yet)');
    statsBefore = { curated_examples: 0 };
  }

  console.log(`📊 Current state: ${statsBefore.curated_examples || 0} curated examples\n`);

  // Process each example
  for (const [dirName, metadata] of Object.entries(CURATED_EXAMPLES)) {
    const htmlPath = path.join(examplesDir, dirName, 'index.html');

    console.log(`📁 Processing: ${dirName}`);
    console.log(`   Type: ${metadata.type}, Language: ${metadata.language}`);

    try {
      // Read HTML file
      const html = await fs.readFile(htmlPath, 'utf-8');
      console.log(`   HTML size: ${(html.length / 1024).toFixed(1)} KB`);

      // Analyze quality
      const quality = analyzeQuality(html);
      console.log(`   Quality score: ${quality.percentage}% (${quality.score}/${quality.maxScore})`);

      // Extract code sections
      const sections = extractCodeSections(html);
      console.log(`   Sections: CSS=${sections.css ? 'yes' : 'no'}, JS=${sections.js ? 'yes' : 'no'}, Config=${sections.config ? 'yes' : 'no'}`);

      // Import to database
      const result = await addCuratedExample({
        name: metadata.name,
        mechanicType: metadata.type,
        language: metadata.language,
        htmlCode: html,
        cssCode: sections.css,
        jsCode: sections.js,
        configCode: sections.config,
        features: metadata.features
      });

      if (result) {
        console.log(`   ✅ Imported successfully (ID: ${result.id})\n`);
        results.imported++;
        results.details.push({
          name: metadata.name,
          type: metadata.type,
          id: result.id,
          quality: quality.percentage
        });
      } else {
        console.log(`   ⏭️  Already exists, skipped\n`);
        results.skipped++;
      }

    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}\n`);
      results.failed++;
    }
  }

  // Summary
  console.log('═══════════════════════════════════════════════');
  console.log('📊 IMPORT SUMMARY');
  console.log('═══════════════════════════════════════════════');
  console.log(`✅ Imported: ${results.imported}`);
  console.log(`⏭️  Skipped:  ${results.skipped}`);
  console.log(`❌ Failed:   ${results.failed}`);
  console.log('');

  if (results.details.length > 0) {
    console.log('📋 Imported Examples:');
    for (const detail of results.details) {
      console.log(`   • ${detail.name} (${detail.type}) - Quality: ${detail.quality}%`);
    }
  }

  // Get stats after import
  try {
    const statsAfter = await getLearningStats();
    console.log('\n📈 Learning System Status:');
    console.log(`   Curated examples: ${statsAfter.curated_examples || 0}`);
    console.log(`   Active examples:  ${statsAfter.active_examples || 0}`);
    console.log(`   Total ratings:    ${statsAfter.total_ratings || 0}`);
  } catch (e) {
    // Ignore
  }

  console.log('\n✨ Import complete! First generation will now use high-quality examples.\n');

  // Close database connection
  await db.end();
  process.exit(0);
}

// Run if called directly
importExamples().catch(error => {
  console.error('❌ Import failed:', error);
  process.exit(1);
});
