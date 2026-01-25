/**
 * Pixabay API Service
 * Поиск звуковых эффектов для лендингов
 */

const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;
const PIXABAY_BASE_URL = 'https://pixabay.com/api';

/**
 * Поиск звуков по запросу
 * @param {string} query - поисковый запрос
 * @param {number} perPage - количество результатов
 * @returns {Promise<Array>} массив звуков
 */
export async function searchSounds(query, perPage = 10) {
  if (!PIXABAY_API_KEY) {
    console.warn('[Pixabay] API key not configured, using fallback sounds');
    return [];
  }

  try {
    const url = new URL(PIXABAY_BASE_URL);
    url.searchParams.set('key', PIXABAY_API_KEY);
    url.searchParams.set('q', query);
    url.searchParams.set('per_page', perPage.toString());
    // Pixabay использует тип "music" для аудио, нет отдельного типа для SFX
    // Но можно искать через обычный эндпоинт

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Pixabay API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.hits || !Array.isArray(data.hits)) {
      return [];
    }

    // Фильтруем только аудио результаты если есть
    return data.hits
      .filter(hit => hit.videos?.medium?.url || hit.previewURL)
      .map(hit => ({
        id: hit.id,
        tags: hit.tags,
        url: hit.previewURL || hit.videos?.medium?.url,
        duration: hit.duration || 0,
        downloads: hit.downloads
      }));
  } catch (error) {
    console.error('[Pixabay] Search error:', error.message);
    return [];
  }
}

/**
 * Поиск звуков для казино/игр
 * Возвращает объект с категоризированными звуками
 * @param {string} theme - тема (epic, cartoon, neon, classic)
 * @returns {Promise<Object>} объект со звуками по категориям
 */
export async function findGameSounds(theme = 'classic') {
  const soundQueries = {
    spin: ['wheel spin', 'slot machine', 'spinning sound'],
    win: ['victory fanfare', 'win celebration', 'jackpot sound'],
    click: ['button click', 'tap sound', 'click interface'],
    coins: ['coins falling', 'money sound', 'coins drop'],
    ambient: ['casino ambient', 'game background music']
  };

  // Добавляем тематические модификаторы
  const themeModifiers = {
    epic: ['epic', 'dramatic', 'orchestral'],
    cartoon: ['cartoon', 'funny', 'playful'],
    neon: ['electronic', 'synth', 'modern'],
    classic: ['classic', 'retro', 'traditional']
  };

  const modifier = themeModifiers[theme] || themeModifiers.classic;

  const results = {};

  // Ищем по каждой категории
  for (const [category, queries] of Object.entries(soundQueries)) {
    // Пробуем разные запросы пока не найдём результат
    for (const query of queries) {
      const fullQuery = `${query} ${modifier[0]}`;
      const sounds = await searchSounds(fullQuery, 3);

      if (sounds.length > 0) {
        results[category] = sounds[0];
        console.log(`[Pixabay] Found ${category}: ${sounds[0].tags}`);
        break;
      }
    }

    // Если ничего не нашли, помечаем как null
    if (!results[category]) {
      results[category] = null;
      console.log(`[Pixabay] No sound found for: ${category}`);
    }
  }

  return results;
}

/**
 * Скачать звук по URL
 * @param {string} soundUrl - URL звука
 * @returns {Promise<Buffer>} буфер с аудио
 */
export async function downloadSound(soundUrl) {
  try {
    const response = await fetch(soundUrl);

    if (!response.ok) {
      throw new Error(`Failed to download sound: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('[Pixabay] Download error:', error.message);
    throw error;
  }
}

/**
 * Получить fallback звуки (локальные)
 * @returns {Object} пути к локальным звукам
 */
export function getFallbackSounds() {
  const basePath = 'assets/sounds';
  return {
    spin: `${basePath}/spin.mp3`,
    win: `${basePath}/win.mp3`,
    click: `${basePath}/click.mp3`,
    coins: `${basePath}/coins.mp3`,
    ambient: null // опционально
  };
}

export default {
  searchSounds,
  findGameSounds,
  downloadSound,
  getFallbackSounds
};
