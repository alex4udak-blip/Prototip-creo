import { config } from '../config/env.js';
import { log } from '../utils/logger.js';

/**
 * Serper.dev API Service
 * Used for searching slot game images and information
 *
 * Pricing: $1.00 per 1,000 requests
 * Free tier: 2,500 requests/month
 *
 * @see https://serper.dev/
 */

const SERPER_API_URL = 'https://google.serper.dev';

/**
 * Search for images using Serper API
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Promise<Array>} Array of image results
 */
export async function searchImages(query, options = {}) {
  if (!config.serperApiKey) {
    log.warn('Serper API key not configured, skipping image search');
    return [];
  }

  const {
    num = 10,
    country = 'us',
    safe = 'off'
  } = typeof options === 'number' ? { num: options } : options;

  log.info('Serper: Searching images', { query, num });

  try {
    const response = await fetch(`${SERPER_API_URL}/images`, {
      method: 'POST',
      headers: {
        'X-API-KEY': config.serperApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: query,
        num,
        gl: country,
        hl: 'en',
        safe
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Serper API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const images = data.images || [];

    log.info('Serper: Found images', { count: images.length });

    return images.map(img => ({
      url: img.imageUrl,
      imageUrl: img.imageUrl,
      thumbnailUrl: img.thumbnailUrl,
      title: img.title,
      source: img.link,
      width: img.imageWidth,
      height: img.imageHeight
    }));
  } catch (error) {
    log.error('Serper: Image search failed', { error: error.message });
    return [];
  }
}

/**
 * Search for slot game images by name
 * @param {string} slotName - Slot name
 * @param {string} provider - Provider name (optional)
 * @returns {Promise<Array>} Filtered image results
 */
export async function searchSlotImages(slotName, provider = '') {
  const query = provider
    ? `${slotName} slot ${provider} official game`
    : `${slotName} slot game official`;

  log.info('Serper: Searching slot images', { slotName, provider, query });

  const images = await searchImages(query, { num: 10 });

  // Filter for quality images
  const filtered = images
    .filter(img => img.width >= 400 && img.height >= 300)
    .sort((a, b) => (b.width * b.height) - (a.width * a.height));

  log.info('Serper: Quality images found', { count: filtered.length });

  return filtered;
}

/**
 * Search for slot game information
 * @param {string} slotName - Name of the slot game
 * @returns {Promise<Object>} Slot information and images
 */
export async function searchSlotInfo(slotName) {
  if (!config.serperApiKey) {
    log.warn('Serper API key not configured');
    return { slotName, provider: null, images: [], webResults: [] };
  }

  const query = `${slotName} slot game official`;

  log.info('Serper: Searching slot info', { slotName, query });

  try {
    // Search for web results to get provider info
    const webResponse = await fetch(`${SERPER_API_URL}/search`, {
      method: 'POST',
      headers: {
        'X-API-KEY': config.serperApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: query,
        num: 5
      })
    });

    if (!webResponse.ok) {
      throw new Error(`Serper API error: ${webResponse.status}`);
    }

    const webData = await webResponse.json();

    // Search for images
    const images = await searchSlotImages(slotName);

    // Extract provider from search results
    let provider = null;
    const providerPatterns = [
      /pragmatic\s*play/i,
      /netent/i,
      /microgaming/i,
      /play'?n\s*go/i,
      /evolution/i,
      /betsoft/i,
      /yggdrasil/i,
      /push\s*gaming/i,
      /red\s*tiger/i,
      /big\s*time\s*gaming/i,
      /hacksaw/i,
      /nolimit\s*city/i,
      /relax\s*gaming/i,
      /thunderkick/i,
      /blueprint/i,
      /elk\s*studios/i
    ];

    const organic = webData.organic || [];
    for (const result of organic) {
      const text = `${result.title} ${result.snippet}`;
      for (const pattern of providerPatterns) {
        const match = text.match(pattern);
        if (match) {
          provider = match[0];
          break;
        }
      }
      if (provider) break;
    }

    log.info('Serper: Slot info retrieved', {
      slotName,
      provider,
      imagesFound: images.length
    });

    return {
      slotName,
      provider,
      images,
      webResults: organic.slice(0, 3).map(r => ({
        title: r.title,
        snippet: r.snippet,
        link: r.link
      }))
    };
  } catch (error) {
    log.error('Serper: Slot info search failed', { error: error.message });
    return { slotName, provider: null, images: [], webResults: [] };
  }
}

/**
 * Download image from URL
 * @param {string} imageUrl - Image URL
 * @returns {Promise<Buffer>} Image buffer
 */
export async function downloadImage(imageUrl) {
  log.info('Serper: Downloading image', { url: imageUrl.substring(0, 100) });

  try {
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    log.info('Serper: Image downloaded', { size: buffer.length });

    return buffer;
  } catch (error) {
    log.error('Serper: Image download failed', { error: error.message });
    throw error;
  }
}

/**
 * Find and download best slot image
 * @param {string} slotName - Slot name
 * @param {string} provider - Provider name
 * @returns {Promise<{buffer: Buffer, metadata: Object}|null>}
 */
export async function findAndDownloadSlotImage(slotName, provider = '') {
  const images = await searchSlotImages(slotName, provider);

  if (images.length === 0) {
    log.info('Serper: No images found', { slotName });
    return null;
  }

  // Try downloading first 3 results
  for (let i = 0; i < Math.min(3, images.length); i++) {
    try {
      const image = images[i];
      const buffer = await downloadImage(image.url);

      return {
        buffer,
        metadata: {
          url: image.url,
          width: image.width,
          height: image.height,
          title: image.title,
          source: image.source
        }
      };
    } catch {
      log.warn('Serper: Failed to download image, trying next', { index: i + 1 });
    }
  }

  return null;
}

/**
 * Get best slot reference image with metadata
 * @param {string} slotName - Slot name to search
 * @returns {Promise<{buffer: Buffer, mimeType: string, source: string, provider: string|null}>}
 */
export async function getSlotReferenceImage(slotName) {
  const info = await searchSlotInfo(slotName);

  if (!info.images || info.images.length === 0) {
    throw new Error(`No images found for slot: ${slotName}`);
  }

  // Sort by size, prefer larger images
  const sortedImages = [...info.images].sort((a, b) => {
    const sizeA = (a.width || 0) * (a.height || 0);
    const sizeB = (b.width || 0) * (b.height || 0);
    return sizeB - sizeA;
  });

  // Try downloading images until one succeeds
  for (const img of sortedImages) {
    try {
      const buffer = await downloadImage(img.url);

      // Detect mime type from buffer
      let mimeType = 'image/png';
      if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
        mimeType = 'image/jpeg';
      } else if (buffer[0] === 0x89 && buffer[1] === 0x50) {
        mimeType = 'image/png';
      } else if (buffer[0] === 0x52 && buffer[1] === 0x49) {
        mimeType = 'image/webp';
      }

      return {
        buffer,
        mimeType,
        source: img.source,
        provider: info.provider
      };
    } catch {
      log.warn('Serper: Failed to download image, trying next');
    }
  }

  throw new Error(`Failed to download any image for slot: ${slotName}`);
}

/**
 * Search for sound effects
 * @param {string} query - Sound effect description
 * @returns {Promise<Array>} Search results
 */
export async function searchSounds(query) {
  if (!config.serperApiKey) {
    log.warn('Serper API key not configured');
    return [];
  }

  const searchQuery = `${query} sound effect free download mp3`;

  log.info('Serper: Searching sounds', { query: searchQuery });

  try {
    const response = await fetch(`${SERPER_API_URL}/search`, {
      method: 'POST',
      headers: {
        'X-API-KEY': config.serperApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: searchQuery,
        num: 10
      })
    });

    if (!response.ok) {
      throw new Error(`Serper API error: ${response.status}`);
    }

    const data = await response.json();

    // Filter for likely sound sources
    const soundSites = ['freesound.org', 'pixabay.com', 'mixkit.co', 'zapsplat.com'];
    const results = (data.organic || []).filter(r =>
      soundSites.some(site => r.link.includes(site))
    );

    log.info('Serper: Sound results found', { count: results.length });

    return results.map(r => ({
      title: r.title,
      link: r.link,
      snippet: r.snippet
    }));
  } catch (error) {
    log.error('Serper: Sound search failed', { error: error.message });
    return [];
  }
}

/**
 * Check Serper API availability
 */
export function checkHealth() {
  return {
    configured: !!config.serperApiKey,
    endpoint: SERPER_API_URL
  };
}

export default {
  searchImages,
  searchSlotImages,
  searchSlotInfo,
  downloadImage,
  findAndDownloadSlotImage,
  getSlotReferenceImage,
  searchSounds,
  checkHealth
};
