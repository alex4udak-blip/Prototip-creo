import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/env.js';
import { log } from '../utils/logger.js';

/**
 * Сервис для наложения текста на изображения
 * Используется для Runware fallback, т.к. FLUX модели плохо рендерят текст
 */

/**
 * Max prompt length to process (prevent DoS with very long inputs)
 */
const MAX_PROMPT_LENGTH = 10000;

/**
 * Max texts to extract from a prompt
 */
const MAX_EXTRACTED_TEXTS = 20;

/**
 * Извлечь текст из промпта
 * Ищет текст в кавычках (русских и английских)
 *
 * @param {string} prompt - Промпт пользователя
 * @returns {Array} Массив найденных текстов [{text, type}]
 */
export function extractTextFromPrompt(prompt) {
  // Input validation and length limit
  if (!prompt || typeof prompt !== 'string') {
    return [];
  }

  // Truncate very long prompts to prevent DoS
  const safePrompt = prompt.slice(0, MAX_PROMPT_LENGTH);
  const texts = [];

  // Регулярки для разных типов кавычек (no duplicates)
  // These patterns use negated character classes which are ReDoS-safe
  const quotePatterns = [
    /"([^"]+)"/g,           // "text" (ASCII double quotes)
    /«([^»]+)»/g,           // «text» (French/Russian guillemets)
    /'([^']+)'/g,           // 'text' (ASCII single quotes)
    /„([^"]+)"/g,           // „text" (German low-high quotes)
    /"([^"]+)"/g,           // "text" (curly quotes)
  ];

  for (const pattern of quotePatterns) {
    // Reset regex lastIndex to start from beginning
    pattern.lastIndex = 0;
    let match;
    let matchCount = 0;

    // Limit matches per pattern to prevent excessive iterations
    while ((match = pattern.exec(safePrompt)) !== null && matchCount < MAX_EXTRACTED_TEXTS) {
      matchCount++;
      const text = match[1].trim();
      if (text && text.length > 0 && text.length <= 50) {
        // Определяем тип текста по контексту
        const type = guessTextType(text, safePrompt);
        texts.push({ text, type });
      }

      // Early exit if we have enough texts
      if (texts.length >= MAX_EXTRACTED_TEXTS) break;
    }

    if (texts.length >= MAX_EXTRACTED_TEXTS) break;
  }

  // Убираем дубликаты
  const unique = [];
  const seen = new Set();
  for (const item of texts) {
    if (!seen.has(item.text.toLowerCase())) {
      seen.add(item.text.toLowerCase());
      unique.push(item);
    }
  }

  log.debug('Extracted texts from prompt', {
    promptLength: prompt.length,
    textsFound: unique.length,
    texts: unique
  });

  return unique;
}

/**
 * Определить тип текста (заголовок, кнопка, мелкий текст)
 */
function guessTextType(text, prompt) {
  const lowerText = text.toLowerCase();
  const lowerPrompt = prompt.toLowerCase();

  // CTA кнопки
  if (lowerText.includes('play') || lowerText.includes('играть') ||
      lowerText.includes('start') || lowerText.includes('начать') ||
      lowerText.includes('get') || lowerText.includes('получить') ||
      lowerText.includes('claim') || lowerText.includes('забрать') ||
      lowerText.includes('spin') || lowerText.includes('крути') ||
      lowerText.includes('win') || lowerText.includes('выиграй') ||
      lowerText.includes('join') || lowerText.includes('присоединяйся')) {
    return 'cta';
  }

  // Мелкий текст (disclaimer)
  if (lowerText.includes('18+') || lowerText.includes('t&c') ||
      lowerText.includes('terms') || lowerText.includes('условия') ||
      lowerText.includes('apply') || lowerText.includes('gambling')) {
    return 'disclaimer';
  }

  // Бонусы/офферы (обычно крупный текст)
  if (lowerText.includes('bonus') || lowerText.includes('бонус') ||
      lowerText.includes('free') || lowerText.includes('бесплатн') ||
      lowerText.includes('%') || lowerText.includes('€') ||
      lowerText.includes('$') || lowerText.includes('₽') ||
      /\d+/.test(lowerText)) {
    return 'headline';
  }

  // По умолчанию — заголовок
  return 'headline';
}

