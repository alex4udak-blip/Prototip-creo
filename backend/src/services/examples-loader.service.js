/**
 * Examples Loader Service
 * Loads landing examples from filesystem and provides them to Claude
 * for few-shot learning approach
 */

import fs from 'fs/promises';
import path from 'path';
import { log } from '../utils/logger.js';

// Cache for loaded examples
const examplesCache = new Map();

/**
 * Example metadata structure
 */
const EXAMPLE_METADATA = {
  '585_landing_archive': {
    type: 'wheel',
    name: 'Gates of Olympus Wheel',
    language: 'pl',
    features: ['loader', 'wheel spin', 'win animation', 'modal', 'sounds', 'protection']
  },
  '642_landing_archive': {
    type: 'wheel',
    name: 'Generic Wheel',
    language: 'en',
    features: ['wheel', 'prizes', 'spin button']
  },
  '653_landing_archive': {
    type: 'wheel',
    name: 'Wheel Game',
    language: 'en',
    features: ['wheel', 'modal']
  },
  '659_landing_archive': {
    type: 'boxes',
    name: 'Gift Boxes Game',
    language: 'en',
    features: ['box selection', 'shake animation', 'rewards popup']
  },
  '678_landing_archive': {
    type: 'wheel',
    name: 'Premium Wheel',
    language: 'de',
    features: ['wheel', 'effects', 'confetti']
  },
  '681_landing_archive': {
    type: 'wheel',
    name: 'Simple Wheel',
    language: 'en',
    features: ['wheel', 'basic']
  },
  '684_landing_archive': {
    type: 'boxes',
    name: 'Amazon Boxes Hunt',
    language: 'es',
    features: ['boxes', 'character', 'speech bubble', 'progress bar', 'multiplier', '3D effects']
  },
  '688_landing_archive': {
    type: 'crash',
    name: 'Grid Game',
    language: 'en',
    features: ['grid', 'progression', 'multiplier']
  },
  '691_landing_archive': {
    type: 'wheel',
    name: 'Wheel with Loader',
    language: 'en',
    features: ['loader', 'wheel']
  }
};

/**
 * Load example HTML from filesystem
 */
async function loadExampleHtml(exampleDir) {
  const htmlPath = path.join(exampleDir, 'index.html');

  try {
    const html = await fs.readFile(htmlPath, 'utf-8');
    return html;
  } catch (error) {
    log.warn('Failed to load example HTML', { exampleDir, error: error.message });
    return null;
  }
}

/**
 * Extract key code sections from HTML for learning
 */
function extractCodeSections(html) {
  const sections = {};

  // Extract CSS
  const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
  if (styleMatch) {
    sections.css = styleMatch.map(s => s.replace(/<\/?style[^>]*>/gi, '')).join('\n');
  }

  // Extract JavaScript
  const scriptMatch = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);
  if (scriptMatch) {
    sections.js = scriptMatch
      .filter(s => !s.includes('src=')) // Only inline scripts
      .map(s => s.replace(/<\/?script[^>]*>/gi, ''))
      .join('\n');
  }

  // Extract body content (without scripts)
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    sections.body = bodyMatch[1]
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .trim();
  }

  // Extract CONFIG
  const configMatch = html.match(/const\s+CONFIG\s*=\s*\{[\s\S]*?\};/);
  if (configMatch) {
    sections.config = configMatch[0];
  }

  // Extract loader section
  const loaderMatch = html.match(/<div[^>]*class="[^"]*loader[^"]*"[\s\S]*?<\/div>\s*<\/div>/i);
  if (loaderMatch) {
    sections.loader = loaderMatch[0];
  }

  // Extract modal section
  const modalMatch = html.match(/<div[^>]*class="[^"]*modal[^"]*"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/i);
  if (modalMatch) {
    sections.modal = modalMatch[0];
  }

  return sections;
}

/**
 * Load all examples from filesystem
 */
export async function loadAllExamples() {
  const examplesDir = path.join(process.cwd(), 'docs', 'examples');

  try {
    const entries = await fs.readdir(examplesDir, { withFileTypes: true });
    const examples = [];

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;

      const meta = EXAMPLE_METADATA[entry.name];
      if (!meta) continue;

      const examplePath = path.join(examplesDir, entry.name);
      const html = await loadExampleHtml(examplePath);

      if (html) {
        const sections = extractCodeSections(html);

        examples.push({
          id: entry.name,
          ...meta,
          sections,
          htmlLength: html.length,
          hasLoader: !!sections.loader,
          hasModal: !!sections.modal,
          hasConfig: !!sections.config
        });

        examplesCache.set(entry.name, { html, sections, meta });
      }
    }

    log.info('Loaded landing examples', {
      count: examples.length,
      types: [...new Set(examples.map(e => e.type))]
    });

    return examples;
  } catch (error) {
    log.error('Failed to load examples', { error: error.message });
    return [];
  }
}

