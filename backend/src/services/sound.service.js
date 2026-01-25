/**
 * Sound Service
 * Управление звуковой библиотекой для лендингов
 *
 * АРХИТЕКТУРА ЗВУКОВ:
 * - Локальная библиотека (universal, epic, cartoon, neon, classic)
 * - Gemini TTS для голосового сопровождения
 * - AI выбирает тему → копирует нужную папку звуков
 *
 * Структура папок:
 * backend/assets/sounds/
 * ├── universal/       # Универсальные (spin, win_small, win_big, button_click, coins)
 * ├── epic/            # Греческая/фэнтези тема (thunder, epic_win, dramatic)
 * ├── cartoon/         # Мультяшные (boing, splat, funny_win)
 * ├── neon/            # Электронные (synth_spin, electronic_win)
 * └── classic/         # Классическое казино (slot_spin, slot_stop, jackpot)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { log } from '../utils/logger.js';
import { config } from '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOUNDS_BASE_PATH = path.resolve(__dirname, '../../assets/sounds');

// Gemini client для TTS (lazy initialization)
let ai = null;

function getAI() {
  if (!ai && config.googleApiKey) {
    ai = new GoogleGenAI({ apiKey: config.googleApiKey });
  }
  return ai;
}

/**
 * Темы звуков и их характеристики
 */
export const SOUND_THEMES = {
  universal: {
    name: 'Universal',
    description: 'Универсальные звуки для всех тем',
    sounds: ['spin', 'win_small', 'win_big', 'button_click', 'coins', 'whoosh', 'pop'],
    useFor: ['default', 'custom']
  },
  epic: {
    name: 'Epic/Fantasy',
    description: 'Эпические звуки для греческой мифологии и фэнтези',
    sounds: ['thunder', 'epic_win', 'dramatic_spin', 'magic', 'fanfare', 'choir'],
    useFor: ['greek_mythology', 'fantasy', 'adventure', 'gods']
  },
  cartoon: {
    name: 'Cartoon',
    description: 'Мультяшные звуки для Chicken Road и подобных',
    sounds: ['boing', 'splat', 'funny_win', 'squeak', 'bounce', 'spring'],
    useFor: ['cartoon', 'animals', 'chicken', 'fun', 'kids']
  },
  neon: {
    name: 'Neon/Electronic',
    description: 'Электронные звуки для современных тем',
    sounds: ['synth_spin', 'electronic_win', 'beep', 'glitch', 'digital', 'pulse'],
    useFor: ['neon', 'crypto', 'cyberpunk', 'futuristic', 'tech']
  },
  classic: {
    name: 'Classic Casino',
    description: 'Классические казино звуки',
    sounds: ['slot_spin', 'slot_stop', 'jackpot', 'lever_pull', 'bell', 'reel_click'],
    useFor: ['casino', 'vegas', 'classic', 'vintage', 'slots']
  }
};

/**
 * Маппинг тем стилей на звуковые темы
 */
const STYLE_TO_SOUND_MAP = {
  // Эпические темы
  greek_mythology: 'epic',
  fantasy: 'epic',
  adventure: 'epic',
  egypt: 'epic',
  gods: 'epic',
  olympus: 'epic',

  // Мультяшные
  cartoon: 'cartoon',
  animals: 'cartoon',
  chicken: 'cartoon',
  fun: 'cartoon',
  candy: 'cartoon',
  fruits: 'cartoon',

  // Электронные
  neon: 'neon',
  crypto: 'neon',
  cyberpunk: 'neon',
  futuristic: 'neon',
  tech: 'neon',

  // Классика
  casino: 'classic',
  vegas: 'classic',
  classic: 'classic',
  vintage: 'classic',
  slots: 'classic',

  // По умолчанию
  default: 'universal'
};

/**
 * Определить звуковую тему по стилю
 * @param {string} styleTheme - тема стиля (greek_mythology, candy, neon, etc.)
 * @returns {string} звуковая тема
 */
export function determineSoundTheme(styleTheme) {
  if (!styleTheme) return 'universal';

  const normalizedTheme = styleTheme.toLowerCase().trim();

  // Прямое соответствие
  if (STYLE_TO_SOUND_MAP[normalizedTheme]) {
    return STYLE_TO_SOUND_MAP[normalizedTheme];
  }

  // Поиск по ключевым словам
  for (const [keyword, soundTheme] of Object.entries(STYLE_TO_SOUND_MAP)) {
    if (normalizedTheme.includes(keyword)) {
      return soundTheme;
    }
  }

  // Поиск по useFor в темах
  for (const [themeName, themeConfig] of Object.entries(SOUND_THEMES)) {
    if (themeConfig.useFor.some(tag => normalizedTheme.includes(tag))) {
      return themeName;
    }
  }

  return 'universal';
}

