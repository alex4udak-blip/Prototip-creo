import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import archiver from 'archiver';
import { db } from '../db/client.js';
import { config } from '../config/env.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { broadcastToChat } from '../websocket/handler.js';
import { log } from '../utils/logger.js';

const router = Router();

// Все routes требуют авторизации
router.use(authMiddleware);

/**
 * Валидация входных данных для генерации лендинга
 *
 * ВАЖНО: Система понимает ЛЮБЫЕ механики!
 * Пользователь даёт:
 * - description: текстовое описание ("колесо фортуны в стиле Gates of Olympus")
 * - referenceImage: референс изображение (опционально)
 * - ИЛИ type + theme для быстрого выбора
 */
function validateGenerateInput(body) {
  const errors = [];

  // Вариант 1: Описание (рекомендуемый) — система сама определит механику
  if (body.description) {
    if (typeof body.description !== 'string' || body.description.trim().length < 10) {
      errors.push('Описание должно быть минимум 10 символов');
    }
    return errors; // description достаточно, остальное опционально
  }

  // Вариант 2: Явный type (для быстрого выбора из известных механик)
  if (!body.type && !body.description) {
    errors.push('Укажите description (описание) или type (тип механики)');
  }

  // theme может быть текстовым описанием стиля
  if (body.theme && typeof body.theme !== 'string') {
    errors.push('Тема должна быть строкой');
  }

  if (body.config && typeof body.config !== 'object') {
    errors.push('Конфигурация должна быть объектом');
  }

  return errors;
}

/**
 * GET /api/landing/mechanics
 * Получить список поддерживаемых механик (автоматически из архивов)
 * Система ПОНИМАЕТ любые механики — это список известных
 */
router.get('/mechanics', async (req, res) => {
  try {
    // Известные механики из наших архивов
    const mechanics = [
      { id: 'wheel', name: 'Fortune Wheel', description: 'Колесо фортуны с секторами призов', archives: ['585', '688', '691'] },
      { id: 'boxes', name: 'Gift Boxes', description: 'Подарочные боксы с призами', archives: ['684'] },
      { id: 'crash', name: 'Chicken Road / Crash', description: 'Игра с множителем и риском', archives: ['678', '681'] },
      { id: 'board', name: 'Board Game', description: 'Настольная игра с кубиками', archives: ['642', '653'] },
      { id: 'tower', name: 'Tower Stacker', description: 'Строительство башни', archives: ['659'] },
      { id: 'fishing', name: 'Ice Fishing', description: 'Рыбалка с призами', archives: ['custom'] },
      { id: 'scratch', name: 'Scratch Card', description: 'Скретч карта', archives: ['custom'] },
      { id: 'slots', name: 'Slot Machine', description: 'Слот машина', archives: ['custom'] },
      { id: 'custom', name: 'Custom', description: 'Любая другая механика — опиши и сгенерируем', archives: [] }
    ];

    res.json({
      success: true,
      mechanics,
      note: 'Система понимает ЛЮБЫЕ механики. Просто опишите что хотите.'
    });
  } catch (error) {
    log.error('Failed to list mechanics', { error: error.message });
    res.status(500).json({ success: false, error: 'Ошибка' });
  }
});

/**
 * POST /api/landing/generate
 * Генерация нового лендинга
 */
