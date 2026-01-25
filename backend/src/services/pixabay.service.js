/**
 * Pixabay API Service
 * Поиск звуковых эффектов для лендингов
 */

import { fetchWithTimeout } from '../utils/fetchWithTimeout.js';

const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;
const PIXABAY_BASE_URL = 'https://pixabay.com/api';
const API_TIMEOUT = 15000; // 15 seconds for API calls
const DOWNLOAD_TIMEOUT = 30000; // 30 seconds for downloads

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

    const response = await fetchWithTimeout(url.toString(), { timeout: API_TIMEOUT });

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
    const response = await fetchWithTimeout(soundUrl, { timeout: DOWNLOAD_TIMEOUT });

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
 * Получить fallback звуки (локальные) - АБСОЛЮТНЫЕ пути
 * @returns {Promise<Object>} пути к локальным звукам
 */
export async function getFallbackSounds() {
  const path = await import('path');
  const basePath = path.join(process.cwd(), 'assets', 'sounds');
  return {
    spin: path.join(basePath, 'spin.mp3'),
    win: path.join(basePath, 'win.mp3'),
    click: null, // опционально
    coins: null,
    ambient: null
  };
}

/**
 * Скачать и сохранить звуки на диск
 * @param {Object} soundsMetadata - результат findGameSounds
 * @param {string} outputDir - папка для сохранения
 * @returns {Promise<Object>} пути к скачанным файлам
 */
export async function downloadAndSaveSounds(soundsMetadata, outputDir) {
  const fs = await import('fs/promises');
  const path = await import('path');

  // Создаём папку если нет
  await fs.mkdir(outputDir, { recursive: true });

  const savedPaths = {};

  for (const [key, sound] of Object.entries(soundsMetadata || {})) {
    if (!sound || !sound.url) {
      // Используем fallback звук если есть
      const fallbackPath = path.join(process.cwd(), 'assets', 'sounds', `${key}.mp3`);
      try {
        await fs.access(fallbackPath);
        savedPaths[key] = fallbackPath;
        console.log(`[Pixabay] Using fallback for ${key}: ${fallbackPath}`);
      } catch {
        console.log(`[Pixabay] No sound for ${key}`);
      }
      continue;
    }

    try {
      const buffer = await downloadSound(sound.url);
      const filename = `${key}.mp3`;
      const filePath = path.join(outputDir, filename);
      await fs.writeFile(filePath, buffer);
      savedPaths[key] = filePath;
      console.log(`[Pixabay] Downloaded ${key} to ${filePath}`);
    } catch (error) {
      console.error(`[Pixabay] Failed to download ${key}:`, error.message);
      // Try fallback
      const fallbackPath = path.join(process.cwd(), 'assets', 'sounds', `${key}.mp3`);
      try {
        await fs.access(fallbackPath);
        savedPaths[key] = fallbackPath;
      } catch {
        // No fallback available
      }
    }
  }

  return savedPaths;
}

/**
 * Получить звуки с fallback на локальные
 * @param {string} theme - тема
 * @param {string} outputDir - папка для сохранения (если скачиваем)
 * @returns {Promise<Object>} пути к звукам
 */
export async function getGameSoundsWithFallback(theme, outputDir) {
  const path = await import('path');
  const fs = await import('fs/promises');

  // Сначала пробуем найти в Pixabay
  const pixabaySounds = await findGameSounds(theme);
  const hasPixabay = Object.values(pixabaySounds).some(s => s && s.url);

  if (hasPixabay && outputDir) {
    // Скачиваем если есть результаты
    return await downloadAndSaveSounds(pixabaySounds, outputDir);
  }

  // Fallback на локальные звуки
  const basePath = path.join(process.cwd(), 'assets', 'sounds');
  const fallbackSounds = {};

  for (const key of ['spin', 'win']) {
    const filePath = path.join(basePath, `${key}.mp3`);
    try {
      await fs.access(filePath);
      fallbackSounds[key] = filePath;
    } catch {
      // File not found
    }
  }

  return fallbackSounds;
}

export default {
  searchSounds,
  findGameSounds,
  downloadSound,
  getFallbackSounds,
  downloadAndSaveSounds,
  getGameSoundsWithFallback
};
