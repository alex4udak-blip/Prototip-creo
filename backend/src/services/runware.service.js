import { Runware } from '@runware/sdk-js';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/env.js';
import { log } from '../utils/logger.js';
import { fetchWithTimeout } from '../utils/fetchWithTimeout.js';
import { extractTextFromPrompt, overlayPngText, detectTextStyle } from './textOverlay.service.js';

const DOWNLOAD_TIMEOUT = 30000; // 30 seconds for image downloads

// Ленивый импорт для избежания циклической зависимости
let generateStyledTextPng = null;
async function getGenerateStyledTextPng() {
  if (!generateStyledTextPng) {
    const geminiModule = await import('./gemini.service.js');
    generateStyledTextPng = geminiModule.generateStyledTextPng;
  }
  return generateStyledTextPng;
}

// Singleton instance
let runwareClient = null;

/**
 * Модели Runware — FALLBACK для заблокированного Gemini контента
 *
 * КЛЮЧЕВЫЕ ОСОБЕННОСТИ:
 * ✅ checkNSFW: false — отключаем NSFW фильтр для gambling/casino/18+ контента
 * ✅ Juggernaut Pro FLUX — модель БЕЗ ОГРАНИЧЕНИЙ (unrestricted)
 * ✅ IPAdapter — для сохранения стиля референсов
 * ✅ Gemini генерирует стилизованный текст PNG отдельно
 *
 * Модели:
 * runware:100@1 - FLUX Schnell (быстрый, базовый) - $0.0013/1024x1024
 * runware:101@1 - FLUX Dev (для IPAdapter) - ~$0.02/1024x1024
 * runware:105@1 - FLUX Redux (IPAdapter для стиля) - используется с FLUX Dev
 * rundiffusion:130@100 - Juggernaut Pro FLUX (фотореализм, БЕЗ ЦЕНЗУРЫ) - $0.0066/1024x1024
 *
 * Стратегия:
 * - С референсами: FLUX Dev + IPAdapter Redux (понимает стиль концептуально)
 * - Без референсов: Juggernaut Pro (фотореализм, unrestricted)
 * - Текст: Gemini генерирует PNG → накладываем через Sharp
 *
 * Источники:
 * - https://runware.ai/models/juggernaut-pro-flux-by-rundiffusion
 * - https://github.com/Runware/sdk-js
 */
const MODELS = {
  FLUX_SCHNELL: 'runware:100@1',
  FLUX_DEV: 'runware:101@1',              // Базовая модель для IPAdapter
  FLUX_REDUX: 'runware:105@1',            // IPAdapter для стилевого переноса
  JUGGERNAUT_PRO: 'rundiffusion:130@100',
  JUGGERNAUT_LIGHTNING: 'rundiffusion:133@100'
};

/**
 * Получить или создать Runware клиент
 */
async function getRunwareClient() {
  if (!runwareClient && config.runwareApiKey) {
    runwareClient = new Runware({ apiKey: config.runwareApiKey });
    await runwareClient.ensureConnection();
    log.info('Runware client connected');
  }
  return runwareClient;
}

/**
 * Конвертировать base64 в data URI для Runware
 */
function toDataUri(base64Data, mimeType = 'image/png') {
  if (!base64Data) {
    return null;
  }
  if (typeof base64Data === 'string' && base64Data.startsWith('data:')) {
    return base64Data;
  }
  return `data:${mimeType};base64,${base64Data}`;
}

/**
 * Генерация изображений через Runware API
 * Используется как fallback когда Gemini блокирует контент
 *
 * Стратегия:
 * - С референсами: FLUX Dev + IPAdapter (понимает стиль концептуально, как Gemini)
 * - Без референсов: Juggernaut Pro (фотореализм, меньше цензуры)
 *
 * @param {string} prompt - Текст промпта
 * @param {Object} options - Опции генерации
 * @param {Array} options.referenceImages - Референсы [{data: base64, mimeType}]
 * @param {number} options.width - Ширина
 * @param {number} options.height - Высота
 * @param {number} options.count - Количество изображений
 * @param {Function} onProgress - Callback для прогресса
 */