router.post('/generate', async (req, res) => {
  const startTime = Date.now();
  let landingId = null;

  try {
    const {
      description,           // "Колесо фортуны в стиле Gates of Olympus"
      referenceImage,        // Base64 или URL референса
      type,                  // Опционально: 'wheel', 'boxes', etc.
      theme,                 // Опционально: 'casino', 'christmas' или текстовое описание
      config: landingConfig  // Дополнительные настройки
    } = req.body;
    const userId = req.user.id;

    // Валидация
    const validationErrors = validateGenerateInput(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Ошибка валидации',
        details: validationErrors
      });
    }

    // Тип механики определит AI на основе description
    // Если description есть - тип определится автоматически
    // Если нет - используем переданный type или 'wheel' по умолчанию
    let resolvedType = type || 'wheel';
    let resolvedTheme = theme || 'casino';

    log.info('Landing generation request', {
      hasDescription: !!description,
      explicitType: type,
      resolvedType
    });

    // Создаём запись лендинга в БД
    const landing = await db.insert('landings', {
      user_id: userId,
      type: resolvedType || 'custom',
      theme: (resolvedTheme || 'casino').toString().trim(),
      config: JSON.stringify({
        ...landingConfig,
        description,           // Сохраняем оригинальное описание
        hasReference: !!referenceImage
      }),
      status: 'pending'
    });

    landingId = landing.id;

    // Отправляем начальный ответ
    res.json({
      success: true,
      landingId,
      status: 'processing',
      detectedMechanic: resolvedType,
      previewUrl: `/api/landing/${landingId}/preview`,
      downloadUrl: `/api/landing/${landingId}/download`
    });

    // Даём фронтенду время подписаться на WebSocket
    await new Promise(resolve => setTimeout(resolve, 300));

    // Запускаем генерацию асинхронно
    processLandingGeneration({
      landingId,
      type: resolvedType,
      theme: resolvedTheme,
      description,           // Передаём описание
      referenceImage,        // Передаём референс
      config: landingConfig || {},
      userId,
      startTime
    }).catch(error => {
      log.error('Landing generation failed', { error: error.message, landingId });
      broadcastLandingProgress(landingId, {
        type: 'landing_error',
        error: error.message || 'Ошибка генерации лендинга'
      });
    });

  } catch (error) {
    log.error('Landing generate endpoint error', { error: error.message });

    if (landingId) {
      broadcastLandingProgress(landingId, {
        type: 'landing_error',
        error: error.message
      });
    }

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Ошибка генерации лендинга'
      });
    }
  }
});

/**
 * GET /api/landing/:id
 * Получить метаданные лендинга
 */
router.get('/:id', async (req, res) => {
  try {
    const landingId = parseInt(req.params.id);
    const userId = req.user.id;

    if (isNaN(landingId)) {
      return res.status(400).json({
        success: false,
        error: 'Невалидный ID лендинга'
      });
    }

    const landing = await db.getOne(
      `SELECT id, type, theme, config, status, assets, created_at, updated_at, generation_time_ms
       FROM landings
       WHERE id = $1 AND user_id = $2`,
      [landingId, userId]
    );

    if (!landing) {
      return res.status(404).json({
        success: false,
        error: 'Лендинг не найден'
      });
    }

    // Формируем URLs
    const baseUrl = getBaseUrl(req);

    res.json({
      success: true,
      landing: {
        id: landing.id,
        type: landing.type,
        theme: landing.theme,
        config: typeof landing.config === 'string' ? JSON.parse(landing.config) : landing.config,
        status: landing.status,
        assets: typeof landing.assets === 'string' ? JSON.parse(landing.assets) : landing.assets,
        createdAt: landing.created_at,
        updatedAt: landing.updated_at,
        generationTimeMs: landing.generation_time_ms,
        previewUrl: `${baseUrl}/api/landing/${landing.id}/preview`,
        downloadUrl: `${baseUrl}/api/landing/${landing.id}/download`
      }
    });

  } catch (error) {
    log.error('Get landing error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Ошибка получения данных лендинга'
    });
  }
});

/**
 * GET /api/landing/:id/preview
 * HTML preview лендинга
 */
router.get('/:id/preview', async (req, res) => {
  try {
    const landingId = parseInt(req.params.id);
    const userId = req.user.id;

    if (isNaN(landingId)) {
      return res.status(400).json({
        success: false,
        error: 'Невалидный ID лендинга'
      });
    }

    const landing = await db.getOne(
      `SELECT id, type, theme, config, status, assets, html_content
       FROM landings
       WHERE id = $1 AND user_id = $2`,
      [landingId, userId]
    );

    if (!landing) {
      return res.status(404).json({
        success: false,
        error: 'Лендинг не найден'
      });
    }

    if (landing.status === 'pending' || landing.status === 'generating') {
      return res.status(202).json({
        success: false,
        error: 'Лендинг ещё генерируется',
        status: landing.status
      });
    }

    if (landing.status === 'failed') {
      return res.status(500).json({
        success: false,
        error: 'Генерация лендинга завершилась с ошибкой'
      });
    }

    // Если есть сохранённый HTML
    if (landing.html_content) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(landing.html_content);
    }

    // Генерируем HTML на лету если нет сохранённого
    const html = generateLandingHtml(landing);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);

  } catch (error) {
    log.error('Get landing preview error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Ошибка получения preview'
    });
  }
});

/**
 * GET /api/landing/:id/download
 * Скачать ZIP архив с лендингом
 */
