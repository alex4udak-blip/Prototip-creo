import fs from 'fs/promises';
import path from 'path';
import archiver from 'archiver';
import { createWriteStream } from 'fs';
import { config } from '../../config/env.js';
import { log } from '../../utils/logger.js';

/**
 * Landing assembler service
 * Creates ZIP archive with all landing page assets
 */

/**
 * Default sound files (bundled with backend)
 */
const DEFAULT_SOUNDS = {
  spin: 'sounds/spin.mp3',
  win: 'sounds/win.mp3',
  click: 'sounds/click.mp3'
};

/**
 * Validate and sanitize path to prevent path traversal attacks
 * @param {string} basePath - Base directory path
 * @param {string} userPath - User-provided path segment
 * @returns {string|null} Safe path or null if invalid
 */
function sanitizePath(basePath, userPath) {
  if (!userPath || typeof userPath !== 'string') {
    return null;
  }

  // Remove any null bytes
  const cleanPath = userPath.replace(/\0/g, '');

  // Resolve the full path
  const resolvedPath = path.resolve(basePath, cleanPath);

  // Ensure the resolved path is within the base path
  const normalizedBase = path.resolve(basePath);
  if (!resolvedPath.startsWith(normalizedBase + path.sep) && resolvedPath !== normalizedBase) {
    log.warn('Path traversal attempt detected', { basePath, userPath, resolvedPath });
    return null;
  }

  return resolvedPath;
}

/**
 * Validate landingId format (UUID or alphanumeric)
 * @param {string} landingId - Landing ID to validate
 * @returns {boolean} Whether the ID is valid
 */
function isValidLandingId(landingId) {
  if (!landingId || typeof landingId !== 'string') {
    return false;
  }
  // Allow UUIDs and alphanumeric strings up to 64 chars
  return /^[a-zA-Z0-9-_]{1,64}$/.test(landingId);
}

/**
 * Validate userId format
 * @param {number|string} userId - User ID to validate
 * @returns {boolean} Whether the ID is valid
 */
function isValidUserId(userId) {
  const id = Number(userId);
  return Number.isInteger(id) && id > 0 && id < Number.MAX_SAFE_INTEGER;
}

/**
 * Assemble landing page into ZIP archive
 * @param {Object} params
 * @param {string} params.landingId - Unique landing ID
 * @param {number} params.userId - User ID
 * @param {string} params.html - Generated HTML content
 * @param {Object} params.assets - Asset paths { key: { path, url } }
 * @param {Object} params.sounds - Sound paths { key: path }
 * @param {Object} params.analysis - Analysis results
 * @returns {Promise<{ zipPath: string, previewPath: string }>}
 */
