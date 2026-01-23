import { Router } from 'express';
import { db } from '../db/client.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { log } from '../utils/logger.js';

const router = Router();

// Все routes требуют авторизации
router.use(authMiddleware);

/**
 * GET /api/chats
 * Получить список чатов пользователя
 */
router.get('/', async (req, res) => {
  try {
    const chats = await db.getMany(`
      SELECT c.id, c.title, c.created_at, c.updated_at,
             COUNT(m.id) as messages_count,
             (SELECT image_urls[1] FROM messages
              WHERE chat_id = c.id AND image_urls IS NOT NULL AND array_length(image_urls, 1) > 0
              ORDER BY created_at DESC LIMIT 1) as last_image
      FROM chats c
      LEFT JOIN messages m ON m.chat_id = c.id
      WHERE c.user_id = $1
      GROUP BY c.id
      ORDER BY c.updated_at DESC
      LIMIT 50
    `, [req.user.id]);

    res.json(chats.map(chat => ({
      id: chat.id,
      title: chat.title,
      messagesCount: parseInt(chat.messages_count) || 0,
      lastImage: chat.last_image,
      createdAt: chat.created_at,
      updatedAt: chat.updated_at
    })));

  } catch (error) {
    log.error('Get chats error', { error: error.message, userId: req.user.id });
    res.status(500).json({ error: 'Ошибка получения чатов' });
  }
});

/**
 * POST /api/chats
 * Создать новый чат
 */
router.post('/', async (req, res) => {
  try {
    const { title } = req.body;

    const chat = await db.insert('chats', {
      user_id: req.user.id,
      title: title || 'Новый чат'
    });

    log.info('Chat created', { chatId: chat.id, userId: req.user.id });

    res.status(201).json({
      id: chat.id,
      title: chat.title,
      messagesCount: 0,
      createdAt: chat.created_at,
      updatedAt: chat.updated_at
    });

  } catch (error) {
    log.error('Create chat error', { error: error.message, userId: req.user.id });
    res.status(500).json({ error: 'Ошибка создания чата' });
  }
});

/**
 * GET /api/chats/:id
 * Получить чат со всеми сообщениями
 */
router.get('/:id', async (req, res) => {
  try {
    const chatId = parseInt(req.params.id);

    // Проверяем что чат принадлежит пользователю
    const chat = await db.getOne(
      'SELECT id, title, created_at, updated_at FROM chats WHERE id = $1 AND user_id = $2',
      [chatId, req.user.id]
    );

    if (!chat) {
      return res.status(404).json({ error: 'Чат не найден' });
    }

    // Получаем сообщения (reference_urls - множественные референсы)
    const messages = await db.getMany(`
      SELECT id, role, content, image_urls, reference_urls,
             model_used, generation_time_ms, enhanced_prompt, error_message,
             created_at
      FROM messages
      WHERE chat_id = $1
      ORDER BY created_at ASC
    `, [chatId]);

    res.json({
      id: chat.id,
      title: chat.title,
      createdAt: chat.created_at,
      updatedAt: chat.updated_at,
      messages: messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        imageUrls: msg.role === 'user' ? (msg.reference_urls || []) : (msg.image_urls || []),
        referenceUrls: msg.reference_urls || [],  // Множественные референсы
        modelUsed: msg.model_used,
        generationTimeMs: msg.generation_time_ms,
        enhancedPrompt: msg.enhanced_prompt,
        errorMessage: msg.error_message,
        createdAt: msg.created_at
      }))
    });

  } catch (error) {
    log.error('Get chat error', { error: error.message, chatId: req.params.id });
    res.status(500).json({ error: 'Ошибка получения чата' });
  }
});

/**
 * PATCH /api/chats/:id
 * Переименовать чат
 */
router.patch('/:id', async (req, res) => {
  try {
    const chatId = parseInt(req.params.id);
    const { title } = req.body;

    if (!title || title.trim().length === 0) {
      return res.status(400).json({ error: 'Название не может быть пустым' });
    }

    // Проверяем владельца
    const existing = await db.getOne(
      'SELECT id FROM chats WHERE id = $1 AND user_id = $2',
      [chatId, req.user.id]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Чат не найден' });
    }

    const chat = await db.update('chats', chatId, {
      title: title.trim().substring(0, 255),
      updated_at: new Date()
    });

    res.json({
      id: chat.id,
      title: chat.title,
      updatedAt: chat.updated_at
    });

  } catch (error) {
    log.error('Update chat error', { error: error.message, chatId: req.params.id });
    res.status(500).json({ error: 'Ошибка обновления чата' });
  }
});

/**
 * DELETE /api/chats/:id
 * Удалить чат со всеми сообщениями
 */
router.delete('/:id', async (req, res) => {
  try {
    const chatId = parseInt(req.params.id);

    // Проверяем владельца
    const existing = await db.getOne(
      'SELECT id FROM chats WHERE id = $1 AND user_id = $2',
      [chatId, req.user.id]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Чат не найден' });
    }

    // Удаляем чат (сообщения удалятся каскадно)
    await db.query('DELETE FROM chats WHERE id = $1', [chatId]);

    log.info('Chat deleted', { chatId, userId: req.user.id });

    res.json({ success: true, message: 'Чат удалён' });

  } catch (error) {
    log.error('Delete chat error', { error: error.message, chatId: req.params.id });
    res.status(500).json({ error: 'Ошибка удаления чата' });
  }
});

export default router;