router.get('/:id/download', async (req, res) => {
  try {
    const landingId = parseInt(req.params.id);
    const userId = req.user.id;

    if (isNaN(landingId)) {
      return res.status(400).json({
        success: false,
        error: 'Невалидный ID лендинга'
      });
    }

    const landing = await db.getOne(
      `SELECT id, type, theme, config, status, assets, html_content
       FROM landings
       WHERE id = $1 AND user_id = $2`,
      [landingId, userId]
    );

    if (!landing) {
      return res.status(404).json({
        success: false,
        error: 'Лендинг не найден'
      });
    }

    if (landing.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Лендинг ещё не готов к скачиванию',
        status: landing.status
      });
    }

    // Настраиваем архиватор
    const archive = archiver('zip', { zlib: { level: 9 } });

    // Устанавливаем заголовки
    const filename = `landing-${landing.type}-${landingId}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Pipe архива в response
    archive.pipe(res);

    // Добавляем HTML
    const html = landing.html_content || generateLandingHtml(landing);
    archive.append(html, { name: 'index.html' });

    // Добавляем ассеты
    const assets = typeof landing.assets === 'string' ? JSON.parse(landing.assets) : (landing.assets || {});

    if (assets.images && Array.isArray(assets.images)) {
      for (const image of assets.images) {
        if (image.path && fs.existsSync(image.path)) {
          archive.file(image.path, { name: `assets/${image.filename || path.basename(image.path)}` });
        } else if (image.url && image.url.startsWith('/uploads/')) {
          // Локальный файл
          const localPath = path.join(config.storagePath, image.url.replace('/uploads/', ''));
          if (fs.existsSync(localPath)) {
            archive.file(localPath, { name: `assets/${path.basename(localPath)}` });
          }
        }
      }
    }

    // Добавляем CSS если есть
    if (assets.css) {
      archive.append(assets.css, { name: 'styles.css' });
    }

    // Добавляем JS если есть
    if (assets.js) {
      archive.append(assets.js, { name: 'script.js' });
    }

    // Добавляем README
    const readme = generateReadme(landing);
    archive.append(readme, { name: 'README.txt' });

    // Финализируем архив
    await archive.finalize();

    log.info('Landing downloaded', { landingId, userId });

  } catch (error) {
    log.error('Download landing error', { error: error.message });

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Ошибка скачивания лендинга'
      });
    }
  }
});

/**
 * GET /api/landing
 * Список всех лендингов пользователя
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0, status } = req.query;

    let query = `
      SELECT id, type, theme, status, created_at, updated_at, generation_time_ms
      FROM landings
      WHERE user_id = $1
    `;
    const params = [userId];

    if (status && VALID_LANDING_TYPES.includes(status)) {
      query += ` AND status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const landings = await db.getMany(query, params);

    // Получаем общее количество
    const countResult = await db.getOne(
      'SELECT COUNT(*) as total FROM landings WHERE user_id = $1',
      [userId]
    );

    res.json({
      success: true,
      landings: landings.map(l => ({
        ...l,
        previewUrl: `/api/landing/${l.id}/preview`,
        downloadUrl: `/api/landing/${l.id}/download`
      })),
      pagination: {
        total: parseInt(countResult.total),
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    log.error('List landings error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Ошибка получения списка лендингов'
    });
  }
});

/**
 * DELETE /api/landing/:id
 * Удалить лендинг
 */
router.delete('/:id', async (req, res) => {
  try {
    const landingId = parseInt(req.params.id);
    const userId = req.user.id;

    if (isNaN(landingId)) {
      return res.status(400).json({
        success: false,
        error: 'Невалидный ID лендинга'
      });
    }

    // Получаем лендинг для удаления файлов
    const landing = await db.getOne(
      'SELECT id, assets FROM landings WHERE id = $1 AND user_id = $2',
      [landingId, userId]
    );

    if (!landing) {
      return res.status(404).json({
        success: false,
        error: 'Лендинг не найден'
      });
    }

    // Удаляем файлы ассетов
    const assets = typeof landing.assets === 'string' ? JSON.parse(landing.assets) : (landing.assets || {});
    if (assets.images && Array.isArray(assets.images)) {
      for (const image of assets.images) {
        try {
          if (image.path && fs.existsSync(image.path)) {
            fs.unlinkSync(image.path);
          }
        } catch (err) {
          log.warn('Failed to delete asset file', { path: image.path, error: err.message });
        }
      }
    }

    // Удаляем из БД
    await db.query('DELETE FROM landings WHERE id = $1', [landingId]);

    log.info('Landing deleted', { landingId, userId });

    res.json({
      success: true,
      message: 'Лендинг удалён'
    });

  } catch (error) {
    log.error('Delete landing error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Ошибка удаления лендинга'
    });
  }
});