export async function assembleLanding(params) {
  const { landingId, userId, html, assets, sounds, analysis } = params;

  // Validate inputs
  if (!isValidLandingId(landingId)) {
    throw new Error('Invalid landingId format');
  }
  if (!isValidUserId(userId)) {
    throw new Error('Invalid userId format');
  }
  if (!html || typeof html !== 'string') {
    throw new Error('Invalid HTML content');
  }

  // Create landing directory with validated path
  const baseLandingsDir = path.join(config.storagePath, 'landings');
  const userDir = sanitizePath(baseLandingsDir, String(userId));
  if (!userDir) {
    throw new Error('Invalid user directory path');
  }

  const landingDir = sanitizePath(userDir, landingId);
  if (!landingDir) {
    throw new Error('Invalid landing directory path');
  }

  await fs.mkdir(landingDir, { recursive: true });

  const assetsDir = path.join(landingDir, 'assets');
  const soundsDir = path.join(landingDir, 'sounds');
  await fs.mkdir(assetsDir, { recursive: true });
  await fs.mkdir(soundsDir, { recursive: true });

  log.info('Assembling landing', { landingId, landingDir, assetCount: Object.keys(assets || {}).length });

  // Copy assets
  const assetPaths = {};
  for (const [key, asset] of Object.entries(assets || {})) {
    if (asset.path) {
      try {
        // Resolve the source path - it might be URL like /uploads/xxx.png
        let sourcePath = asset.path;
        if (sourcePath.startsWith('/uploads/')) {
          sourcePath = path.join(config.storagePath, sourcePath.replace('/uploads/', ''));
        } else if (!path.isAbsolute(sourcePath)) {
          sourcePath = path.join(config.storagePath, sourcePath);
        }

        const ext = path.extname(sourcePath) || '.png';
        const fileName = `${key}${ext}`;
        const destPath = path.join(assetsDir, fileName);

        log.debug('Copying asset', { key, originalPath: asset.path, sourcePath, destPath });
        await fs.copyFile(sourcePath, destPath);
        assetPaths[key] = `assets/${fileName}`;

        log.info('Asset copied', { key, destPath });
      } catch (error) {
        log.warn('Failed to copy asset', { key, sourcePath: asset.path, error: error.message });
      }
    } else {
      log.warn('Asset has no path', { key, asset });
    }
  }

  // Copy sounds (use defaults if not provided)
  const soundPaths = {};
  const soundsToUse = sounds && Object.keys(sounds).length > 0 ? sounds : DEFAULT_SOUNDS;

  for (const [key, soundPath] of Object.entries(soundsToUse)) {
    try {
      const sourcePath = path.isAbsolute(soundPath)
        ? soundPath
        : path.join(process.cwd(), 'assets', soundPath);

      // Check if source exists
      try {
        await fs.access(sourcePath);
        const fileName = `${key}.mp3`;
        const destPath = path.join(soundsDir, fileName);
        await fs.copyFile(sourcePath, destPath);
        soundPaths[key] = `sounds/${fileName}`;
        log.info('Sound copied', { key, destPath });
      } catch {
        // If default sound doesn't exist, skip
        log.debug('Sound not found, skipping', { key, sourcePath });
      }
    } catch (error) {
      log.warn('Failed to copy sound', { key, error: error.message });
    }
  }

  // Process HTML - replace asset placeholders
  let processedHtml = html;
  for (const [key, assetPath] of Object.entries(assetPaths)) {
    // Replace various placeholder formats
    processedHtml = processedHtml
      .replace(new RegExp(`assets/${key}\\.png`, 'g'), assetPath)
      .replace(new RegExp(`assets/${key}\\.webp`, 'g'), assetPath)
      .replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), assetPath)
      .replace(new RegExp(`\\$\\{assets\\.${key}\\}`, 'g'), assetPath);
  }

  // Add sound paths to CONFIG if present in HTML
  if (processedHtml.includes('CONFIG')) {
    const soundConfig = Object.entries(soundPaths)
      .map(([key, p]) => `${key}: '${p}'`)
      .join(',\n    ');

    if (soundConfig) {
      processedHtml = processedHtml.replace(
        /sounds:\s*\{[^}]*\}/,
        `sounds: {\n    ${soundConfig}\n  }`
      );
    }
  }

  // Write HTML
  const htmlPath = path.join(landingDir, 'index.html');
  await fs.writeFile(htmlPath, processedHtml, 'utf-8');
  log.info('HTML written', { htmlPath });

  // Write metadata
  const metadata = {
    landingId,
    userId,
    createdAt: new Date().toISOString(),
    analysis: {
      slotName: analysis?.slotName,
      mechanicType: analysis?.mechanicType,
      language: analysis?.language,
      prizes: analysis?.prizes
    },
    assets: Object.keys(assetPaths),
    sounds: Object.keys(soundPaths)
  };

  await fs.writeFile(
    path.join(landingDir, 'metadata.json'),
    JSON.stringify(metadata, null, 2),
    'utf-8'
  );

  // Create ZIP archive
  const zipPath = path.join(landingDir, `${landingId}.zip`);
  await createZipArchive(landingDir, zipPath, [
    'index.html',
    'assets',
    'sounds'
  ]);

  log.info('ZIP created', { zipPath });

  // Generate preview (placeholder for now)
  const previewPath = path.join(landingDir, 'preview.png');
  // TODO: Use Puppeteer to generate actual preview

  return {
    zipPath,
    previewPath,
    landingDir,
    metadata
  };
}

/**
 * Create ZIP archive from directory
 * @param {string} sourceDir - Source directory
 * @param {string} zipPath - Output ZIP path
 * @param {string[]} includes - Files/folders to include
 */
async function createZipArchive(sourceDir, zipPath, includes) {
  return new Promise(async (resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    output.on('close', () => {
      log.info('Archive created', {
        path: zipPath,
        size: archive.pointer()
      });
      resolve();
    });

    archive.on('error', reject);
    archive.pipe(output);

    // Add items synchronously before finalize
    for (const item of includes) {
      const itemPath = path.join(sourceDir, item);

      try {
        const stats = await fs.stat(itemPath);
        if (stats.isDirectory()) {
          archive.directory(itemPath, item);
          log.debug('Added directory to archive', { item });
        } else {
          archive.file(itemPath, { name: item });
          log.debug('Added file to archive', { item });
        }
      } catch {
        // Item doesn't exist, skip
        log.debug('Archive item not found, skipping', { item });
      }
    }

    // Finalize after all items are added
    archive.finalize();
  });
}

