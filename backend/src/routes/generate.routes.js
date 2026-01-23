import { Router } from 'express';
import { db } from '../db/client.js';
import { authMiddleware, checkGenerationLimit, incrementGenerationStats } from '../middleware/auth.middleware.js';
import { uploadMiddleware, handleUploadError, getFileUrl } from '../middleware/upload.middleware.js';
import { sendMessageStream, deleteChat, checkHealth } from '../services/gemini.service.js';
import { broadcastToChat } from '../websocket/handler.js';
import { log } from '../utils/logger.js';
import fs from 'fs';

const router = Router();

// Все routes требуют авторизации
router.use(authMiddleware);

/**
 * POST /api/generate
 * Главный endpoint — отправить сообщение в Gemini
 */
router.post('/',
  uploadMiddleware.array('references', 14),  // До 14 референсов
  handleUploadError,
  checkGenerationLimit,
  async (req, res) => {
    const startTime = Date.now();
    let chatId = null;

    try {
      const { prompt, chat_id } = req.body;
      let settings = req.body.settings;

      // Парсим settings если строка
      if (typeof settings === 'string') {
        try {
          settings = JSON.parse(settings);
        } catch (e) {
          settings = {};
        }
      }
      settings = settings || {};

      const userId = req.user.id;

      // Валидация
      if (!prompt || prompt.trim().length === 0) {
        return res.status(400).json({ error: 'Введите описание' });
      }

      // Создаём или получаем чат
      chatId = chat_id ? parseInt(chat_id) : null;

      if (!chatId) {
        // Создаём новый чат
        const chat = await db.insert('chats', {
          user_id: userId,
          title: prompt.substring(0, 50) || 'Новый чат'
        });
        chatId = chat.id;
      } else {
        // Проверяем что чат принадлежит пользователю
        const chat = await db.getOne(
          'SELECT id FROM chats WHERE id = $1 AND user_id = $2',
          [chatId, userId]
        );
        if (!chat) {
          return res.status(404).json({ error: 'Чат не найден' });
        }
      }

      // Сохраняем сообщение пользователя
      const userMessageData = {
        chat_id: chatId,
        role: 'user',
        content: prompt
      };

      // Подготавливаем картинки для Gemini (до 14 референсов)
      const images = [];

      // Загруженные файлы (множественные)
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          const base64 = fs.readFileSync(file.path).toString('base64');
          images.push({
            data: base64,
            mimeType: file.mimetype
          });
        }
        // Сохраняем URLs всех референсов
        userMessageData.reference_urls = req.files.map(f => getFileUrl(f.filename, req));
      }

      const userMessage = await db.insert('messages', userMessageData);

      // Отправляем начальный ответ клиенту
      res.json({
        success: true,
        chatId,
        userMessageId: userMessage.id,
        status: 'processing'
      });

      // Фаза 1: Анализ запроса
      broadcastToChat(chatId, {
        type: 'generation_progress',
        status: 'analyzing',
        message: 'Анализирую запрос...'
      });

      // Вызываем Gemini асинхронно
      processGeneration({
        chatId,
        prompt,
        images,
        settings,
        userId,
        startTime
      }).catch(error => {
        log.error('Background generation failed', { error: error.message, chatId });
        broadcastToChat(chatId, {
          type: 'generation_error',
          error: error.message || 'Ошибка генерации'
        });
      });

    } catch (error) {
      log.error('Generate endpoint error', { error: error.message });

      if (chatId) {
        broadcastToChat(chatId, {
          type: 'generation_error',
          error: error.message
        });
      }

      if (!res.headersSent) {
        res.status(500).json({ error: 'Ошибка генерации' });
      }
    }
  }
);

/**
 * Асинхронная обработка генерации со streaming, фазами и tool_use индикаторами
 */
