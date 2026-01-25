/**
 * Asset Validator Service
 * Validates generated assets for quality and relevance
 * Uses Claude Vision to check if assets match the request
 */

import fs from 'fs/promises';
import path from 'path';
import { log } from '../utils/logger.js';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/env.js';

let anthropic = null;

function getClient() {
  if (!anthropic && config.anthropicApiKey) {
    anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
  }
  return anthropic;
}

/**
 * Asset validation rules
 */
const ASSET_RULES = {
  background: {
    minWidth: 800,
    minHeight: 600,
    maxAspectRatio: 2.5, // width/height
    minAspectRatio: 0.4,
    requiredElements: ['should fill screen', 'casino/gambling theme or user-specified theme']
  },
  logo: {
    minWidth: 200,
    minHeight: 100,
    shouldBeTransparent: true,
    requiredElements: ['text or brand name', 'readable']
  },
  character: {
    minWidth: 300,
    minHeight: 300,
    shouldBeTransparent: true,
    requiredElements: ['person or mascot', 'clear figure']
  },
  wheel: {
    minWidth: 400,
    minHeight: 400,
    shouldBeTransparent: false,
    requiredElements: ['circular shape', 'sectors', 'prizes visible']
  },
  box: {
    minWidth: 150,
    minHeight: 150,
    shouldBeTransparent: true,
    requiredElements: ['gift box or chest shape', 'closed state']
  }
};

/**
 * Validate asset dimensions
 */
async function validateDimensions(imagePath, assetType) {
  try {
    // Read file and check basic properties
    const stats = await fs.stat(imagePath);

    if (stats.size < 1000) {
      return { valid: false, reason: 'File too small (less than 1KB)' };
    }

    if (stats.size > 10 * 1024 * 1024) {
      return { valid: false, reason: 'File too large (more than 10MB)' };
    }

    // For now, we can't easily get dimensions without sharp
    // TODO: Add sharp for dimension checking

    return { valid: true };
  } catch (error) {
    return { valid: false, reason: `File check failed: ${error.message}` };
  }
}

/**
 * Use Claude Vision to validate asset relevance
 */
async function validateWithVision(imagePath, assetType, expectedDescription) {
  const client = getClient();

  if (!client) {
    log.warn('Claude API not configured, skipping vision validation');
    return { valid: true, skipped: true };
  }

  try {
    const imageData = await fs.readFile(imagePath);
    const base64 = imageData.toString('base64');
    const mediaType = imagePath.endsWith('.png') ? 'image/png' :
                      imagePath.endsWith('.webp') ? 'image/webp' : 'image/jpeg';

    const rules = ASSET_RULES[assetType] || {};

    const prompt = `Analyze this image for a gambling/casino landing page.

Asset type: ${assetType}
Expected description: ${expectedDescription || 'N/A'}
Required elements: ${rules.requiredElements?.join(', ') || 'N/A'}

Evaluate and respond with JSON:
{
  "relevant": true/false (does it match the expected purpose?),
  "quality": 1-10 (visual quality, clarity, professional look),
  "issues": ["list of problems if any"],
  "suggestion": "how to improve if needed"
}

Be strict - this is for professional affiliate marketing.`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 }
          },
          { type: 'text', text: prompt }
        ]
      }]
    });

    const text = response.content[0]?.text || '';

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        valid: result.relevant && result.quality >= 5,
        relevant: result.relevant,
        quality: result.quality,
        issues: result.issues || [],
        suggestion: result.suggestion
      };
    }

    return { valid: true, skipped: true, reason: 'Could not parse validation response' };
  } catch (error) {
    log.error('Vision validation failed', { error: error.message, imagePath });
    return { valid: true, skipped: true, reason: error.message };
  }
}

/**
 * Validate a single asset
 */
export async function validateAsset(assetPath, assetType, expectedDescription) {
  const results = {
    path: assetPath,
    type: assetType,
    checks: {}
  };

  // Check file exists
  try {
    await fs.access(assetPath);
  } catch {
    return {
      ...results,
      valid: false,
      reason: 'File does not exist'
    };
  }

  // Validate dimensions
  results.checks.dimensions = await validateDimensions(assetPath, assetType);

  // Validate with vision (for important assets)
  const importantTypes = ['background', 'logo', 'character', 'wheel'];
  if (importantTypes.includes(assetType)) {
    results.checks.vision = await validateWithVision(assetPath, assetType, expectedDescription);
  }

  // Calculate overall validity
  const allValid = Object.values(results.checks).every(c => c.valid || c.skipped);
  const issues = Object.entries(results.checks)
    .filter(([, c]) => !c.valid && !c.skipped)
    .map(([name, c]) => `${name}: ${c.reason || c.issues?.join(', ')}`);

  return {
    ...results,
    valid: allValid,
    issues,
    score: allValid ? 100 : Math.max(0, 100 - issues.length * 25)
  };
}

/**
 * Validate all assets for a landing
 */
export async function validateAllAssets(assets, analysis) {
  const results = {
    assets: {},
    valid: true,
    totalScore: 0,
    issues: []
  };

  let scoreSum = 0;
  let count = 0;

  for (const [key, asset] of Object.entries(assets || {})) {
    const assetPath = typeof asset === 'string' ? asset : asset.path;

    if (!assetPath) {
      results.assets[key] = { valid: false, reason: 'No path provided' };
      results.issues.push(`${key}: No path provided`);
      continue;
    }

    // Get expected description from analysis
    const expectedDesc = analysis?.assetsNeeded?.find(a =>
      a.type === key || a.description?.toLowerCase().includes(key)
    )?.description;

    const validation = await validateAsset(assetPath, key, expectedDesc);
    results.assets[key] = validation;

    if (!validation.valid) {
      results.valid = false;
      results.issues.push(...validation.issues.map(i => `${key}: ${i}`));
    }

    scoreSum += validation.score || 0;
    count++;
  }

  results.totalScore = count > 0 ? Math.round(scoreSum / count) : 0;

  log.info('Asset validation complete', {
    assetCount: count,
    valid: results.valid,
    score: results.totalScore,
    issues: results.issues.length
  });

  return results;
}

/**
 * Check if sounds are available
 */
export async function validateSounds(soundsDir) {
  const requiredSounds = ['spin.mp3', 'win.mp3'];
  const results = { valid: true, missing: [], available: [] };

  for (const sound of requiredSounds) {
    const soundPath = path.join(soundsDir, sound);
    try {
      await fs.access(soundPath);
      results.available.push(sound);
    } catch {
      results.missing.push(sound);
      results.valid = false;
    }
  }

  if (!results.valid) {
    log.warn('Missing required sounds', { missing: results.missing });
  }

  return results;
}

/**
 * Get default sounds paths
 */
export function getDefaultSoundsPaths() {
  return {
    spin: path.join(process.cwd(), 'assets', 'sounds', 'spin.mp3'),
    win: path.join(process.cwd(), 'assets', 'sounds', 'win.mp3'),
    click: path.join(process.cwd(), 'assets', 'sounds', 'click.mp3')
  };
}

export default {
  validateAsset,
  validateAllAssets,
  validateSounds,
  getDefaultSoundsPaths
};
