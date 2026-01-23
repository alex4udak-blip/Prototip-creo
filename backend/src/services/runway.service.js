import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/env.js';
import { log } from '../utils/logger.js';

const RUNWAY_API_BASE = 'https://api.dev.runwayml.com/v1';
const RUNWAY_VERSION = '2024-11-06';

/**
 * Генерация изображений через Runway API (Gen-4 Image)
 * Используется как fallback когда Gemini блокирует контент
 *
 * @param {string} prompt - Текст промпта
 * @param {Object} options - Опции генерации
 * @param {Function} onProgress - Callback для прогресса
 */
export async function generateWithRunway(prompt, options = {}, onProgress) {
  if (!config.runwayApiKey) {
    throw new Error('Runway API key not configured');
  }

  const {
    ratio = '1024:1024',
    count = 1
  } = options;

  log.info('Starting Runway image generation', {
    promptLength: prompt.length,
    ratio,
    count
  });

  if (onProgress) {
    onProgress({
      status: 'runway_starting',
      message: 'Переключаюсь на Runway Gen-4...'
    });
  }

  const results = [];

  // Генерируем изображения по одному (Runway не поддерживает batch)
  for (let i = 0; i < count; i++) {
    try {
      if (onProgress) {
        onProgress({
          status: 'runway_generating',
          message: `Генерирую изображение ${i + 1}/${count} через Runway...`,
          imagesCount: results.length
        });
      }

      // Создаём задачу генерации
      const taskResponse = await fetch(`${RUNWAY_API_BASE}/text_to_image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.runwayApiKey}`,
          'X-Runway-Version': RUNWAY_VERSION,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: config.runway.model,
          promptText: prompt,
          ratio: ratio
        })
      });

      if (!taskResponse.ok) {
        const errorData = await taskResponse.json().catch(() => ({}));
        log.error('Runway task creation failed', {
          status: taskResponse.status,
          error: errorData
        });
        continue;
      }

      const task = await taskResponse.json();
      log.info('Runway task created', { taskId: task.id });

      // Ждём завершения задачи
      const imageUrl = await pollTaskResult(task.id, onProgress);

      if (imageUrl) {
        // Скачиваем и сохраняем локально
        const localUrl = await downloadAndSaveImage(imageUrl);
        results.push({
          url: localUrl,
          mimeType: 'image/png',
          source: 'runway'
        });

        if (onProgress) {
          onProgress({
            status: 'runway_image_ready',
            message: `Изображение ${results.length}/${count} готово`,
            imagesCount: results.length,
            newImage: localUrl
          });
        }
      }
    } catch (error) {
      log.error('Runway generation failed for image', {
        index: i,
        error: error.message
      });
    }
  }

  log.info('Runway generation complete', {
    requested: count,
    generated: results.length
  });

  return {
    images: results,
    text: results.length > 0
      ? `Сгенерировано ${results.length} изображений через Runway Gen-4 (Gemini заблокировал запрос).`
      : 'Не удалось сгенерировать изображения.',
    source: 'runway'
  };
}

/**
 * Поллинг статуса задачи Runway
 */
async function pollTaskResult(taskId, onProgress, maxAttempts = 60) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await sleep(5000); // Runway рекомендует не чаще 5 секунд

    try {
      const response = await fetch(`${RUNWAY_API_BASE}/tasks/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${config.runwayApiKey}`,
          'X-Runway-Version': RUNWAY_VERSION
        }
      });

      if (!response.ok) {
        log.warn('Runway task poll failed', {
          taskId,
          attempt,
          status: response.status
        });
        continue;
      }

      const task = await response.json();

      if (task.status === 'SUCCEEDED') {
        log.info('Runway task completed', { taskId });
        // Возвращаем URL первого выходного изображения
        return task.output?.[0] || task.outputUrl;
      }

      if (task.status === 'FAILED') {
        log.error('Runway task failed', { taskId, error: task.error });
        return null;
      }

      // Ещё в процессе
      if (onProgress && attempt % 3 === 0) {
        onProgress({
          status: 'runway_processing',
          message: 'Runway обрабатывает запрос...'
        });
      }
    } catch (error) {
      log.warn('Runway poll error', { taskId, attempt, error: error.message });
    }
  }

  log.error('Runway task timeout', { taskId });
  return null;
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
  const filename = `runway-${uuidv4()}.png`;
  const filepath = path.join(config.storagePath, filename);

  if (!fs.existsSync(config.storagePath)) {
    fs.mkdirSync(config.storagePath, { recursive: true });
  }

  fs.writeFileSync(filepath, buffer);

  log.debug('Saved Runway image', { filename, sizeKB: Math.round(buffer.length / 1024) });

  return `/uploads/${filename}`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Проверка доступности Runway API
 */
export async function checkRunwayHealth() {
  if (!config.runwayApiKey) {
    return { available: false, reason: 'API key not configured' };
  }

  try {
    // Простая проверка — валидность ключа
    const response = await fetch(`${RUNWAY_API_BASE}/tasks`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.runwayApiKey}`,
        'X-Runway-Version': RUNWAY_VERSION
      }
    });

    return {
      available: response.status !== 401,
      status: response.status
    };
  } catch (error) {
    return { available: false, reason: error.message };
  }
}

export default {
  generateWithRunway,
  checkRunwayHealth
};