// ===========================================
// Вспомогательные функции
// ===========================================

/**
 * Broadcast прогресса генерации лендинга
 * Использует landingId как chatId для WebSocket
 */
function broadcastLandingProgress(landingId, data) {
  // Используем отрицательные ID для лендингов, чтобы не конфликтовать с чатами
  const wsChannelId = -landingId;
  broadcastToChat(wsChannelId, {
    ...data,
    landingId
  });
}

/**
 * Асинхронная обработка генерации лендинга
 *
 * SMART LANDING GENERATOR v3:
 * - AI понимает любой запрос (description)
 * - AI генерирует ВСЁ: ассеты, код, звуки
 * - НЕТ зависимости от архивов или шаблонов!
 */
async function processLandingGeneration({
  landingId,
  type,
  theme,
  description,
  referenceImage,
  config: landingConfig,
  userId,
  startTime
}) {
  try {
    // Обновляем статус
    await db.update('landings', landingId, { status: 'generating' });

    // Импортируем ТОЛЬКО landingGenerator - он делает ВСЁ!
    const { generateLanding } = await import('../services/landingGenerator.service.js');

    // Progress callback — транслируем в WebSocket
    const onProgress = (progress) => {
      broadcastLandingProgress(landingId, {
        type: 'landing_progress',
        ...progress
      });
    };

    // Конвертируем referenceImage в Buffer если нужно
    let imageBuffer = null;
    if (referenceImage) {
      if (typeof referenceImage === 'string' && referenceImage.includes('base64')) {
        const base64Data = referenceImage.split(',')[1] || referenceImage;
        imageBuffer = Buffer.from(base64Data, 'base64');
      } else if (Buffer.isBuffer(referenceImage)) {
        imageBuffer = referenceImage;
      }
    }

    // ВСЯ МАГИЯ В ОДНОМ ВЫЗОВЕ!
    // AI сам:
    // 1. Поймёт запрос из description
    // 2. Определит механику
    // 3. Сгенерирует все ассеты
    // 4. Напишет HTML/CSS/JS код
    // 5. Подберёт звуки
    const landingPackage = await generateLanding({
      description: description || `${type} game landing page`,
      referenceImage: imageBuffer,
      slotName: landingConfig?.slotName,
      customization: {
        theme: theme || 'casino',
        prizes: landingConfig?.prizes,
        offerUrl: landingConfig?.offerUrl,
        headline: landingConfig?.headline,
        ctaText: landingConfig?.ctaText,
        ...landingConfig
      }
    }, onProgress);

    const totalTime = Date.now() - startTime;

    // HTML уже сгенерирован в landingPackage.code.html!
    const html = landingPackage.code?.html || generateFallbackHtml(landingPackage);

    // Сохраняем результат
    await db.update('landings', landingId, {
      status: 'completed',
      type: landingPackage.mechanic || type,  // AI определил реальный тип
      html_content: html,
      assets: JSON.stringify({
        assets: landingPackage.assets,
        layers: landingPackage.layers,
        code: landingPackage.code,
        sounds: landingPackage.sounds,
        understanding: landingPackage.understanding,
        cssAnimations: landingPackage.cssAnimations,
        config: landingPackage.config
      }),
      generation_time_ms: totalTime
    });

    // Progress: Завершено
    broadcastLandingProgress(landingId, {
      type: 'landing_complete',
      status: 'completed',
      message: `Лендинг готов! Механика: ${landingPackage.mechanic}, ${landingPackage.assets?.count || 0} ассетов`,
      progress: 100,
      landingId,
      mechanicType: landingPackage.mechanic,
      theme: landingPackage.theme,
      assetsGenerated: landingPackage.assets?.count || 0,
      previewUrl: `/api/landing/${landingId}/preview`,
      downloadUrl: `/api/landing/${landingId}/download`,
      timeMs: totalTime
    });

    log.info('Landing generation complete', {
      landingId,
      mechanic: landingPackage.mechanic,
      theme: landingPackage.theme,
      assetsCount: landingPackage.assets?.count,
      timeMs: totalTime
    });

  } catch (error) {
    log.error('Process landing generation error', {
      error: error.message,
      stack: error.stack,
      landingId
    });

    // Обновляем статус на failed
    try {
      await db.update('landings', landingId, {
        status: 'failed',
        error_message: error.message
      });
    } catch (dbError) {
      log.error('Failed to update landing status', { dbError: dbError.message });
    }

    broadcastLandingProgress(landingId, {
      type: 'landing_error',
      error: error.message
    });
  }
}

