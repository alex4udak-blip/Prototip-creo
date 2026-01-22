import { Router } from 'express';
import { db } from '../db/client.js';
import { authMiddleware, checkGenerationLimit, incrementGenerationStats } from '../middleware/auth.middleware.js';
import { uploadMiddleware, handleUploadError, getFileUrl } from '../middleware/upload.middleware.js';
import { checkNeedsClarification, processUserAnswers, enhancePrompt, generateChatTitle } from '../services/prompt.service.js';
import { selectModel, generateImage, parseSize, getAvailableModels } from '../services/router.service.js';
import { broadcastToChat } from '../websocket/handler.js';
import { log } from '../utils/logger.js';

const router = Router();

// Все routes требуют авторизации
router.use(authMiddleware);

/**
 * POST /api/generate/clarify
 * Проверка нужны ли уточняющие вопросы
 */
router.post('/clarify', async (req, res) => {
  try {
    const { prompt, reference_url, chat_id } = req.body;

    if (!prompt || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'Введите описание баннера' });
    }

    // Получаем историю чата если есть
    let chatHistory = [];
    if (chat_id) {
      const messages = await db.getMany(
        'SELECT role, content FROM messages WHERE chat_id = $1 ORDER BY created_at DESC LIMIT 10',
        [parseInt(chat_id)]
      );
      chatHistory = messages.reverse();
    }

    // Проверяем нужны ли вопросы
    const clarificationResult = await checkNeedsClarification(prompt, {
      hasReference: !!reference_url,
      chatHistory
    });

    res.json(clarificationResult);

  } catch (error) {
    log.error('Clarification check error', { error: error.message });
    res.status(500).json({ error: 'Ошибка анализа запроса' });
  }
});

/**
 * POST /api/generate
 * Главный endpoint генерации баннера
 */
router.post('/', checkGenerationLimit, async (req, res) => {
  const startTime = Date.now();
  let messageId = null;
  let chatId = null;

  try {
    const {
      chat_id,
      prompt,
      reference_url,
      size,
      model: userModel,
      variations = 1,
      answers = null,  // Ответы на уточняющие вопросы
      skip_clarification = false  // Пропустить этап вопросов
    } = req.body;

    // Валидация
    if (!prompt || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'Введите описание баннера' });
    }

    chatId = parseInt(chat_id) || null;

    // Проверяем или создаём чат
    let chat;
    if (chatId) {
      chat = await db.getOne(
        'SELECT id, title FROM chats WHERE id = $1 AND user_id = $2',
        [chatId, req.user.id]
      );
      if (!chat) {
        return res.status(404).json({ error: 'Чат не найден' });
      }
    } else {
      // Создаём новый чат
      chat = await db.insert('chats', {
        user_id: req.user.id,
        title: 'Новый чат'
      });
      chatId = chat.id;
    }

    // Получаем историю чата для контекста
    let chatHistory = [];
    const existingMessages = await db.getMany(
      'SELECT role, content FROM messages WHERE chat_id = $1 ORDER BY created_at DESC LIMIT 10',
      [chatId]
    );
    chatHistory = existingMessages.reverse();

    // ЭТАП 1: Проверяем нужны ли уточняющие вопросы (если нет ответов и не пропускаем)
    if (!answers && !skip_clarification) {
      const clarificationResult = await checkNeedsClarification(prompt, {
        hasReference: !!reference_url,
        chatHistory
      });

      if (clarificationResult.needs_clarification) {
        // Сохраняем сообщение пользователя
        const userMessage = await db.insert('messages', {
          chat_id: chatId,
          role: 'user',
          content: prompt,
          reference_url: reference_url || null
        });

        // Сохраняем вопросы как сообщение ассистента
        const assistantMessage = await db.insert('messages', {
          chat_id: chatId,
          role: 'assistant',
          content: clarificationResult.summary || 'Уточняющие вопросы',
          metadata: JSON.stringify({
            type: 'clarification',
            questions: clarificationResult.questions,
            originalPrompt: prompt
          })
        });

        // Возвращаем вопросы клиенту
        return res.json({
          success: true,
          chatId,
          userMessageId: userMessage.id,
          messageId: assistantMessage.id,
          status: 'needs_clarification',
          clarification: {
            summary: clarificationResult.summary,
            questions: clarificationResult.questions
          }
        });
      }
    }

    // ЭТАП 2: Генерация (либо ответы получены, либо вопросы не нужны)

    // Сохраняем сообщение пользователя (если это ответ на вопросы — добавляем контекст)
    let userContent = prompt;
    if (answers) {
      const answerText = Object.entries(answers)
        .map(([q, a]) => `${q}: ${a}`)
        .join(', ');
      userContent = `${prompt}\n[Уточнения: ${answerText}]`;
    }

    const userMessage = await db.insert('messages', {
      chat_id: chatId,
      role: 'user',
      content: userContent,
      reference_url: reference_url || null
    });

    // Создаём placeholder для ответа AI
    const assistantMessage = await db.insert('messages', {
      chat_id: chatId,
      role: 'assistant',
      content: 'Генерирую...'
    });
    messageId = assistantMessage.id;

    // Отправляем начальный ответ клиенту
    res.json({
      success: true,
      chatId,
      messageId,
      userMessageId: userMessage.id,
      status: 'processing'
    });

    // Продолжаем генерацию асинхронно
    processGeneration({
      chatId,
      messageId,
      prompt,
      answers,
      referenceUrl: reference_url,
      size,
      userModel,
      variations,
      userId: req.user.id,
      startTime,
      chatTitle: chat.title
    }).catch(error => {
      log.error('Background generation failed', { error: error.message, messageId });
    });

  } catch (error) {
    log.error('Generate endpoint error', { error: error.message });

    // Обновляем сообщение с ошибкой если оно было создано
    if (messageId) {
      await db.update('messages', messageId, {
        content: null,
        error_message: 'Ошибка генерации: ' + error.message
      });

      broadcastToChat(chatId, {
        type: 'generation_error',
        messageId,
        error: error.message
      });
    }

    if (!res.headersSent) {
      res.status(500).json({ error: 'Ошибка генерации' });
    }
  }
});