/**
 * Get landing by ID
 * @param {string} landingId - Landing ID
 * @param {number} userId - User ID
 * @returns {Promise<Object|null>} Landing data
 */
export async function getLanding(landingId, userId) {
  // Validate inputs
  if (!isValidLandingId(landingId) || !isValidUserId(userId)) {
    return null;
  }

  const baseLandingsDir = path.join(config.storagePath, 'landings');
  const userDir = sanitizePath(baseLandingsDir, String(userId));
  if (!userDir) return null;

  const landingDir = sanitizePath(userDir, landingId);
  if (!landingDir) return null;

  try {
    const metadataPath = path.join(landingDir, 'metadata.json');
    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));

    const zipPath = path.join(landingDir, `${landingId}.zip`);
    const htmlPath = path.join(landingDir, 'index.html');

    const [zipExists, htmlExists] = await Promise.all([
      fs.access(zipPath).then(() => true).catch(() => false),
      fs.access(htmlPath).then(() => true).catch(() => false)
    ]);

    return {
      ...metadata,
      zipPath: zipExists ? zipPath : null,
      htmlPath: htmlExists ? htmlPath : null,
      landingDir
    };
  } catch {
    return null;
  }
}

/**
 * List user's landings
 * @param {number} userId - User ID
 * @returns {Promise<Object[]>} List of landings
 */
export async function listLandings(userId) {
  // Validate input
  if (!isValidUserId(userId)) {
    return [];
  }

  const baseLandingsDir = path.join(config.storagePath, 'landings');
  const userDir = sanitizePath(baseLandingsDir, String(userId));
  if (!userDir) return [];

  try {
    const entries = await fs.readdir(userDir, { withFileTypes: true });
    const landings = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const landing = await getLanding(entry.name, userId);
        if (landing) {
          landings.push(landing);
        }
      }
    }

    // Sort by creation date, newest first
    landings.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return landings;
  } catch {
    return [];
  }
}

/**
 * Delete landing
 * @param {string} landingId - Landing ID
 * @param {number} userId - User ID
 */
export async function deleteLanding(landingId, userId) {
  // Validate inputs
  if (!isValidLandingId(landingId) || !isValidUserId(userId)) {
    return false;
  }

  const baseLandingsDir = path.join(config.storagePath, 'landings');
  const userDir = sanitizePath(baseLandingsDir, String(userId));
  if (!userDir) return false;

  const landingDir = sanitizePath(userDir, landingId);
  if (!landingDir) return false;

  try {
    await fs.rm(landingDir, { recursive: true, force: true });
    log.info('Landing deleted', { landingId, userId });
    return true;
  } catch (error) {
    log.error('Failed to delete landing', { error: error.message });
    return false;
  }
}

/**
 * Get landing HTML for preview
 * @param {string} landingId - Landing ID
 * @param {number} userId - User ID
 * @returns {Promise<string|null>}
 */
export async function getLandingHtml(landingId, userId) {
  // Validate inputs
  if (!isValidLandingId(landingId) || !isValidUserId(userId)) {
    return null;
  }

  const baseLandingsDir = path.join(config.storagePath, 'landings');
  const userDir = sanitizePath(baseLandingsDir, String(userId));
  if (!userDir) return null;

  const landingDir = sanitizePath(userDir, landingId);
  if (!landingDir) return null;

  const htmlPath = path.join(landingDir, 'index.html');

  try {
    return await fs.readFile(htmlPath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Get landing ZIP stream
 * @param {string} landingId - Landing ID
 * @param {number} userId - User ID
 * @returns {Promise<fs.ReadStream|null>}
 */
export async function getLandingZipStream(landingId, userId) {
  // Validate inputs
  if (!isValidLandingId(landingId) || !isValidUserId(userId)) {
    return null;
  }

  const baseLandingsDir = path.join(config.storagePath, 'landings');
  const userDir = sanitizePath(baseLandingsDir, String(userId));
  if (!userDir) return null;

  const landingDir = sanitizePath(userDir, landingId);
  if (!landingDir) return null;

  const zipPath = path.join(landingDir, `${landingId}.zip`);

  try {
    await fs.access(zipPath);
    const { createReadStream } = await import('fs');
    return createReadStream(zipPath);
  } catch {
    return null;
  }
}

export default {
  assembleLanding,
  getLanding,
  listLandings,
  deleteLanding,
  getLandingHtml,
  getLandingZipStream
};