/**
 * Fallback HTML если AI не сгенерировал
 */
function generateFallbackHtml(landingPackage) {
  const bgAsset = landingPackage.assets?.all?.find(a => a.type === 'background');
  const texts = landingPackage.understanding?.texts || {};

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${texts.headline || 'SPIN & WIN!'}</title>
  <style>${landingPackage.code?.css || ''}</style>
</head>
<body>
  <div class="landing">
    ${bgAsset ? `<img class="background" src="${bgAsset.url}" alt="">` : ''}
    <h1>${texts.headline || 'SPIN & WIN!'}</h1>
    <button class="cta-btn">${texts.ctaButton || 'PLAY NOW'}</button>
  </div>
  <script>${landingPackage.code?.js || ''}</script>
</body>
</html>`;
}

/**
 * Генерация HTML для лендинга
 */
function generateLandingHtml(landing) {
  const { type, theme, config: landingConfig } = landing;

  // Базовые шаблоны для разных типов
  const templates = {
    wheel: generateWheelHtml(theme, landingConfig),
    boxes: generateBoxesHtml(theme, landingConfig),
    crash: generateCrashHtml(theme, landingConfig)
  };

  return templates[type] || templates.wheel;
}

function generateWheelHtml(theme, config) {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${theme} - Колесо Фортуны</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="landing-container wheel-landing">
    <header>
      <h1>${theme}</h1>
      <p class="subtitle">Крутите колесо и выигрывайте призы!</p>
    </header>

    <main>
      <div class="wheel-container">
        <div id="wheel" class="wheel">
          <!-- Wheel segments will be generated by JS -->
        </div>
        <button id="spin-btn" class="spin-button">КРУТИТЬ</button>
      </div>

      <div id="result" class="result hidden">
        <h2>Поздравляем!</h2>
        <p id="prize-text"></p>
      </div>
    </main>

    <footer>
      <p>Условия акции применяются</p>
    </footer>
  </div>
  <script src="script.js"></script>
</body>
</html>`;
}

function generateBoxesHtml(theme, config) {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${theme} - Выбери Коробку</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="landing-container boxes-landing">
    <header>
      <h1>${theme}</h1>
      <p class="subtitle">Выберите одну из коробок и узнайте свой приз!</p>
    </header>

    <main>
      <div class="boxes-container">
        <div class="box" data-box="1">
          <div class="box-front">?</div>
          <div class="box-back hidden"></div>
        </div>
        <div class="box" data-box="2">
          <div class="box-front">?</div>
          <div class="box-back hidden"></div>
        </div>
        <div class="box" data-box="3">
          <div class="box-front">?</div>
          <div class="box-back hidden"></div>
        </div>
      </div>

      <div id="result" class="result hidden">
        <h2>Ваш приз:</h2>
        <p id="prize-text"></p>
      </div>
    </main>

    <footer>
      <p>Условия акции применяются</p>
    </footer>
  </div>
  <script src="script.js"></script>
</body>
</html>`;
}

function generateCrashHtml(theme, config) {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${theme} - Crash Game</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="landing-container crash-landing">
    <header>
      <h1>${theme}</h1>
      <p class="subtitle">Успейте забрать выигрыш до краша!</p>
    </header>

    <main>
      <div class="crash-container">
        <div id="multiplier" class="multiplier">1.00x</div>
        <div id="graph" class="crash-graph">
          <canvas id="crash-canvas"></canvas>
        </div>
        <div class="controls">
          <button id="bet-btn" class="bet-button">СТАВКА</button>
          <button id="cashout-btn" class="cashout-button" disabled>ЗАБРАТЬ</button>
        </div>
      </div>

      <div id="result" class="result hidden">
        <h2 id="result-title"></h2>
        <p id="result-text"></p>
      </div>
    </main>

    <footer>
      <p>Условия акции применяются</p>
    </footer>
  </div>
  <script src="script.js"></script>
</body>
</html>`;
}