/**
 * Получить путь к папке звуков для темы
 * @param {string} soundTheme - звуковая тема
 * @returns {string} путь к папке
 */
export function getSoundFolderPath(soundTheme) {
  const themePath = path.join(SOUNDS_BASE_PATH, soundTheme);

  // Если тема не существует, используем universal
  if (!fs.existsSync(themePath)) {
    log.warn(`Sound theme "${soundTheme}" not found, using universal`, { themePath });
    return path.join(SOUNDS_BASE_PATH, 'universal');
  }

  return themePath;
}

/**
 * Получить список доступных звуков в теме
 * @param {string} soundTheme - звуковая тема
 * @returns {Array<Object>} список звуков
 */
export function getAvailableSounds(soundTheme) {
  const folderPath = getSoundFolderPath(soundTheme);

  if (!fs.existsSync(folderPath)) {
    return [];
  }

  try {
    const files = fs.readdirSync(folderPath);
    const soundFiles = files.filter(f => /\.(mp3|wav|ogg|webm)$/i.test(f));

    return soundFiles.map(file => ({
      name: path.basename(file, path.extname(file)),
      filename: file,
      path: path.join(folderPath, file),
      relativePath: `sounds/${soundTheme}/${file}`
    }));
  } catch (error) {
    log.error('Failed to read sound folder', { error: error.message, folderPath });
    return [];
  }
}

/**
 * Скопировать звуки темы в папку лендинга
 * @param {string} soundTheme - звуковая тема
 * @param {string} targetFolder - целевая папка
 * @returns {Array<Object>} скопированные звуки
 */
export async function copySoundsToLanding(soundTheme, targetFolder) {
  const sourcePath = getSoundFolderPath(soundTheme);
  const targetPath = path.join(targetFolder, 'sounds');

  // Создаём целевую папку
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }

  const sounds = getAvailableSounds(soundTheme);
  const copiedSounds = [];

  // Также копируем универсальные звуки если это не universal тема
  const soundsToCopy = [...sounds];
  if (soundTheme !== 'universal') {
    const universalSounds = getAvailableSounds('universal');
    // Добавляем только те, которых нет в текущей теме
    const existingNames = new Set(sounds.map(s => s.name));
    for (const uSound of universalSounds) {
      if (!existingNames.has(uSound.name)) {
        soundsToCopy.push(uSound);
      }
    }
  }

  for (const sound of soundsToCopy) {
    try {
      const targetFile = path.join(targetPath, sound.filename);
      fs.copyFileSync(sound.path, targetFile);
      copiedSounds.push({
        name: sound.name,
        filename: sound.filename,
        path: `sounds/${sound.filename}`
      });
    } catch (error) {
      log.warn('Failed to copy sound file', { file: sound.filename, error: error.message });
    }
  }

  log.info('Copied sounds to landing', {
    theme: soundTheme,
    count: copiedSounds.length,
    target: targetPath
  });

  return copiedSounds;
}

/**
 * Сгенерировать голосовое сопровождение через Gemini TTS
 * @param {string} text - текст для озвучки
 * @param {Object} options - опции
 * @returns {Promise<Buffer|null>} аудио буфер или null
 */
export async function generateVoiceNarration(text, options = {}) {
  const {
    language = 'ru',
    voice = 'default',  // 30 голосов доступно
    style = 'energetic' // dramatic, calm, excited, etc.
  } = options;

  if (!config.googleApiKey) {
    log.warn('Gemini API key not configured, skipping TTS');
    return null;
  }

  try {
    // Форматируем промпт для TTS
    const ttsPrompt = `Generate speech audio for the following text.
Language: ${language}
Style: ${style}
Text: "${text}"

Make it sound like a casino announcer - exciting and engaging!`;

    log.info('Generating TTS narration', { text: text.substring(0, 50), language, style });

    // Используем Gemini для генерации голоса (если доступен)
    const aiClient = getAI();
    if (!aiClient) {
      log.warn('TTS not available - no API key');
      return null;
    }

    // Примечание: Gemini TTS API может отличаться, это placeholder
    const response = await aiClient.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        text: ttsPrompt
      }]
    });

    // TODO: Когда Gemini TTS станет доступен, обновить
    // Пока возвращаем null, звуки берутся из локальной библиотеки
    log.info('TTS generation placeholder - using local sounds instead');
    return null;

  } catch (error) {
    log.error('TTS generation failed', { error: error.message });
    return null;
  }
}