export async function generateWithRunware(prompt, options = {}, onProgress) {
  if (!config.runwareApiKey) {
    throw new Error('Runware API key not configured');
  }

  const {
    referenceImages = [],
    width = 1024,
    height = 1024,
    count = 1
  } = options;

  const hasReferences = referenceImages.length > 0 && referenceImages[0]?.data;

  // Выбираем стратегию:
  // - С референсами: FLUX Dev + IPAdapter (стилевой перенос как у Gemini)
  // - Без референсов: Juggernaut Pro (фотореализм, меньше цензуры)
  const useIPAdapter = hasReferences;
  const model = useIPAdapter ? MODELS.FLUX_DEV : (config.runware.model || MODELS.JUGGERNAUT_PRO);

  log.info('Starting Runware image generation', {
    promptLength: prompt.length,
    width,
    height,
    count,
    model,
    strategy: useIPAdapter ? 'IPAdapter (style transfer)' : 'Direct generation',
    hasReferences,
    referencesCount: referenceImages.length
  });

  if (onProgress) {
    onProgress({
      status: 'runware_starting',
      message: useIPAdapter
        ? 'Переключаюсь на Runware с IPAdapter (стилевой перенос)...'
        : 'Переключаюсь на Runware Juggernaut...'
    });
  }

  try {
    const client = await getRunwareClient();

    if (onProgress) {
      onProgress({
        status: 'runware_generating',
        message: useIPAdapter
          ? `Генерирую ${count} изображени${count === 1 ? 'е' : 'я'} по стилю референса...`
          : `Генерирую ${count} изображени${count === 1 ? 'е' : 'я'} через Juggernaut Pro...`
      });
    }

    // Базовые параметры генерации
    // ВАЖНО: checkNSFW: false — отключаем NSFW фильтр для генерации казино/беттинг контента
    // Juggernaut Pro FLUX — модель без ограничений, идеально для gambling тематики
    const inferenceParams = {
      positivePrompt: prompt,
      negativePrompt: 'blurry, low quality, distorted text, watermark, signature, ugly, deformed, bad anatomy',
      model: model,
      width: width,
      height: height,
      numberResults: count,
      outputType: 'URL',
      outputFormat: 'PNG',
      checkNSFW: false  // Отключаем NSFW проверку — разрешаем gambling/casino/18+ контент
    };

    // Настройки в зависимости от стратегии
    if (useIPAdapter) {
      // IPAdapter стратегия — понимает стиль концептуально (как Gemini)
      // Используем FLUX Dev + Redux IPAdapter
      inferenceParams.steps = 28;      // Больше шагов для качества
      inferenceParams.CFGScale = 3.5;  // Немного выше для следования промпту

      // Добавляем IPAdapter с референсом
      const firstRef = referenceImages[0];
      const guideImageUri = toDataUri(firstRef.data, firstRef.mimeType);

      if (guideImageUri) {
        inferenceParams.ipAdapters = [{
          model: MODELS.FLUX_REDUX,    // FLUX Redux для стилевого переноса
          guideImage: guideImageUri,
          weight: 0.8                   // Сила влияния стиля (0.8 = сильное)
        }];

        log.info('Using IPAdapter for style transfer', {
          ipAdapterModel: MODELS.FLUX_REDUX,
          weight: 0.8,
          mimeType: firstRef.mimeType,
          dataLength: firstRef.data?.length
        });
      }
    } else {
      // Прямая генерация через Juggernaut Pro
      inferenceParams.steps = 25;
      inferenceParams.CFGScale = 3.0;
    }

    // Генерируем изображения
    const images = await client.imageInference(inferenceParams);

    log.info('Runware generation response', {
      imagesCount: images?.length || 0,
      firstImageUrl: images?.[0]?.imageURL?.substring(0, 50),
      strategy: useIPAdapter ? 'IPAdapter' : 'Direct'
    });

    const results = [];

    // Скачиваем и сохраняем изображения локально
    for (let i = 0; i < images.length; i++) {
      const image = images[i];

      if (image.imageURL) {
        try {
          const localUrl = await downloadAndSaveImage(image.imageURL);
          results.push({
            url: localUrl,
            mimeType: 'image/png',
            source: 'runware'
          });

          if (onProgress) {
            onProgress({
              status: 'runware_image_ready',
              message: `Изображение ${results.length}/${count} готово`,
              imagesCount: results.length,
              newImage: localUrl
            });
          }
        } catch (downloadError) {
          log.error('Failed to download Runware image', {
            index: i,
            error: downloadError.message
          });
        }
      }
    }

    log.info('Runware generation complete', {
      requested: count,
      generated: results.length,
      model: model,
      strategy: useIPAdapter ? 'IPAdapter' : 'Direct'
    });

    // Этап 2: Стилизованный текст через Gemini
    // FLUX модели плохо рендерят текст, поэтому используем Gemini для генерации
    // красивого текста PNG и накладываем его
    let finalImages = results;
    const extractedTexts = extractTextFromPrompt(prompt);

    if (extractedTexts.length > 0 && results.length > 0) {
      if (onProgress) {
        onProgress({
          status: 'runware_adding_text',
          message: 'Генерирую стилизованный текст через Gemini...',
          imagesCount: results.length
        });
      }

      // Определяем стиль по контексту
      const textStyle = detectTextStyle(prompt);

      try {
        // Получаем функцию генерации текста (ленивый импорт)
        const genStyledText = await getGenerateStyledTextPng();

        // Генерируем стилизованный текст для главного заголовка
        const headlineText = extractedTexts.find(t => t.type === 'headline') || extractedTexts[0];
        const ctaText = extractedTexts.find(t => t.type === 'cta');

        // Генерируем PNG текста через Gemini (параллельно если есть CTA)
        const textGenerationPromises = [];

        if (headlineText) {
          textGenerationPromises.push(
            genStyledText(headlineText.text, textStyle, {
              width: width,
              height: Math.floor(height * 0.25),
              textType: 'headline'
            }).then(result => ({ ...result, type: 'headline', position: 'top' }))
          );
        }

        if (ctaText) {
          textGenerationPromises.push(
            genStyledText(ctaText.text, textStyle, {
              width: Math.floor(width * 0.4),
              height: Math.floor(height * 0.15),
              textType: 'cta'
            }).then(result => ({ ...result, type: 'cta', position: 'bottom' }))
          );
        }

        const textPngs = (await Promise.all(textGenerationPromises)).filter(t => t?.url);

        log.info('Generated styled text PNGs via Gemini', {
          requested: textGenerationPromises.length,
          generated: textPngs.length,
          style: textStyle
        });

        // Накладываем текст на каждое изображение
        if (textPngs.length > 0) {
          const processedImages = [];

          for (const image of results) {
            let currentUrl = image.url;

            // Накладываем каждый текстовый PNG
            for (const textPng of textPngs) {
              currentUrl = await overlayPngText(currentUrl, textPng.url, textPng.position);
            }

            processedImages.push({
              ...image,
              url: currentUrl,
              hasStyledText: true
            });
          }

          finalImages = processedImages;

          log.info('Styled text overlay applied to Runware images', {
            textsCount: textPngs.length,
            imagesProcessed: finalImages.length
          });
        }
      } catch (textError) {
        log.error('Failed to generate/apply styled text', { error: textError.message });
        // Продолжаем с оригинальными изображениями (без текста)
      }
    }

    const sourceText = useIPAdapter
      ? 'Runware FLUX + IPAdapter (стилевой перенос)'
      : 'Runware Juggernaut Pro';

    const textNote = extractedTexts.length > 0
      ? ' Текст добавлен программно.'
      : '';

    return {
      images: finalImages,
      text: finalImages.length > 0
        ? `Сгенерировано ${finalImages.length} изображений через ${sourceText} (Gemini заблокировал запрос).${textNote}`
        : 'Не удалось сгенерировать изображения.',
      source: 'runware'
    };

  } catch (error) {
    log.error('Runware generation failed', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Скачать изображение и сохранить локально (async-safe)
 */
async function downloadAndSaveImage(imageUrl) {
  const response = await fetchWithTimeout(imageUrl, { timeout: DOWNLOAD_TIMEOUT });
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  // Validate buffer size
  if (buffer.length < 100) {
    throw new Error('Downloaded image too small');
  }

  const MAX_SIZE = 50 * 1024 * 1024; // 50MB
  if (buffer.length > MAX_SIZE) {
    throw new Error(`Downloaded image too large: ${buffer.length} bytes`);
  }

  const filename = `runware-${uuidv4()}.png`;
  const filepath = path.join(config.storagePath, filename);

  // Async directory creation
  try {
    await fs.access(config.storagePath);
  } catch {
    await fs.mkdir(config.storagePath, { recursive: true });
  }

  // Async file write
  await fs.writeFile(filepath, buffer);

  log.debug('Saved Runware image', { filename, sizeKB: Math.round(buffer.length / 1024) });

  return `/uploads/${filename}`;
}

/**
 * Проверка доступности Runware API
 * НЕ подключается реально — только проверяет конфигурацию
 */
export async function checkRunwareHealth() {
  if (!config.runwareApiKey) {
    return { available: false, reason: 'API key not configured' };
  }

  // Возвращаем информацию о конфигурации без реального подключения
  // Реальное подключение происходит только при генерации
  return {
    available: true,
    configured: true,
    models: {
      withReferences: `${MODELS.FLUX_DEV} + ${MODELS.FLUX_REDUX} (IPAdapter)`,
      withoutReferences: config.runware.model || MODELS.JUGGERNAUT_PRO
    }
  };
}

/**
 * Remove background from image using Runware API
 * @param {Buffer} imageBuffer - Image data
 * @returns {Promise<Buffer>} Image with transparent background
 */
export async function removeBackground(imageBuffer) {
  if (!config.runwareApiKey) {
    throw new Error('Runware API key not configured');
  }

  // Validate input
  if (!Buffer.isBuffer(imageBuffer)) {
    throw new Error('Invalid input: expected Buffer');
  }

  if (imageBuffer.length < 100) {
    throw new Error('Image buffer too small');
  }

  // Limit image size for base64 encoding (10MB max)
  const MAX_SIZE = 10 * 1024 * 1024;
  if (imageBuffer.length > MAX_SIZE) {
    throw new Error(`Image too large for background removal: ${imageBuffer.length} bytes (max ${MAX_SIZE})`);
  }

  log.info('Runware: Removing background', { sizeKB: Math.round(imageBuffer.length / 1024) });

  try {
    const client = await getRunwareClient();

    // Convert buffer to base64 data URI
    const base64Data = imageBuffer.toString('base64');
    const dataUri = `data:image/png;base64,${base64Data}`;

    // Use Runware's background removal - method is removeBackground, not imageBackgroundRemoval
    const result = await client.removeBackground({
      inputImage: dataUri,
      outputFormat: 'PNG',
      rgba: [0, 0, 0, 0],  // Transparent
      postProcessMask: true,
      returnOnlyMask: false,
      alphaMatting: true,  // Better edges for hair/details
      alphaMattingForegroundThreshold: 240,
      alphaMattingBackgroundThreshold: 10,
      alphaMattingErodeSize: 10
    });

    // Result can be single object or array
    const resultItem = Array.isArray(result) ? result[0] : result;

    if (!resultItem || (!resultItem.imageURL && !resultItem.imageBase64Data)) {
      throw new Error('No result from background removal');
    }

    let processedBuffer;

    if (resultItem.imageBase64Data) {
      // Use base64 data directly if available
      processedBuffer = Buffer.from(resultItem.imageBase64Data, 'base64');
    } else {
      // Download the processed image from URL
      const response = await fetchWithTimeout(resultItem.imageURL, { timeout: DOWNLOAD_TIMEOUT });
      if (!response.ok) {
        throw new Error(`Failed to download processed image: ${response.status}`);
      }
      processedBuffer = Buffer.from(await response.arrayBuffer());
    }

    log.info('Runware: Background removed', {
      originalSizeKB: Math.round(imageBuffer.length / 1024),
      processedSizeKB: Math.round(processedBuffer.length / 1024)
    });

    return processedBuffer;
  } catch (error) {
    log.error('Runware: Background removal failed', { error: error.message });
    throw error;
  }
}

/**
 * Remove background from image file
 * @param {string} imagePath - Path to image file
 * @returns {Promise<Buffer>} Image with transparent background
 */
export async function removeBackgroundFromFile(imagePath) {
  const imageBuffer = await fs.readFile(imagePath);
  return removeBackground(imageBuffer);
}

export default {
  generateWithRunware,
  checkRunwareHealth,
  removeBackground,
  removeBackgroundFromFile
};
