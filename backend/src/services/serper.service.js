/**
 * Serper.dev API Service
 * Поиск изображений слотов по названию
 */

const SERPER_API_KEY = process.env.SERPER_API_KEY;
const SERPER_BASE_URL = 'https://google.serper.dev';

/**
 * Поиск изображений по запросу
 * @param {string} query - поисковый запрос
 * @param {number} num - количество результатов (max 100)
 * @returns {Promise<Array>} массив изображений
 */
export async function searchImages(query, num = 10) {
  if (!SERPER_API_KEY) {
    console.warn('[Serper] API key not configured, skipping image search');
    return [];
  }

  try {
    const response = await fetch(`${SERPER_BASE_URL}/images`, {
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: query,
        num: num,
        gl: 'us',
        hl: 'en'
      })
    });

    if (!response.ok) {
      throw new Error(`Serper API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.images || !Array.isArray(data.images)) {
      return [];
    }

    return data.images.map(img => ({
      url: img.imageUrl,
      width: img.imageWidth,
      height: img.imageHeight,
      title: img.title,
      source: img.link,
      thumbnail: img.thumbnailUrl
    }));
  } catch (error) {
    console.error('[Serper] Search error:', error.message);
    return [];
  }
}

/**
 * Поиск изображений слота по названию
 * @param {string} slotName - название слота
 * @param {string} provider - провайдер (Pragmatic Play, NetEnt, etc.)
 * @returns {Promise<Array>} массив изображений
 */
export async function searchSlotImages(slotName, provider = '') {
  const query = provider
    ? `${slotName} slot ${provider} official game`
    : `${slotName} slot game official`;

  console.log(`[Serper] Searching: "${query}"`);

  const images = await searchImages(query, 10);

  // Фильтруем результаты - предпочитаем большие изображения
  const filtered = images
    .filter(img => img.width >= 400 && img.height >= 300)
    .sort((a, b) => (b.width * b.height) - (a.width * a.height));

  console.log(`[Serper] Found ${filtered.length} quality images`);

  return filtered;
}

/**
 * Скачать изображение по URL
 * @param {string} imageUrl - URL изображения
 * @returns {Promise<Buffer>} буфер с изображением
 */
export async function downloadImage(imageUrl) {
  try {
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MST-CREO-AI/1.0)'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to download: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('[Serper] Download error:', error.message);
    throw error;
  }
}

/**
 * Поиск и скачивание лучшего изображения слота
 * @param {string} slotName - название слота
 * @param {string} provider - провайдер
 * @returns {Promise<{buffer: Buffer, metadata: Object}|null>}
 */
export async function findAndDownloadSlotImage(slotName, provider = '') {
  const images = await searchSlotImages(slotName, provider);

  if (images.length === 0) {
    console.log(`[Serper] No images found for "${slotName}"`);
    return null;
  }

  // Пробуем скачать первые 3 результата (на случай если один не загрузится)
  for (let i = 0; i < Math.min(3, images.length); i++) {
    try {
      const image = images[i];
      console.log(`[Serper] Downloading: ${image.url}`);

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
    } catch (error) {
      console.warn(`[Serper] Failed to download image ${i + 1}, trying next...`);
    }
  }

  return null;
}

export default {
  searchImages,
  searchSlotImages,
  downloadImage,
  findAndDownloadSlotImage
};
