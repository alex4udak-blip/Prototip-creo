import { Router } from 'express';
import { db } from '../db/client.js';
import { authMiddleware, checkGenerationLimit, incrementGenerationStats } from '../middleware/auth.middleware.js';
import { uploadMiddleware, handleUploadError, getFileUrl } from '../middleware/upload.middleware.js';
import {
  checkNeedsClarification,
  processUserAnswers,
  enhancePrompt,
  generateChatTitle,
  analyzeWithDeepThinking,
  quickGenerate
} from '../services/prompt.service.js';
import { selectModel, generateImage, parseSize, getAvailableModels } from '../services/router.service.js';
import { broadcastToChat } from '../websocket/handler.js';
import { log } from '../utils/logger.js';

const router = Router();

// Все routes требуют авторизации
router.use(authMiddleware);

/**
 * POST /api/generate/clarify
 * Проверка нужны ли уточняющие вопросы - УЛУЧШЕННАЯ
 * Теперь учитывает контекст, историю и тип контента
 */
router.post('/clarify', async (req, res) => {
  try {
    const { prompt, reference_url, chat_id, force_questions = false } = req.body;

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

    // Проверяем нужны ли вопросы (умный анализ) + Vision для референса
    const clarificationResult = await checkNeedsClarification(prompt, {
      hasReference: !!reference_url,
      referenceUrl: reference_url,  // Передаём URL для Vision анализа
      chatHistory,
      forceQuestions: force_questions
    });

    // Добавляем информацию о детектированном контексте и Vision анализе
    res.json({
      ...clarificationResult,
      prompt_analysis: {
        detected_context: clarificationResult.detected_context,
        known_info: clarificationResult.known_info,
        thinking: clarificationResult.thinking,
        vision_analysis: clarificationResult.vision_analysis  // Vision результат
      }
    });

  } catch (error) {
    log.error('Clarification check error', { error: error.message });
    res.status(500).json({ error: 'Ошибка анализа запроса' });
  }
});