/**
 * Генерация CSS для лендинга
 */
function generateLandingCss(type) {
  const baseStyles = `
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  min-height: 100vh;
  color: #fff;
}

.landing-container {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

header {
  text-align: center;
  padding: 30px 0;
}

header h1 {
  font-size: 2rem;
  margin-bottom: 10px;
  background: linear-gradient(45deg, #f39c12, #e74c3c);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.subtitle {
  color: #aaa;
  font-size: 1.1rem;
}

main {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.result {
  text-align: center;
  padding: 20px;
  background: rgba(255,255,255,0.1);
  border-radius: 15px;
  margin-top: 20px;
}

.result.hidden {
  display: none;
}

footer {
  text-align: center;
  padding: 20px 0;
  color: #666;
  font-size: 0.8rem;
}
`;

  const typeStyles = {
    wheel: `
.wheel-container {
  position: relative;
  width: 300px;
  height: 300px;
}

.wheel {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: conic-gradient(
    #e74c3c 0deg 45deg,
    #f39c12 45deg 90deg,
    #2ecc71 90deg 135deg,
    #3498db 135deg 180deg,
    #9b59b6 180deg 225deg,
    #1abc9c 225deg 270deg,
    #e67e22 270deg 315deg,
    #34495e 315deg 360deg
  );
  transition: transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99);
}

.spin-button {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(145deg, #f39c12, #e67e22);
  border: none;
  color: white;
  font-weight: bold;
  cursor: pointer;
  font-size: 0.9rem;
  box-shadow: 0 4px 15px rgba(0,0,0,0.3);
}

.spin-button:hover {
  transform: translate(-50%, -50%) scale(1.05);
}
`,
    boxes: `
.boxes-container {
  display: flex;
  gap: 20px;
  justify-content: center;
  flex-wrap: wrap;
}

.box {
  width: 120px;
  height: 120px;
  perspective: 1000px;
  cursor: pointer;
}

.box-front, .box-back {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 15px;
  font-size: 3rem;
  font-weight: bold;
  transition: all 0.6s;
}

.box-front {
  background: linear-gradient(145deg, #3498db, #2980b9);
  box-shadow: 0 10px 30px rgba(52, 152, 219, 0.3);
}

.box-back {
  background: linear-gradient(145deg, #2ecc71, #27ae60);
}

.box-back.hidden {
  display: none;
}

.box:hover .box-front {
  transform: scale(1.05);
}
`,
    crash: `
.crash-container {
  width: 100%;
  max-width: 400px;
  text-align: center;
}

.multiplier {
  font-size: 4rem;
  font-weight: bold;
  background: linear-gradient(45deg, #2ecc71, #27ae60);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 20px;
}

.crash-graph {
  width: 100%;
  height: 200px;
  background: rgba(0,0,0,0.3);
  border-radius: 15px;
  margin-bottom: 20px;
  overflow: hidden;
}

.crash-graph canvas {
  width: 100%;
  height: 100%;
}

.controls {
  display: flex;
  gap: 15px;
  justify-content: center;
}

.bet-button, .cashout-button {
  padding: 15px 30px;
  border: none;
  border-radius: 10px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
}

.bet-button {
  background: linear-gradient(145deg, #3498db, #2980b9);
  color: white;
}

.cashout-button {
  background: linear-gradient(145deg, #2ecc71, #27ae60);
  color: white;
}

.cashout-button:disabled {
  background: #555;
  cursor: not-allowed;
}
`
  };

  return baseStyles + (typeStyles[type] || '');
}

/**
 * Генерация JS для лендинга
 */
