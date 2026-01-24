import { Runware } from '@runware/sdk-js';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/env.js';
import { log } from '../utils/logger.js';

// Singleton instance
let runwareClient = null;

/**
 * Модели Runware
 *
 * runware:100@1 - FLUX Schnell (быстрый, базовый) - $0.0013/1024x1024
 * runware:101@1 - FLUX Dev (качественнее, для IPAdapter) - ~$0.02/1024x1024
 * rundiffusion:130@100 - Juggernaut Pro FLUX (фотореализм, меньше цензуры) - $0.0066/1024x1024
 *
 * Для fallback используем Juggernaut Pro FLUX — лучшее качество и меньше ограничений
 */
const MODELS = {
  FLUX_SCHNELL: 'runware:100@1',           // Быстрый, дешёвый
  FLUX_DEV: 'runware:101@1',               // Для IPAdapter/Redux
  JUGGERNAUT_PRO: 'rundiffusion:130@100',  // Фотореализм, меньше цензуры
  JUGGERNAUT_LIGHTNING: 'rundiffusion:133@100' // Быстрый Juggernaut
};

// Используем Juggernaut Pro для лучшего качества и меньшей цензуры
const DEFAULT_MODEL = MODELS.JUGGERNAUT_PRO;

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
  // Если уже data URI — возвращаем как есть
  if (typeof base64Data === 'string' && base64Data.startsWith('data:')) {
    return base64Data;
  }
  return `data:${mimeType};base64,${base64Data}`;
}

/**
 * Генерация изображений через Runware API
 * Используется как fallback когда Gemini блокирует контент
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

  const model = config.runware.model || DEFAULT_MODEL;

  log.info('Starting Runware image generation', {
    promptLength: prompt.length,
    width,
    height,
    count,
    model,
    hasReferences: referenceImages.length > 0,
    referencesCount: referenceImages.length
  });

  if (onProgress) {
    onProgress({
      status: 'runware_starting',
      message: referenceImages.length > 0
        ? 'Переключаюсь на Runware с референсами...'
        : 'Переключаюсь на Runware Juggernaut...'
    });
  }

  try {
    const client = await getRunwareClient();

    if (onProgress) {
      onProgress({
        status: 'runware_generating',
        message: `Генерирую ${count} изображени${count === 1 ? 'е' : 'я'} через Juggernaut Pro...`
      });
    }

    // Базовые параметры генерации
    const inferenceParams = {
      positivePrompt: prompt,
      negativePrompt: 'blurry, low quality, distorted text, watermark, signature, ugly, deformed',
      model: model,
      width: width,
      height: height,
      numberResults: count,
      outputType: 'URL',
      outputFormat: 'PNG',
      steps: 25,           // Оптимально для Juggernaut Pro
      CFGScale: 3.0        // Рекомендуемое значение для Juggernaut
    };

    // Если есть референсы — используем image-to-image с первым референсом
    // Это позволяет сохранить стиль оригинального изображения
    if (referenceImages.length > 0 && referenceImages[0]?.data) {
      const firstRef = referenceImages[0];
      const seedImageUri = toDataUri(firstRef.data, firstRef.mimeType);

      if (seedImageUri) {
        inferenceParams.seedImage = seedImageUri;
        inferenceParams.strength = 0.75; // Баланс между оригиналом и промптом

        log.info('Using reference image for Runware', {
          mimeType: firstRef.mimeType,
          dataLength: firstRef.data?.length
        });
      }
    }

    // Генерируем изображения
    const images = await client.imageInference(inferenceParams);

    log.info('Runware generation response', {
      imagesCount: images?.length || 0,
      firstImageUrl: images?.[0]?.imageURL?.substring(0, 50)
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
      model: model
    });

    return {
      images: results,
      text: results.length > 0
        ? `Сгенерировано ${results.length} изображений через Runware Juggernaut Pro (Gemini заблокировал запрос).`
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
      model: config.runware.model || DEFAULT_MODEL
    };
  } catch (error) {
    return { available: false, reason: error.message };
  }
}

export default {
  generateWithRunware,
  checkRunwareHealth
};
