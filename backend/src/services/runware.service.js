import { Runware } from '@runware/sdk-js';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/env.js';
import { log } from '../utils/logger.js';

// Singleton instance
let runwareClient = null;

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
 * Генерация изображений через Runware API (FLUX модели)
 * Используется как fallback когда Gemini блокирует контент
 *
 * @param {string} prompt - Текст промпта
 * @param {Object} options - Опции генерации
 * @param {Function} onProgress - Callback для прогресса
 */
export async function generateWithRunware(prompt, options = {}, onProgress) {
  if (!config.runwareApiKey) {
    throw new Error('Runware API key not configured');
  }

  const {
    width = 1024,
    height = 1024,
    count = 1
  } = options;

  log.info('Starting Runware image generation', {
    promptLength: prompt.length,
    width,
    height,
    count,
    model: config.runware.model
  });

  if (onProgress) {
    onProgress({
      status: 'runware_starting',
      message: 'Переключаюсь на Runware FLUX...'
    });
  }

  try {
    const client = await getRunwareClient();

    if (onProgress) {
      onProgress({
        status: 'runware_generating',
        message: `Генерирую ${count} изображени${count === 1 ? 'е' : 'я'} через FLUX...`
      });
    }

    // Генерируем изображения
    const images = await client.imageInference({
      positivePrompt: prompt,
      model: config.runware.model,
      width: width,
      height: height,
      numberResults: count,
      outputType: 'URL',
      outputFormat: 'PNG'
    });

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
      generated: results.length
    });

    return {
      images: results,
      text: results.length > 0
        ? `Сгенерировано ${results.length} изображений через Runware FLUX (Gemini заблокировал запрос).`
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
      model: config.runware.model
    };
  } catch (error) {
    return { available: false, reason: error.message };
  }
}

export default {
  generateWithRunware,
  checkRunwareHealth
};