/**
 * Получить рекомендуемые звуки для механики
 * @param {string} mechanicType - тип механики (wheel, boxes, crash, etc.)
 * @returns {Object} рекомендации звуков
 */
export function getRecommendedSoundsForMechanic(mechanicType) {
  const recommendations = {
    wheel: {
      required: ['spin', 'win_big'],
      optional: ['button_click', 'coins', 'whoosh'],
      description: 'Звук спина и победы для колеса фортуны'
    },
    boxes: {
      required: ['pop', 'win_big'],
      optional: ['button_click', 'coins', 'magic'],
      description: 'Звук открытия бокса и победы'
    },
    crash: {
      required: ['whoosh', 'win_small', 'splat'],
      optional: ['coins', 'dramatic_spin'],
      description: 'Звук полёта, краша и победы'
    },
    scratch: {
      required: ['scratch', 'win_big'],
      optional: ['coins', 'pop'],
      description: 'Звук скретча и выигрыша'
    },
    slots: {
      required: ['slot_spin', 'slot_stop', 'jackpot'],
      optional: ['lever_pull', 'bell', 'coins'],
      description: 'Классические звуки слот-машины'
    },
    tower: {
      required: ['whoosh', 'splat', 'win_big'],
      optional: ['bounce', 'pop'],
      description: 'Звуки падения блоков'
    },
    plinko: {
      required: ['bounce', 'win_small'],
      optional: ['boing', 'coins'],
      description: 'Звук отскоков шарика'
    },
    default: {
      required: ['button_click', 'win_big'],
      optional: ['coins', 'whoosh'],
      description: 'Базовые звуки'
    }
  };

  return recommendations[mechanicType] || recommendations.default;
}

/**
 * Собрать пакет звуков для лендинга
 * @param {Object} params - параметры
 * @param {string} params.styleTheme - тема стиля
 * @param {string} params.mechanicType - тип механики
 * @param {string} params.targetFolder - целевая папка (опционально)
 * @returns {Object} пакет звуков
 */
export async function assembleSoundPackage({
  styleTheme,
  mechanicType,
  targetFolder = null
}) {
  // Определяем звуковую тему
  const soundTheme = determineSoundTheme(styleTheme);

  log.info('Assembling sound package', { styleTheme, mechanicType, soundTheme });

  // Получаем рекомендации для механики
  const recommendations = getRecommendedSoundsForMechanic(mechanicType);

  // Получаем доступные звуки
  const availableSounds = getAvailableSounds(soundTheme);
  const universalSounds = soundTheme !== 'universal' ? getAvailableSounds('universal') : [];

  // Собираем финальный список
  const allAvailable = [...availableSounds, ...universalSounds];
  const soundsMap = {};

  for (const sound of allAvailable) {
    if (!soundsMap[sound.name]) {
      soundsMap[sound.name] = sound;
    }
  }

  // Формируем пакет
  const soundPackage = {
    theme: soundTheme,
    styleTheme,
    mechanicType,
    recommendations,
    sounds: {
      required: recommendations.required
        .map(name => soundsMap[name])
        .filter(Boolean),
      optional: recommendations.optional
        .map(name => soundsMap[name])
        .filter(Boolean),
      all: Object.values(soundsMap)
    },
    hasTTS: false,
    ttsText: null
  };

  // Копируем в целевую папку если указана
  if (targetFolder) {
    soundPackage.copiedSounds = await copySoundsToLanding(soundTheme, targetFolder);
  }

  log.info('Sound package assembled', {
    theme: soundTheme,
    requiredCount: soundPackage.sounds.required.length,
    optionalCount: soundPackage.sounds.optional.length,
    totalCount: soundPackage.sounds.all.length
  });

  return soundPackage;
}

/**
 * Проверить наличие звуковой библиотеки
 */
export function checkSoundLibrary() {
  const status = {
    available: fs.existsSync(SOUNDS_BASE_PATH),
    themes: {}
  };

  for (const themeName of Object.keys(SOUND_THEMES)) {
    const themePath = path.join(SOUNDS_BASE_PATH, themeName);
    const exists = fs.existsSync(themePath);
    const sounds = exists ? getAvailableSounds(themeName) : [];

    status.themes[themeName] = {
      exists,
      path: themePath,
      soundCount: sounds.length,
      sounds: sounds.map(s => s.name)
    };
  }

  return status;
}

export default {
  SOUND_THEMES,
  determineSoundTheme,
  getSoundFolderPath,
  getAvailableSounds,
  copySoundsToLanding,
  generateVoiceNarration,
  getRecommendedSoundsForMechanic,
  assembleSoundPackage,
  checkSoundLibrary
};
