import { Router } from 'express';
import path from 'path';
import { db } from '../db/client.js';
import { config } from '../config/env.js';
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
 * УПРОЩЁННАЯ версия — без mode/settings костылей
 */
router.post('/',
  uploadMiddleware.array('references', 14),
  handleUploadError,
  checkGenerationLimit,
  async (req, res) => {
    const startTime = Date.now();
    let chatId = null;

    try {
      const { prompt, chat_id } = req.body;
      const userId = req.user.id;

      // Валидация
      if (!prompt || prompt.trim().length === 0) {
        return res.status(400).json({ error: 'Введите описание' });
      }

      // Создаём или получаем чат
      chatId = chat_id ? parseInt(chat_id) : null;

      if (!chatId) {
        const chat = await db.insert('chats', {
          user_id: userId,
          title: prompt.substring(0, 50) || 'Новый чат'
        });
        chatId = chat.id;
      } else {
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

      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          const base64 = fs.readFileSync(file.path).toString('base64');
          images.push({
            data: base64,
            mimeType: file.mimetype
          });
        }
        userMessageData.reference_urls = req.files.map(f => getFileUrl(f.filename, req));
      }

      // Загружаем референсы из предыдущих сообщений если нужно
      if (images.length === 0 && chatId && chat_id) {
        const lastUserMsgWithRef = await db.getOne(`
          SELECT reference_urls FROM messages
          WHERE chat_id = $1 AND role = 'user' AND reference_urls IS NOT NULL AND array_length(reference_urls, 1) > 0
          ORDER BY created_at DESC LIMIT 1
        `, [chatId]);

        if (lastUserMsgWithRef?.reference_urls?.length > 0) {
          log.info('Loading references from previous message', {
            chatId,
            count: lastUserMsgWithRef.reference_urls.length
          });

          for (const refUrl of lastUserMsgWithRef.reference_urls.slice(0, 4)) {
            try {
              const filename = refUrl.includes('/uploads/')
                ? refUrl.split('/uploads/').pop()
                : refUrl;
              const filepath = path.join(config.storagePath, filename);

              if (fs.existsSync(filepath)) {
                const base64 = fs.readFileSync(filepath).toString('base64');
                const mimeType = filename.endsWith('.jpg') ? 'image/jpeg' : 'image/png';
                images.push({ data: base64, mimeType });
              }
            } catch (err) {
              log.warn('Failed to load reference', { refUrl, error: err.message });
            }
          }
        }
      }

      const userMessage = await db.insert('messages', userMessageData);

      // Отправляем начальный ответ клиенту
      res.json({
        success: true,
        chatId,
        userMessageId: userMessage.id,
        status: 'processing'
      });

      // Даём фронтенду время подписаться на WebSocket
      await new Promise(resolve => setTimeout(resolve, 300));

      // Запускаем генерацию
      broadcastToChat(chatId, {
        type: 'generation_progress',
        status: 'analyzing',
        message: 'Анализирую запрос...'
      });

      processGeneration({
        chatId,
        prompt,
        images,
        userId,
        startTime,
        referenceUrls: userMessageData.reference_urls || []
      }).catch(error => {
        log.error('Generation failed', { error: error.message, chatId });
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
 * Асинхронная обработка генерации — УПРОЩЁННАЯ
 */
async function processGeneration({ chatId, prompt, images, userId, startTime, referenceUrls }) {
  try {
    // Tool use indicators
    if (images.length > 0) {
      broadcastToChat(chatId, {
        type: 'tool_use',
        tool: 'image_understanding',
        label: 'Понимание изображения',
        status: 'running',
        referenceUrls
      });
    }

    broadcastToChat(chatId, {
      type: 'tool_use',
      tool: 'thinking',
      label: 'Думаю...',
      status: 'running'
    });

    broadcastToChat(chatId, {
      type: 'generation_progress',
      status: 'generating',
      message: 'Генерирую ответ...',
      progress: 20
    });

    let imageCount = 0;

    // Вызываем Gemini с ожиданием 3 изображений
    // width/height — для Runware fallback (Gemini сам определяет размер)
    const result = await sendMessageStream(chatId, prompt, images, {
      expectedImages: 3,
      width: 1024,   // Дефолтный размер для Runware fallback
      height: 1024
    }, (progress) => {
      if (progress.status === 'generating_more') {
        broadcastToChat(chatId, {
          type: 'generation_progress',
          status: 'generating',
          message: progress.message,
          imagesCount: progress.imagesCount,
          progress: 60
        });
      } else if (progress.status === 'generating_text') {
        broadcastToChat(chatId, {
          type: 'generation_progress',
          status: 'generating',
          message: 'Генерирую ответ...',
          partialText: progress.text,
          progress: 20 + Math.min(progress.text.length / 20, 20)
        });
      } else if (progress.status === 'generating_image') {
        imageCount++;

        broadcastToChat(chatId, {
          type: 'tool_use',
          tool: `image_generation_${imageCount}`,
          label: `Изображение ${imageCount}`,
          status: 'running'
        });

        broadcastToChat(chatId, {
          type: 'generation_progress',
          status: 'generating_image',
          message: `Создаю изображение ${imageCount}...`,
          imagesCount: imageCount,
          newImage: progress.newImage,
          progress: 40 + (imageCount * 15)
        });
      }
    });

    const totalTime = Date.now() - startTime;

    // Сохраняем ответ
    const assistantMessage = await db.insert('messages', {
      chat_id: chatId,
      role: 'assistant',
      content: result.text,
      image_urls: result.images.map(img => img.url),
      generation_time_ms: totalTime,
      model_used: 'gemini-3-pro-image-preview'
    });

    await incrementGenerationStats(userId, totalTime);

    // Завершаем tool_use
    const allTools = ['image_understanding', 'thinking'];
    for (let i = 1; i <= imageCount; i++) {
      allTools.push(`image_generation_${i}`);
    }
    broadcastToChat(chatId, {
      type: 'tool_use_complete',
      tools: allTools
    });

    // Готово
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
    log.error('Process generation error', {
      error: error.message,
      chatId
    });

    try {
      await db.insert('messages', {
        chat_id: chatId,
        role: 'assistant',
        content: null,
        error_message: error.message
      });
    } catch (dbError) {
      log.error('Failed to save error message', { dbError: dbError.message });
    }

    broadcastToChat(chatId, {
      type: 'generation_error',
      error: error.message
    });
  }
}

/**
 * POST /api/generate/upload
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
        filename: req.file.filename
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
 */
router.delete('/chat/:id', async (req, res) => {
  try {
    const chatId = parseInt(req.params.id);
    deleteChat(chatId);
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