function generateLandingJs(type) {
  const scripts = {
    wheel: `
document.addEventListener('DOMContentLoaded', function() {
  const wheel = document.getElementById('wheel');
  const spinBtn = document.getElementById('spin-btn');
  const result = document.getElementById('result');
  const prizeText = document.getElementById('prize-text');

  const prizes = ['50% скидка', 'Бесплатная доставка', '100 бонусов', 'Подарок', 'Скидка 30%', '200 бонусов', 'VIP статус', 'Попробуй ещё'];

  let isSpinning = false;

  spinBtn.addEventListener('click', function() {
    if (isSpinning) return;
    isSpinning = true;

    result.classList.add('hidden');

    const randomDegree = Math.floor(Math.random() * 360) + 1800;
    wheel.style.transform = 'rotate(' + randomDegree + 'deg)';

    setTimeout(function() {
      const finalAngle = randomDegree % 360;
      const prizeIndex = Math.floor((360 - finalAngle) / 45) % 8;
      prizeText.textContent = prizes[prizeIndex];
      result.classList.remove('hidden');
      isSpinning = false;
    }, 4000);
  });
});
`,
    boxes: `
document.addEventListener('DOMContentLoaded', function() {
  const boxes = document.querySelectorAll('.box');
  const result = document.getElementById('result');
  const prizeText = document.getElementById('prize-text');

  const prizes = ['100 бонусов', '50% скидка', 'VIP статус'];
  let revealed = false;

  boxes.forEach(function(box, index) {
    box.addEventListener('click', function() {
      if (revealed) return;
      revealed = true;

      box.querySelector('.box-front').style.display = 'none';
      box.querySelector('.box-back').classList.remove('hidden');
      box.querySelector('.box-back').textContent = prizes[index];

      prizeText.textContent = prizes[index];
      result.classList.remove('hidden');
    });
  });
});
`,
    crash: `
document.addEventListener('DOMContentLoaded', function() {
  const multiplierEl = document.getElementById('multiplier');
  const betBtn = document.getElementById('bet-btn');
  const cashoutBtn = document.getElementById('cashout-btn');
  const result = document.getElementById('result');
  const resultTitle = document.getElementById('result-title');
  const resultText = document.getElementById('result-text');
  const canvas = document.getElementById('crash-canvas');
  const ctx = canvas.getContext('2d');

  let multiplier = 1.00;
  let isRunning = false;
  let interval;
  const crashPoint = 1 + Math.random() * 5;

  betBtn.addEventListener('click', function() {
    if (isRunning) return;
    isRunning = true;
    betBtn.disabled = true;
    cashoutBtn.disabled = false;
    result.classList.add('hidden');

    interval = setInterval(function() {
      multiplier += 0.01;
      multiplierEl.textContent = multiplier.toFixed(2) + 'x';

      if (multiplier >= crashPoint) {
        clearInterval(interval);
        multiplierEl.style.background = 'linear-gradient(45deg, #e74c3c, #c0392b)';
        multiplierEl.style.webkitBackgroundClip = 'text';
        resultTitle.textContent = 'КРАШ!';
        resultText.textContent = 'Вы не успели забрать выигрыш';
        result.classList.remove('hidden');
        resetGame();
      }
    }, 100);
  });

  cashoutBtn.addEventListener('click', function() {
    if (!isRunning) return;
    clearInterval(interval);
    resultTitle.textContent = 'ПОБЕДА!';
    resultText.textContent = 'Вы забрали ' + multiplier.toFixed(2) + 'x';
    result.classList.remove('hidden');
    resetGame();
  });

  function resetGame() {
    isRunning = false;
    betBtn.disabled = false;
    cashoutBtn.disabled = true;
    setTimeout(function() {
      multiplier = 1.00;
      multiplierEl.textContent = '1.00x';
      multiplierEl.style.background = 'linear-gradient(45deg, #2ecc71, #27ae60)';
      multiplierEl.style.webkitBackgroundClip = 'text';
    }, 2000);
  }
});
`
  };

  return scripts[type] || '';
}

/**
 * Генерация README для архива
 */
function generateReadme(landing) {
  return `
=================================
MST CREO AI - Landing Generator
=================================

Тип лендинга: ${landing.type}
Тема: ${landing.theme}
Дата создания: ${new Date(landing.created_at || Date.now()).toLocaleString('ru-RU')}

Файлы в архиве:
- index.html - главная страница
- styles.css - стили
- script.js - скрипты
- assets/ - изображения и медиа

Инструкция:
1. Распакуйте архив в папку на сервере
2. Откройте index.html в браузере
3. Настройте редирект и трекинг по необходимости

Для кастомизации отредактируйте:
- styles.css для изменения внешнего вида
- script.js для изменения логики
- index.html для изменения контента

=================================
Сгенерировано с помощью MST CREO AI
`;
}

/**
 * Получить базовый URL
 */
function getBaseUrl(req) {
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  }
  return `${req.protocol}://${req.get('host')}`;
}

export default router;