/**
 * Асинхронная обработка генерации
 */
async function processGeneration(params) {
  const {
    chatId,
    messageId,
    prompt,
    answers,
    referenceUrl,
    size,
    userModel,
    variations,
    userId,
    startTime,
    chatTitle
  } = params;

  try {
    // 1. Уведомляем о начале
    broadcastToChat(chatId, {
      type: 'generation_progress',
      messageId,
      status: 'enhancing_prompt',
      message: 'Анализирую запрос...'
    });

    // 2. Улучшаем промпт через Claude (с учётом ответов если есть)
    let promptAnalysis;
    if (answers && Object.keys(answers).length > 0) {
      promptAnalysis = await processUserAnswers(prompt, answers, {
        hasReference: !!referenceUrl,
        size
      });
    } else {
      promptAnalysis = await enhancePrompt(prompt, {
        hasReference: !!referenceUrl,
        size
      });
    }

    // 3. Выбираем модель
    const selectedModel = selectModel(promptAnalysis, {
      hasReference: !!referenceUrl,
      userPreference: userModel
    });

    broadcastToChat(chatId, {
      type: 'generation_progress',
      messageId,
      status: 'generating_image',
      message: `Генерирую изображение (${selectedModel})...`,
      model: selectedModel
    });

    // 4. Парсим размер
    const presets = await db.getMany('SELECT name, width, height FROM size_presets');
    const { width, height } = parseSize(size, presets);

    // 5. Генерируем изображение
    const result = await generateImage(promptAnalysis.enhanced_prompt, {
      model: selectedModel,
      negativePrompt: promptAnalysis.negative_prompt,
      width,
      height,
      numImages: Math.min(variations, 4),
      referenceUrl,
      textContent: promptAnalysis.text_content,
      textStyle: promptAnalysis.text_style
    });

    const totalTime = Date.now() - startTime;

    // 6. Обновляем сообщение с результатом
    await db.update('messages', messageId, {
      content: promptAnalysis.reasoning || 'Готово!',
      image_urls: result.images,
      model_used: selectedModel,
      generation_time_ms: totalTime,
      enhanced_prompt: promptAnalysis.enhanced_prompt
    });

    // 7. Обновляем название чата если это первое сообщение
    if (chatTitle === 'Новый чат') {
      const newTitle = await generateChatTitle(prompt);
      await db.update('chats', chatId, { title: newTitle });
    }

    // 8. Обновляем статистику
    await incrementGenerationStats(userId, totalTime);

    // 9. Уведомляем о завершении
    broadcastToChat(chatId, {
      type: 'generation_complete',
      messageId,
      images: result.images,
      model: selectedModel,
      timeMs: totalTime,
      enhancedPrompt: promptAnalysis.enhanced_prompt
    });

    log.generation(userId, selectedModel, totalTime, {
      chatId,
      messageId,
      imagesCount: result.images.length
    });

  } catch (error) {
    log.error('Process generation error', {
      error: error.message,
      messageId,
      chatId
    });

    // Обновляем сообщение с ошибкой
    await db.update('messages', messageId, {
      content: null,
      error_message: error.message
    });

    broadcastToChat(chatId, {
      type: 'generation_error',
      messageId,
      error: error.message
    });
  }
}

/**
 * POST /api/generate/upload
 * Загрузка референса
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
 * GET /api/generate/models
 * Получить список доступных моделей
 */
router.get('/models', (req, res) => {
  const models = getAvailableModels();
  res.json(models);
});

/**
 * GET /api/generate/presets
 * Получить пресеты размеров
 */
router.get('/presets', async (req, res) => {
  try {
    const presets = await db.getMany(
      'SELECT id, name, width, height, category FROM size_presets WHERE is_active = true ORDER BY category, name'
    );

    // Группируем по категориям
    const grouped = presets.reduce((acc, preset) => {
      if (!acc[preset.category]) {
        acc[preset.category] = [];
      }
      acc[preset.category].push({
        id: preset.id,
        name: preset.name,
        width: preset.width,
        height: preset.height,
        label: `${preset.name} (${preset.width}×${preset.height})`
      });
      return acc;
    }, {});

    res.json(grouped);

  } catch (error) {
    log.error('Get presets error', { error: error.message });
    res.status(500).json({ error: 'Ошибка получения пресетов' });
  }
});

export default router;