/**
 * POST /api/generate
 * Главный endpoint генерации баннера - УЛУЧШЕННЫЙ
 * Поддерживает Deep Thinking режим и умные вопросы
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
      answers = null,           // Ответы на уточняющие вопросы
      skip_clarification = false,  // Пропустить этап вопросов
      deep_thinking = false,    // Включить режим глубокого анализа
      quick_generate = false,   // Быстрая генерация без вопросов
      vision_analysis = null    // Явно переданный visionAnalysis с фронтенда
    } = req.body;

    // Валидация
    if (!prompt || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'Введите описание баннера' });
    }

    chatId = parseInt(chat_id) || null;

    // DEBUG: Логируем ВСЕ входящие параметры
    log.info('Generate request received', {
      hasPrompt: !!prompt,
      hasReference: !!reference_url,
      hasAnswers: !!answers,
      skip_clarification,
      quick_generate,
      deep_thinking,
      mode: req.body.mode,  // На случай если mode передаётся
      bodyKeys: Object.keys(req.body)
    });

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
      'SELECT role, content, reference_url, metadata, image_urls FROM messages WHERE chat_id = $1 ORDER BY created_at DESC LIMIT 10',
      [chatId]
    );
    chatHistory = existingMessages.reverse();

    // FOLLOW-UP CONTEXT: Ищем референс и visionAnalysis из предыдущих сообщений
    let inheritedReferenceUrl = reference_url;
    // Приоритет: явно переданный vision_analysis > унаследованный из чата
    let inheritedVisionAnalysis = vision_analysis || null;

    if (vision_analysis) {
      log.info('Using explicitly passed visionAnalysis from frontend', {
        contentType: vision_analysis?.content_type,
        hasRecreationPrompt: !!vision_analysis?.recreation_prompt
      });
    }

    if (!reference_url && chatId && chatHistory.length > 0) {
      // Ищем последнее сообщение пользователя с референсом
      for (const msg of [...chatHistory].reverse()) {
        if (msg.reference_url) {
          inheritedReferenceUrl = msg.reference_url;
          log.info('Inherited reference from previous message', { referenceUrl: inheritedReferenceUrl });
          break;
        }
      }

      // Ищем последний visionAnalysis из clarification сообщений
      for (const msg of [...chatHistory].reverse()) {
        if (msg.metadata) {
          try {
            const meta = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata;
            if (meta.vision_analysis) {
              inheritedVisionAnalysis = meta.vision_analysis;
              log.info('Inherited visionAnalysis from previous clarification', {
                contentType: inheritedVisionAnalysis?.content_type
              });
              break;
            }
          } catch (e) { /* ignore parse errors */ }
        }
      }

      // Также ищем последнее сгенерированное изображение для использования как референс
      if (!inheritedReferenceUrl) {
        for (const msg of [...chatHistory].reverse()) {
          if (msg.image_urls && msg.image_urls.length > 0) {
            inheritedReferenceUrl = msg.image_urls[0];
            log.info('Using previous generated image as reference', { referenceUrl: inheritedReferenceUrl });
            break;
          }
        }
      }
    }

    // РЕЖИМ: Быстрая генерация (без вопросов)
    if (quick_generate) {
      return handleQuickGenerate(req, res, {
        chatId,
        chat,
        prompt,
        referenceUrl: inheritedReferenceUrl,  // Используем унаследованный референс!
        visionAnalysis: inheritedVisionAnalysis,
        size,
        userModel,
        variations,
        userId: req.user.id,
        startTime,
        deepThinking: deep_thinking,
        chatHistory
      });
    }

    // ЭТАП 1: Проверяем нужны ли уточняющие вопросы (если нет ответов и не пропускаем)
    if (!answers && !skip_clarification) {
      log.info('Checking clarification', {
        hasReference: !!inheritedReferenceUrl,
        referenceUrl: inheritedReferenceUrl?.substring(0, 50),
        promptLength: prompt.length,
        isInherited: inheritedReferenceUrl !== reference_url
      });

      const clarificationResult = await checkNeedsClarification(prompt, {
        hasReference: !!inheritedReferenceUrl,
        referenceUrl: inheritedReferenceUrl,  // Используем унаследованный референс!
        visionAnalysis: inheritedVisionAnalysis,  // И унаследованный Vision анализ
        chatHistory
      });

      log.info('Clarification result', {
        needsClarification: clarificationResult.needs_clarification,
        questionsCount: clarificationResult.questions?.length || 0,
        hasVisionAnalysis: !!clarificationResult.vision_analysis,
        summary: clarificationResult.summary?.substring(0, 50)
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
            originalPrompt: prompt,
            detectedContext: clarificationResult.detected_context,
            thinking: clarificationResult.thinking,
            vision_analysis: clarificationResult.vision_analysis
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
            questions: clarificationResult.questions,
            detected_context: clarificationResult.detected_context,
            thinking: clarificationResult.thinking,
            known_info: clarificationResult.known_info
          }
        });
      }
    }

    // ЭТАП 2: Генерация (либо ответы получены, либо вопросы не нужны)

    let userMessageId = null;

    if (answers) {
      // Ответ на clarification — создаём компактное сообщение с выборами
      const answersText = Object.entries(answers)
        .filter(([key, val]) => val && val !== 'skip')
        .map(([key, val]) => Array.isArray(val) ? val.join(', ') : val)
        .join(', ');

      const userMessage = await db.insert('messages', {
        chat_id: chatId,
        role: 'user',
        content: answersText || 'Сгенерировать',
        metadata: JSON.stringify({ type: 'clarification_answer', answers })
      });
      userMessageId = userMessage.id;
    } else {
      // Новый запрос — сохраняем полное сообщение пользователя (с унаследованным референсом если есть)
      const userMessage = await db.insert('messages', {
        chat_id: chatId,
        role: 'user',
        content: prompt,
        reference_url: inheritedReferenceUrl || null  // Сохраняем унаследованный референс
      });
      userMessageId = userMessage.id;
    }

    // Создаём placeholder для ответа AI
    const assistantMessage = await db.insert('messages', {
      chat_id: chatId,
      role: 'assistant',
      content: deep_thinking ? 'Глубокий анализ...' : 'Генерирую...'
    });
    messageId = assistantMessage.id;

    // Отправляем начальный ответ клиенту
    res.json({
      success: true,
      chatId,
      messageId,
      userMessageId: userMessageId,  // null если это ответ на clarification
      status: 'processing',
      mode: deep_thinking ? 'deep_thinking' : 'standard'
    });

    // Продолжаем генерацию асинхронно
    processGeneration({
      chatId,
      messageId,
      prompt,
      answers,
      referenceUrl: inheritedReferenceUrl,  // Используем унаследованный референс!
      inheritedVisionAnalysis,  // И унаследованный Vision анализ
      size,
      userModel,
      variations,
      userId: req.user.id,
      startTime,
      chatTitle: chat.title,
      deepThinking: deep_thinking,
      chatHistory
    }).catch(async (error) => {
      log.error('Background generation failed', { error: error.message, messageId, chatId });

      // Обновляем сообщение с ошибкой в БД
      try {
        await db.update('messages', messageId, {
          content: null,
          error_message: error.message || 'Неизвестная ошибка генерации'
        });

        // Уведомляем клиента через WebSocket
        broadcastToChat(chatId, {
          type: 'generation_error',
          messageId,
          error: error.message || 'Неизвестная ошибка генерации'
        });
      } catch (dbError) {
        log.error('Failed to update message with error', { dbError: dbError.message, messageId });
      }
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
 * Быстрая генерация без уточняющих вопросов
 */
async function handleQuickGenerate(req, res, params) {
  const {
    chatId,
    chat,
    prompt,
    referenceUrl,
    visionAnalysis = null,  // Vision анализ унаследованный
    size,
    userModel,
    variations,
    userId,
    startTime,
    deepThinking,
    chatHistory
  } = params;

  try {
    // Сохраняем сообщение пользователя
    const userMessage = await db.insert('messages', {
      chat_id: chatId,
      role: 'user',
      content: prompt,
      reference_url: referenceUrl || null
    });

    // Создаём placeholder
    const assistantMessage = await db.insert('messages', {
      chat_id: chatId,
      role: 'assistant',
      content: deepThinking ? 'Глубокий анализ...' : 'Быстрая генерация...'
    });

    // Отправляем ответ
    res.json({
      success: true,
      chatId,
      messageId: assistantMessage.id,
      userMessageId: userMessage.id,
      status: 'processing',
      mode: 'quick'
    });

    // Запускаем генерацию
    processGeneration({
      chatId,
      messageId: assistantMessage.id,
      prompt,
      answers: null,
      referenceUrl,
      inheritedVisionAnalysis: visionAnalysis,  // Передаём унаследованный Vision анализ
      size,
      userModel,
      variations,
      userId,
      startTime,
      chatTitle: chat.title,
      deepThinking,
      chatHistory,
      skipClarification: true
    }).catch(error => {
      log.error('Quick generation failed', { error: error.message });
    });

  } catch (error) {
    log.error('Quick generate error', { error: error.message });
    if (!res.headersSent) {
      res.status(500).json({ error: 'Ошибка быстрой генерации' });
    }
  }
}

/**
 * Асинхронная обработка генерации - УЛУЧШЕННАЯ
 * Поддерживает Deep Thinking режим
 */
async function processGeneration(params) {
  const {
    chatId,
    messageId,
    prompt,
    answers,
    referenceUrl,
    inheritedVisionAnalysis = null,  // Vision анализ унаследованный из предыдущего сообщения
    size,
    userModel,
    variations,
    userId,
    startTime,
    chatTitle,
    deepThinking = false,
    chatHistory = []
  } = params;

  try {
    // 1. Уведомляем о начале
    broadcastToChat(chatId, {
      type: 'generation_progress',
      messageId,
      status: deepThinking ? 'deep_thinking' : 'enhancing_prompt',
      message: deepThinking ? 'Глубокий анализ запроса...' : 'Анализирую запрос...'
    });

    // Используем унаследованный visionAnalysis или ищем в БД
    let visionAnalysis = inheritedVisionAnalysis;

    if (!visionAnalysis && chatId) {
      try {
        const clarificationMsg = await db.getOne(
          `SELECT metadata FROM messages
           WHERE chat_id = $1 AND role = 'assistant'
           AND metadata IS NOT NULL
           ORDER BY created_at DESC LIMIT 1`,
          [chatId]
        );
        if (clarificationMsg?.metadata) {
          const meta = typeof clarificationMsg.metadata === 'string'
            ? JSON.parse(clarificationMsg.metadata)
            : clarificationMsg.metadata;
          visionAnalysis = meta.vision_analysis;
        }
      } catch (e) {
        log.warn('Failed to get Vision analysis from DB', { error: e.message });
      }
    }

    log.info('Vision analysis status', {
      hasVision: !!visionAnalysis,
      source: inheritedVisionAnalysis ? 'inherited' : 'database',
      contentType: visionAnalysis?.content_type
    });

    // 2. Улучшаем промпт через Claude
    let promptAnalysis;

    if (deepThinking) {
      // Deep Thinking режим с extended thinking
      promptAnalysis = await analyzeWithDeepThinking(prompt, {
        hasReference: !!referenceUrl,
        chatHistory,
        onThinkingUpdate: (update) => {
          // Отправляем процесс мышления клиенту
          broadcastToChat(chatId, {
            type: 'thinking_update',
            messageId,
            stage: update.stage,
            message: update.message,
            thinking: update.thinking?.substring(0, 500) // Ограничиваем размер
          });
        }
      });

      // Отправляем результат глубокого анализа
      if (promptAnalysis.deep_analysis) {
        broadcastToChat(chatId, {
          type: 'deep_analysis_complete',
          messageId,
          analysis: promptAnalysis.deep_analysis,
          thinking_process: promptAnalysis.thinking_process,
          confidence: promptAnalysis.confidence_score
        });
      }

    } else if (answers && Object.keys(answers).length > 0) {
      // Обработка ответов на вопросы
      promptAnalysis = await processUserAnswers(prompt, answers, {
        hasReference: !!referenceUrl,
        referenceUrl,
        visionAnalysis,
        chatHistory,
        size
      });
    } else {
      // Стандартный режим
      promptAnalysis = await enhancePrompt(prompt, {
        hasReference: !!referenceUrl,
        chatHistory,
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
      model: selectedModel,
      enhanced_prompt: promptAnalysis.enhanced_prompt?.substring(0, 200)
    });

    // 4. Парсим размер (передаём промпт для auto-режима)
    const presets = await db.getMany('SELECT name, width, height FROM size_presets');
    const { width, height } = parseSize(size, presets, prompt);

    // 5. Генерируем изображение
    // Используем variations_count из ответов пользователя если есть
    const numImages = promptAnalysis.variations_count || variations || 1;

    // Определяем передавать ли референс в модель
    // style_only = только описание в промпте, референс НЕ передаём
    const shouldPassReference = promptAnalysis.pass_reference_to_model !== false;
    const effectiveReferenceUrl = shouldPassReference ? referenceUrl : null;

    log.info('Generation config', {
      referenceUsage: promptAnalysis.reference_usage,
      passReference: shouldPassReference,
      hasReferenceUrl: !!referenceUrl,
      effectiveReference: !!effectiveReferenceUrl,
      // Детали visionAnalysis для отладки
      hasVisionAnalysis: !!visionAnalysis,
      visionSource: inheritedVisionAnalysis ? 'inherited_from_chat' : (visionAnalysis ? 'direct' : 'none'),
      contentType: visionAnalysis?.content_type,
      hasRecreationPrompt: !!visionAnalysis?.recreation_prompt,
      recreationPromptPreview: visionAnalysis?.recreation_prompt?.substring(0, 100),
      styleDescription: visionAnalysis?.style
    });

    const result = await generateImage(promptAnalysis.enhanced_prompt, {
      model: selectedModel,
      negativePrompt: promptAnalysis.negative_prompt,
      width,
      height,
      numImages: Math.min(numImages, 5),  // До 5 как Genspark
      referenceUrl: effectiveReferenceUrl,  // Может быть null если style_only
      textContent: promptAnalysis.text_content,
      textStyle: promptAnalysis.text_style,
      visionAnalysis  // Vision анализ всегда передаём для промпта
    });

    const totalTime = Date.now() - startTime;

    // 6. Формируем контент сообщения
    let messageContent = promptAnalysis.reasoning || 'Готово!';

    // Добавляем информацию о глубоком анализе если был
    if (deepThinking && promptAnalysis.deep_analysis) {
      messageContent = formatDeepAnalysisMessage(promptAnalysis);
    }

    // 7. Обновляем сообщение с результатом
    await db.update('messages', messageId, {
      content: messageContent,
      image_urls: result.images,
      model_used: selectedModel,
      generation_time_ms: totalTime,
      enhanced_prompt: promptAnalysis.enhanced_prompt,
      metadata: JSON.stringify({
        deep_thinking: deepThinking,
        detected_context: promptAnalysis.detected_context,
        confidence_score: promptAnalysis.confidence_score,
        deep_analysis: promptAnalysis.deep_analysis
      })
    });

    // 8. Обновляем название чата если это первое сообщение
    if (chatTitle === 'Новый чат') {
      const newTitle = await generateChatTitle(prompt);
      await db.update('chats', chatId, { title: newTitle });
    }

    // 9. Обновляем статистику
    await incrementGenerationStats(userId, totalTime);

    // 10. Уведомляем о завершении
    broadcastToChat(chatId, {
      type: 'generation_complete',
      messageId,
      images: result.images,
      model: selectedModel,
      timeMs: totalTime,
      enhancedPrompt: promptAnalysis.enhanced_prompt,
      deepThinking: deepThinking,
      deepAnalysis: promptAnalysis.deep_analysis,
      detectedContext: promptAnalysis.detected_context
    });

    log.generation(userId, selectedModel, totalTime, {
      chatId,
      messageId,
      imagesCount: result.images.length,
      deepThinking,
      detectedContext: promptAnalysis.detected_context
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
 * Форматирование сообщения с результатами глубокого анализа
 */
function formatDeepAnalysisMessage(analysis) {
  const parts = [];

  if (analysis.deep_analysis) {
    const da = analysis.deep_analysis;

    if (da.goal_understanding) {
      parts.push(`**Цель:** ${da.goal_understanding}`);
    }

    if (da.target_audience) {
      parts.push(`**Аудитория:** ${da.target_audience}`);
    }

    if (da.psychological_hooks?.length > 0) {
      parts.push(`**Психологические триггеры:** ${da.psychological_hooks.join(', ')}`);
    }

    if (da.recommendations?.length > 0) {
      parts.push(`**Рекомендации:** ${da.recommendations.join('; ')}`);
    }
  }

  if (analysis.reasoning) {
    parts.push(`\n${analysis.reasoning}`);
  }

  return parts.join('\n\n') || 'Глубокий анализ завершён';
}

/**
 * POST /api/generate/upload
 * Загрузка референса + автоматический Vision анализ
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

      // Автоматически анализируем референс через Vision
      let visionAnalysis = null;
      try {
        log.info('Starting Vision analysis for upload', { url: url?.substring(0, 50) });
        const { analyzeReferenceImage } = await import('../services/prompt.service.js');
        visionAnalysis = await analyzeReferenceImage(url);
        log.info('Vision analysis completed for upload', {
          hasAnalysis: !!visionAnalysis,
          contentType: visionAnalysis?.content_type,
          style: visionAnalysis?.style,
          summary: visionAnalysis?.summary?.substring(0, 100)
        });
      } catch (visionError) {
        log.error('Vision analysis failed', {
          error: visionError.message,
          stack: visionError.stack?.substring(0, 200)
        });
      }

      res.json({
        success: true,
        url,
        filename: req.file.filename,
        size: req.file.size,
        vision_analysis: visionAnalysis  // Добавляем Vision анализ в ответ!
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
        label: `${preset.name} (${preset.width}x${preset.height})`
      });
      return acc;
    }, {});

    res.json(grouped);

  } catch (error) {
    log.error('Get presets error', { error: error.message });
    res.status(500).json({ error: 'Ошибка получения пресетов' });
  }
});

/**
 * POST /api/generate/analyze
 * Только анализ запроса без генерации (для превью)
 */
router.post('/analyze', async (req, res) => {
  try {
    const { prompt, reference_url, deep_thinking = false } = req.body;

    if (!prompt || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'Введите описание' });
    }

    let analysis;
    if (deep_thinking) {
      analysis = await analyzeWithDeepThinking(prompt, {
        hasReference: !!reference_url
      });
    } else {
      analysis = await enhancePrompt(prompt, {
        hasReference: !!reference_url
      });
    }

    res.json({
      success: true,
      analysis: {
        detected_context: analysis.detected_context,
        creative_type: analysis.creative_type,
        suggested_model: analysis.suggested_model,
        needs_text: analysis.needs_text,
        text_content: analysis.text_content,
        enhanced_prompt_preview: analysis.enhanced_prompt?.substring(0, 300),
        reasoning: analysis.reasoning,
        deep_analysis: analysis.deep_analysis,
        confidence_score: analysis.confidence_score
      }
    });

  } catch (error) {
    log.error('Analyze error', { error: error.message });
    res.status(500).json({ error: 'Ошибка анализа' });
  }
});

export default router;