/**
 * Get examples by mechanic type
 */
export async function getExamplesByType(mechanicType) {
  if (examplesCache.size === 0) {
    await loadAllExamples();
  }

  const type = (mechanicType || '').toLowerCase();
  const examples = [];

  for (const [id, data] of examplesCache) {
    // Match type or related types
    if (data.meta.type === type ||
        (type.includes('wheel') && data.meta.type === 'wheel') ||
        (type.includes('box') && data.meta.type === 'boxes') ||
        (type.includes('crash') && data.meta.type === 'crash') ||
        (type.includes('grid') && data.meta.type === 'crash')) {
      examples.push({
        id,
        ...data.meta,
        sections: data.sections
      });
    }
  }

  // If no match, return best examples (highest quality)
  if (examples.length === 0) {
    const bestIds = ['585_landing_archive', '684_landing_archive'];
    for (const id of bestIds) {
      const data = examplesCache.get(id);
      if (data) {
        examples.push({ id, ...data.meta, sections: data.sections });
      }
    }
  }

  return examples;
}

/**
 * Get best example for a specific mechanic type
 * Returns the full HTML as reference
 */
export async function getBestExampleForMechanic(mechanicType) {
  const examples = await getExamplesByType(mechanicType);

  if (examples.length === 0) {
    return null;
  }

  // Prefer examples with more features
  const sorted = examples.sort((a, b) =>
    (b.features?.length || 0) - (a.features?.length || 0)
  );

  const best = sorted[0];
  const cached = examplesCache.get(best.id);

  return cached ? {
    ...best,
    html: cached.html,
    sections: cached.sections
  } : null;
}

/**
 * Build Claude prompt with real examples
 */
export async function buildPromptWithExamples(mechanicType, maxExamples = 2) {
  const examples = await getExamplesByType(mechanicType);

  if (examples.length === 0) {
    log.warn('No examples found for mechanic type', { mechanicType });
    return null;
  }

  // Take top examples
  const topExamples = examples.slice(0, maxExamples);

  let prompt = `## PRODUCTION EXAMPLES TO LEARN FROM:\n\n`;

  for (const example of topExamples) {
    prompt += `### Example: ${example.name} (${example.type})\n`;
    prompt += `Language: ${example.language}\n`;
    prompt += `Features: ${example.features?.join(', ') || 'N/A'}\n\n`;

    if (example.sections.config) {
      prompt += `CONFIG pattern:\n\`\`\`javascript\n${example.sections.config}\n\`\`\`\n\n`;
    }

    if (example.sections.loader) {
      prompt += `Loader HTML:\n\`\`\`html\n${example.sections.loader}\n\`\`\`\n\n`;
    }

    // Add CSS snippets (truncated for token efficiency)
    if (example.sections.css) {
      const cssSnippet = example.sections.css.slice(0, 3000);
      prompt += `CSS patterns:\n\`\`\`css\n${cssSnippet}\n...\`\`\`\n\n`;
    }

    // Add JS snippets (truncated)
    if (example.sections.js) {
      const jsSnippet = example.sections.js.slice(0, 3000);
      prompt += `JavaScript patterns:\n\`\`\`javascript\n${jsSnippet}\n...\`\`\`\n\n`;
    }

    prompt += `---\n\n`;
  }

  prompt += `Use these EXACT patterns in your generated code. Adapt for the user's request.\n`;

  return prompt;
}

/**
 * Validate that generated HTML has required components
 */
export function validateGeneratedHtml(html) {
  const issues = [];

  // Check for CONFIG
  if (!html.includes('const CONFIG')) {
    issues.push('Missing CONFIG object');
  }

  // Check for loader
  if (!html.includes('class="loader') && !html.includes('id="loader')) {
    issues.push('Missing loader component');
  }

  // Check for modal
  if (!html.includes('class="modal') && !html.includes('id="modal')) {
    issues.push('Missing win modal');
  }

  // Check for protection code
  if (!html.includes('contextmenu') || !html.includes('preventDefault')) {
    issues.push('Missing protection code');
  }

  // Check for sounds
  if (!html.includes('new Audio') && !html.includes('sounds/')) {
    issues.push('Missing sound integration');
  }

  // Check for responsive viewport
  if (!html.includes('viewport') || !html.includes('user-scalable=no')) {
    issues.push('Missing or incorrect viewport meta');
  }

  // Check for offer URL redirect
  if (!html.includes('offerUrl') && !html.includes('OFFER_URL')) {
    issues.push('Missing offer URL redirect');
  }

  return {
    valid: issues.length === 0,
    issues,
    score: Math.max(0, 100 - issues.length * 15) // Deduct 15 points per issue
  };
}

export default {
  loadAllExamples,
  getExamplesByType,
  getBestExampleForMechanic,
  buildPromptWithExamples,
  validateGeneratedHtml
};