/**
 * Создать SVG с текстом
 */
function createTextSvg(text, type, width, height) {
  // Настройки в зависимости от типа
  const styles = {
    headline: {
      fontSize: Math.min(width / 10, 72),
      fontWeight: 'bold',
      fill: '#FFFFFF',
      stroke: '#000000',
      strokeWidth: 2,
      y: '35%'
    },
    cta: {
      fontSize: Math.min(width / 15, 48),
      fontWeight: 'bold',
      fill: '#FFFFFF',
      stroke: '#000000',
      strokeWidth: 1,
      y: '75%',
      background: true,
      bgColor: '#FF6B00',
      bgPadding: 20,
      bgRadius: 10
    },
    disclaimer: {
      fontSize: Math.min(width / 30, 18),
      fontWeight: 'normal',
      fill: '#CCCCCC',
      stroke: 'none',
      strokeWidth: 0,
      y: '95%'
    }
  };

  const style = styles[type] || styles.headline;

  // Разбиваем текст на строки если слишком длинный
  const maxCharsPerLine = Math.floor(width / (style.fontSize * 0.6));
  const lines = wrapText(text, maxCharsPerLine);
  const lineHeight = style.fontSize * 1.2;

  let svgContent = '';

  // Если CTA с фоном
  if (style.background) {
    const textWidth = Math.max(...lines.map(l => l.length)) * style.fontSize * 0.6;
    const textHeight = lines.length * lineHeight;
    const bgWidth = textWidth + style.bgPadding * 2;
    const bgHeight = textHeight + style.bgPadding;
    const bgX = (width - bgWidth) / 2;
    const bgY = height * (parseInt(style.y) / 100) - textHeight / 2 - style.bgPadding / 2;

    svgContent += `
      <rect
        x="${bgX}"
        y="${bgY}"
        width="${bgWidth}"
        height="${bgHeight}"
        rx="${style.bgRadius}"
        fill="${style.bgColor}"
      />`;
  }

  // Текст
  lines.forEach((line, i) => {
    const yOffset = (i - (lines.length - 1) / 2) * lineHeight;
    const yPos = `calc(${style.y} + ${yOffset}px)`;

    svgContent += `
      <text
        x="50%"
        y="${style.y}"
        dy="${yOffset}"
        text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif"
        font-size="${style.fontSize}"
        font-weight="${style.fontWeight}"
        fill="${style.fill}"
        ${style.stroke !== 'none' ? `stroke="${style.stroke}" stroke-width="${style.strokeWidth}"` : ''}
      >${escapeXml(line)}</text>`;
  });

  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      ${svgContent}
    </svg>`;
}

/**
 * Разбить текст на строки
 */
function wrapText(text, maxChars) {
  if (text.length <= maxChars) {
    return [text];
  }

  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= maxChars) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines;
}

/**
 * Экранировать XML спецсимволы
 */
function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Наложить текст на изображение
 *
 * @param {string} imageUrl - URL изображения (локальный путь /uploads/...)
 * @param {Array} texts - Массив текстов [{text, type}]
 * @returns {string} URL нового изображения с текстом
 */
export async function overlayTextOnImage(imageUrl, texts) {
  if (!texts || texts.length === 0) {
    return imageUrl;
  }

  try {
    // Получаем путь к файлу
    const filename = imageUrl.replace('/uploads/', '');

    // Security: Validate filename to prevent path traversal
    if (!filename || filename.includes('..') || filename.includes('\0') || !/^[a-zA-Z0-9_.-]+$/.test(filename)) {
      log.warn('Invalid filename for text overlay', { imageUrl, filename });
      return imageUrl;
    }

    const filepath = path.join(config.storagePath, filename);

    // Security: Verify resolved path is within storage directory
    const resolvedPath = path.resolve(filepath);
    const normalizedBase = path.resolve(config.storagePath);
    if (!resolvedPath.startsWith(normalizedBase + path.sep)) {
      log.warn('Path traversal attempt in text overlay', { imageUrl, resolvedPath });
      return imageUrl;
    }

    if (!fs.existsSync(filepath)) {
      log.warn('Image file not found for text overlay', { filepath });
      return imageUrl;
    }

    // Получаем размеры изображения
    const metadata = await sharp(filepath).metadata();
    const { width, height } = metadata;

    // Создаём SVG оверлеи для каждого текста
    const composites = [];

    for (const { text, type } of texts) {
      const svg = createTextSvg(text, type, width, height);
      composites.push({
        input: Buffer.from(svg),
        top: 0,
        left: 0
      });
    }

    // Накладываем текст
    const outputFilename = `text-${uuidv4()}.png`;
    const outputPath = path.join(config.storagePath, outputFilename);

    await sharp(filepath)
      .composite(composites)
      .png()
      .toFile(outputPath);

    log.info('Text overlay applied', {
      originalFile: filename,
      outputFile: outputFilename,
      textsCount: texts.length
    });

    return `/uploads/${outputFilename}`;

  } catch (error) {
    log.error('Failed to overlay text on image', {
      imageUrl,
      error: error.message
    });
    return imageUrl; // Возвращаем оригинал при ошибке
  }
}

/**
 * Обработать изображения от Runware — добавить текст из промпта
 *
 * @param {Array} images - Массив изображений [{url, mimeType, source}]
 * @param {string} prompt - Оригинальный промпт
 * @returns {Array} Массив изображений с текстом
 */
export async function processRunwareImages(images, prompt) {
  // Извлекаем текст из промпта
  const texts = extractTextFromPrompt(prompt);

  if (texts.length === 0) {
    log.info('No text found in prompt for overlay');
    return images;
  }

  log.info('Processing Runware images with text overlay', {
    imagesCount: images.length,
    textsCount: texts.length,
    texts: texts.map(t => t.text)
  });

  // Обрабатываем каждое изображение
  const processedImages = [];

  for (const image of images) {
    try {
      const newUrl = await overlayTextOnImage(image.url, texts);
      processedImages.push({
        ...image,
        url: newUrl,
        hasTextOverlay: newUrl !== image.url
      });
    } catch (error) {
      log.error('Failed to process image', { url: image.url, error: error.message });
      processedImages.push(image);
    }
  }

  return processedImages;
}

/**
 * Наложить PNG изображение текста на базовое изображение
 * Используется для стилизованного текста от Gemini
 *
 * @param {string} baseImageUrl - URL базового изображения (/uploads/...)
 * @param {string} textImageUrl - URL PNG с текстом (/uploads/...)
 * @param {Object} position - Позиция: {x, y, width, height} или preset ('top', 'center', 'bottom')
 * @returns {string} URL результирующего изображения
 */
export async function overlayPngText(baseImageUrl, textImageUrl, position = 'center') {
  try {
    // Получаем пути к файлам
    const baseFilename = baseImageUrl.replace('/uploads/', '');
    const textFilename = textImageUrl.replace('/uploads/', '');

    // Security: Validate filenames to prevent path traversal
    const filenamePattern = /^[a-zA-Z0-9_.-]+$/;
    if (!baseFilename || baseFilename.includes('..') || baseFilename.includes('\0') || !filenamePattern.test(baseFilename)) {
      log.warn('Invalid base filename for PNG overlay', { baseImageUrl, baseFilename });
      return baseImageUrl;
    }
    if (!textFilename || textFilename.includes('..') || textFilename.includes('\0') || !filenamePattern.test(textFilename)) {
      log.warn('Invalid text filename for PNG overlay', { textImageUrl, textFilename });
      return baseImageUrl;
    }

    const basePath = path.join(config.storagePath, baseFilename);
    const textPath = path.join(config.storagePath, textFilename);

    // Security: Verify resolved paths are within storage directory
    const normalizedBase = path.resolve(config.storagePath);
    const resolvedBasePath = path.resolve(basePath);
    const resolvedTextPath = path.resolve(textPath);

    if (!resolvedBasePath.startsWith(normalizedBase + path.sep) || !resolvedTextPath.startsWith(normalizedBase + path.sep)) {
      log.warn('Path traversal attempt in PNG overlay', { baseImageUrl, textImageUrl });
      return baseImageUrl;
    }

    if (!fs.existsSync(basePath) || !fs.existsSync(textPath)) {
      log.warn('Image files not found for PNG overlay', { basePath, textPath });
      return baseImageUrl;
    }

    // Получаем метаданные обоих изображений
    const baseMetadata = await sharp(basePath).metadata();
    const textMetadata = await sharp(textPath).metadata();

    // Вычисляем позицию текста
    let left, top;
    const textWidth = textMetadata.width;
    const textHeight = textMetadata.height;

    if (typeof position === 'string') {
      // Preset позиции
      switch (position) {
        case 'top':
          left = Math.floor((baseMetadata.width - textWidth) / 2);
          top = Math.floor(baseMetadata.height * 0.1);
          break;
        case 'center':
          left = Math.floor((baseMetadata.width - textWidth) / 2);
          top = Math.floor((baseMetadata.height - textHeight) / 2);
          break;
        case 'bottom':
          left = Math.floor((baseMetadata.width - textWidth) / 2);
          top = Math.floor(baseMetadata.height * 0.7);
          break;
        default:
          left = Math.floor((baseMetadata.width - textWidth) / 2);
          top = Math.floor(baseMetadata.height * 0.3);
      }
    } else {
      // Кастомная позиция
      left = position.x || 0;
      top = position.y || 0;
    }

    // Убедимся что текст не выходит за границы
    left = Math.max(0, Math.min(left, baseMetadata.width - textWidth));
    top = Math.max(0, Math.min(top, baseMetadata.height - textHeight));

    // Создаём композит
    const outputFilename = `styled-${uuidv4()}.png`;
    const outputPath = path.join(config.storagePath, outputFilename);

    await sharp(basePath)
      .composite([{
        input: textPath,
        top: top,
        left: left,
        blend: 'over'  // Стандартное наложение с учётом alpha
      }])
      .png()
      .toFile(outputPath);

    log.info('PNG text overlay applied', {
      baseFile: baseFilename,
      textFile: textFilename,
      outputFile: outputFilename,
      position: { left, top }
    });

    return `/uploads/${outputFilename}`;

  } catch (error) {
    log.error('Failed to overlay PNG text', {
      baseImageUrl,
      textImageUrl,
      error: error.message
    });
    return baseImageUrl;
  }
}

/**
 * Определить стиль текста по контексту промпта
 */
export function detectTextStyle(prompt) {
  const lowerPrompt = prompt.toLowerCase();

  if (lowerPrompt.includes('crypto') || lowerPrompt.includes('крипто') ||
      lowerPrompt.includes('bitcoin') || lowerPrompt.includes('биткоин')) {
    return 'crypto';
  }

  if (lowerPrompt.includes('betting') || lowerPrompt.includes('беттинг') ||
      lowerPrompt.includes('ставки') || lowerPrompt.includes('sport')) {
    return 'betting';
  }

  if (lowerPrompt.includes('bonus') || lowerPrompt.includes('бонус') ||
      lowerPrompt.includes('free') || lowerPrompt.includes('бесплатн')) {
    return 'bonus';
  }

  // По умолчанию - казино стиль
  return 'casino';
}

export default {
  extractTextFromPrompt,
  overlayTextOnImage,
  processRunwareImages,
  overlayPngText,
  detectTextStyle
};