async function processGeneration({ chatId, prompt, images, settings, userId, startTime }) {
  try {
    // Tool use: Если есть референсы — показываем "Понимание изображения"
    if (images.length > 0) {
      broadcastToChat(chatId, {
        type: 'tool_use',
        tool: 'image_understanding',
        label: 'Понимание изображения',
        status: 'running'
      });
    }

    // Tool use: Анализ запроса
    broadcastToChat(chatId, {
      type: 'tool_use',
      tool: 'analysis',
      label: 'Анализ запроса',
      status: 'running'
    });

    // Deep research mode
    if (settings.deepResearch) {
      broadcastToChat(chatId, {
        type: 'tool_use',
        tool: 'deep_research',
        label: 'Глубокое исследование',
        status: 'running'
      });
    }

    // Фаза 2: Генерация со streaming
    broadcastToChat(chatId, {
      type: 'generation_progress',
      status: 'generating',
      message: 'Генерирую ответ...',
      progress: 20
    });

    let hasAskedQuestions = false;
    let imageCount = 0;
    const expectedImages = settings.variants || 3;

    // Вызываем Gemini со streaming
    const result = await sendMessageStream(chatId, prompt, images, settings, (progress) => {
      // Отправляем прогресс в реальном времени
      if (progress.status === 'generating_text') {
        // Проверяем задаёт ли AI вопросы
        if (!hasAskedQuestions && progress.text && (progress.text.includes('?') || progress.text.includes('уточн'))) {
          hasAskedQuestions = true;
          broadcastToChat(chatId, {
            type: 'tool_use',
            tool: 'clarification',
            label: 'Clarification',
            status: 'running'
          });
        }

        broadcastToChat(chatId, {
          type: 'generation_progress',
          status: 'generating',
          message: 'Генерирую ответ...',
          partialText: progress.text,
          progress: 20 + Math.min(progress.text.length / 20, 20)  // 20-40%
        });
      } else if (progress.status === 'generating_image') {
        imageCount++;
        const imageProgress = 40 + (imageCount / expectedImages) * 50;  // 40-90%

        // Tool use: Генерация изображений
        broadcastToChat(chatId, {
          type: 'tool_use',
          tool: 'image_generation',
          label: `Генерация изображений (${imageCount}/${expectedImages})`,
          status: 'running'
        });

        broadcastToChat(chatId, {
          type: 'generation_progress',
          status: 'generating_image',
          message: `Создаю изображение ${imageCount}/${expectedImages}...`,
          imagesCount: imageCount,
          newImage: progress.newImage,
          progress: Math.round(imageProgress)
        });
      }
    });

    const totalTime = Date.now() - startTime;

    // Сохраняем ответ AI
    const assistantMessage = await db.insert('messages', {
      chat_id: chatId,
      role: 'assistant',
      content: result.text,
      image_urls: result.images.map(img => img.url),
      generation_time_ms: totalTime,
      model_used: 'gemini-3-pro-image-preview'
    });

    // Обновляем статистику
    await incrementGenerationStats(userId, totalTime);

    // Завершаем все tool_use
    broadcastToChat(chatId, {
      type: 'tool_use_complete',
      tools: ['image_understanding', 'analysis', 'clarification', 'image_generation', 'deep_research']
    });

    // Фаза 3: Готово!
    broadcastToChat(chatId, {
      type: 'generation_complete',
      messageId: assistantMessage.id,
      content: result.text,
      images: result.images,
      timeMs: totalTime,
      progress: 100
    });

    log.info('Generation complete', {
      chatId,
      messageId: assistantMessage.id,
      imagesCount: result.images.length,
      timeMs: totalTime
    });

  } catch (error) {
    log.error('Process generation error', { error: error.message, chatId });

    // Сохраняем ошибку как сообщение
    await db.insert('messages', {
      chat_id: chatId,
      role: 'assistant',
      content: null,
      error_message: error.message
    });

    broadcastToChat(chatId, {
      type: 'generation_error',
      error: error.message
    });
  }
}

/**
 * POST /api/generate/upload
 * Загрузка референса (опционально, можно использовать главный endpoint)
 */
router.post('/upload',
  uploadMiddleware.single('file'),
  handleUploadError,
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Файл не загружен' });
      }

      const url = getFileUrl(req.file.filename, req);

      log.info('Reference uploaded', {
        userId: req.user.id,
        filename: req.file.filename,
        size: req.file.size
      });

      res.json({
        success: true,
        url,
        filename: req.file.filename,
        size: req.file.size
      });

    } catch (error) {
      log.error('Upload error', { error: error.message });
      res.status(500).json({ error: 'Ошибка загрузки файла' });
    }
  }
);

/**
 * DELETE /api/generate/chat/:id
 * Удалить чат и освободить сессию Gemini
 */
router.delete('/chat/:id', async (req, res) => {
  try {
    const chatId = parseInt(req.params.id);

    // Удаляем сессию Gemini
    deleteChat(chatId);

    // Удаляем из БД
    await db.query('DELETE FROM messages WHERE chat_id = $1', [chatId]);
    await db.query('DELETE FROM chats WHERE id = $1 AND user_id = $2', [chatId, req.user.id]);

    res.json({ success: true });
  } catch (error) {
    log.error('Delete chat error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/generate/health
 * Health check для Gemini
 */
router.get('/health', async (req, res) => {
  try {
    const health = await checkHealth();
    res.json(health);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
