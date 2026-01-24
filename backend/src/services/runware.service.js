import { Runware } from '@runware/sdk-js';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/env.js';
import { log } from '../utils/logger.js';
import { processRunwareImages, extractTextFromPrompt } from './textOverlay.service.js';

// Singleton instance
let runwareClient = null;

/**
 * Модели Runware
 *
 * runware:100@1 - FLUX Schnell (быстрый, базовый) - $0.0013/1024x1024
 * runware:101@1 - FLUX Dev (для IPAdapter) - ~$0.02/1024x1024
 * runware:105@1 - FLUX Redux (IPAdapter для стиля) - используется с FLUX Dev
 * rundiffusion:130@100 - Juggernaut Pro FLUX (фотореализм) - $0.0066/1024x1024
 *
 * Стратегия:
 * - С референсами: FLUX Dev + IPAdapter Redux (как Gemini — понимает стиль концептуально)
 * - Без референсов: Juggernaut Pro (фотореализм, меньше цензуры)
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
    const inferenceParams = {
      positivePrompt: prompt,
      negativePrompt: 'blurry, low quality, distorted text, watermark, signature, ugly, deformed, bad anatomy',
      model: model,
      width: width,
      height: height,
      numberResults: count,
      outputType: 'URL',
      outputFormat: 'PNG'
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

    // Этап 2: Наложение текста из промпта
    // FLUX модели плохо рендерят текст, поэтому накладываем программно
    let finalImages = results;
    const extractedTexts = extractTextFromPrompt(prompt);

    if (extractedTexts.length > 0 && results.length > 0) {
      if (onProgress) {
        onProgress({
          status: 'runware_adding_text',
          message: 'Добавляю текст на изображения...',
          imagesCount: results.length
        });
      }

      try {
        finalImages = await processRunwareImages(results, prompt);
        log.info('Text overlay applied to Runware images', {
          textsCount: extractedTexts.length,
          imagesProcessed: finalImages.length
        });
      } catch (textError) {
        log.error('Failed to apply text overlay', { error: textError.message });
        // Продолжаем с оригинальными изображениями
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
 * Скачать изображение и сохранить локально
 */
async function downloadAndSaveImage(imageUrl) {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const filename = `runware-${uuidv4()}.png`;
  const filepath = path.join(config.storagePath, filename);

  if (!fs.existsSync(config.storagePath)) {
    fs.mkdirSync(config.storagePath, { recursive: true });
  }

  fs.writeFileSync(filepath, buffer);

  log.debug('Saved Runware image', { filename, sizeKB: Math.round(buffer.length / 1024) });

  return `/uploads/${filename}`;
}

/**
 * Проверка доступности Runware API
 */
export async function checkRunwareHealth() {
  if (!config.runwareApiKey) {
    return { available: false, reason: 'API key not configured' };
  }

  try {
    const client = await getRunwareClient();
    return {
      available: !!client,
      models: {
        withReferences: `${MODELS.FLUX_DEV} + ${MODELS.FLUX_REDUX} (IPAdapter)`,
        withoutReferences: config.runware.model || MODELS.JUGGERNAUT_PRO
      }
    };
  } catch (error) {
    return { available: false, reason: error.message };
  }
}

export default {
  generateWithRunware,
  checkRunwareHealth
};
