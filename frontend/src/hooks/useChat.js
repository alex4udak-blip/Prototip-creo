import { create } from 'zustand';
import { chatsAPI, generateAPI, wsManager } from '../services/api';

/**
 * Generation status types for beautiful UI states
 */
export const GENERATION_PHASES = {
  STARTING: 'starting',
  ANALYZING: 'analyzing',
  ENHANCING: 'enhancing',
  GENERATING: 'generating',
  FINALIZING: 'finalizing',
  COMPLETE: 'complete',
  ERROR: 'error',
  // Deep Thinking phases
  DEEP_THINKING: 'deep_thinking',
  THINKING: 'thinking'
};

export const PHASE_LABELS = {
  [GENERATION_PHASES.STARTING]: 'Начинаю обработку...',
  [GENERATION_PHASES.ANALYZING]: 'Анализирую запрос...',
  [GENERATION_PHASES.ENHANCING]: 'Улучшаю промпт...',
  [GENERATION_PHASES.GENERATING]: 'Генерирую изображение...',
  [GENERATION_PHASES.FINALIZING]: 'Завершаю...',
  [GENERATION_PHASES.COMPLETE]: 'Готово!',
  [GENERATION_PHASES.ERROR]: 'Ошибка',
  [GENERATION_PHASES.DEEP_THINKING]: 'Глубокий анализ...',
  [GENERATION_PHASES.THINKING]: 'Claude думает...'
};

/**
 * Chat Store (Zustand) - УЛУЧШЕННЫЙ
 * Поддерживает Deep Thinking, умные вопросы и быструю генерацию
 */
export const useChatStore = create((set, get) => ({
  // Список чатов
  chats: [],
  chatsLoading: false,

  // Текущий чат
  currentChat: null,
  messages: [],
  chatLoading: false,

  // Генерация
  isGenerating: false,
  generationPhase: null,
  generationProgress: null,
  generationMessageId: null,
  generationMode: null, // 'standard' | 'deep_thinking' | 'quick'

  // Deep Thinking данные
  deepThinkingData: null, // { stage, message, thinking, analysis }

  // Уточняющие вопросы
  pendingClarification: null,  // { questions, summary, originalPrompt, detected_context, thinking, known_info }

  // Референс (прикреплённая картинка)
  attachedReference: null,

  // Настройки генерации
  settings: {
    model: 'auto',
    size: '1200x628',
    variations: 1,
    deepThinking: false // По умолчанию выключен
  },

  // Пресеты
  sizePresets: {},
  availableModels: [],

  // ==========================================
  // Chats
  // ==========================================

  loadChats: async () => {
    set({ chatsLoading: true });
    try {
      const chats = await chatsAPI.getAll();
      set({ chats, chatsLoading: false });
    } catch (error) {
      console.error('Load chats error:', error);
      set({ chatsLoading: false });
    }
  },

  createChat: async () => {
    try {
      const chat = await chatsAPI.create();
      set(state => ({ chats: [chat, ...state.chats] }));
      return chat;
    } catch (error) {
      console.error('Create chat error:', error);
      throw error;
    }
  },

  selectChat: async (chatId) => {
    if (!chatId) {
      set({ currentChat: null, messages: [], pendingClarification: null });
      wsManager.unsubscribe();
      return;
    }

    set({ chatLoading: true, pendingClarification: null });
    try {
      const chat = await chatsAPI.getById(chatId);
      set({
        currentChat: chat,
        messages: chat.messages || [],
        chatLoading: false
      });

      // Подписываемся на WebSocket обновления
      wsManager.subscribe(chatId);
    } catch (error) {
      console.error('Select chat error:', error);
      set({ chatLoading: false });
    }
  },

  deleteChat: async (chatId) => {
    try {
      await chatsAPI.delete(chatId);
      set(state => ({
        chats: state.chats.filter(c => c.id !== chatId),
        currentChat: state.currentChat?.id === chatId ? null : state.currentChat,
        messages: state.currentChat?.id === chatId ? [] : state.messages,
        pendingClarification: state.currentChat?.id === chatId ? null : state.pendingClarification
      }));
    } catch (error) {
      console.error('Delete chat error:', error);
      throw error;
    }
  },

  renameChat: async (chatId, title) => {
    try {
      const updated = await chatsAPI.rename(chatId, title);
      set(state => ({
        chats: state.chats.map(c => c.id === chatId ? { ...c, title: updated.title } : c),
        currentChat: state.currentChat?.id === chatId
          ? { ...state.currentChat, title: updated.title }
          : state.currentChat
      }));
    } catch (error) {
      console.error('Rename chat error:', error);
      throw error;
    }
  },

  // ==========================================
  // Messages - Direct manipulation
  // ==========================================

  addMessage: (message) => {
    set(state => ({
      messages: [...state.messages, message]
    }));
  },

  updateMessage: (messageId, updates) => {
    set(state => ({
      messages: state.messages.map(msg =>
        msg.id === messageId ? { ...msg, ...updates } : msg
      )
    }));
  },

  // ==========================================
  // Generation - УЛУЧШЕННАЯ
  // ==========================================

  generate: async (prompt, answers = null, options = {}) => {
    const { currentChat, attachedReference, settings, pendingClarification } = get();
    const { deepThinking = settings.deepThinking, quickGenerate = false } = options;

    // СРАЗУ добавляем сообщение пользователя в чат!
    const tempUserMessageId = `user-${Date.now()}`;
    const userMessage = {
      id: tempUserMessageId,
      role: 'user',
      content: prompt,
      referenceUrl: attachedReference?.url,
      createdAt: new Date().toISOString()
    };

    // Добавляем сообщение пользователя немедленно
    set(state => ({
      messages: [...state.messages, userMessage],
      isGenerating: true,
      generationPhase: deepThinking ? GENERATION_PHASES.DEEP_THINKING : GENERATION_PHASES.STARTING,
      generationProgress: null,
      generationMode: deepThinking ? 'deep_thinking' : (quickGenerate ? 'quick' : 'standard'),
      deepThinkingData: deepThinking ? { stage: 'starting', message: 'Начинаю глубокий анализ...' } : null,
      attachedReference: null
    }));

    try {
      // Если есть ответы на вопросы — используем оригинальный промпт
      const actualPrompt = answers && pendingClarification?.originalPrompt
        ? pendingClarification.originalPrompt
        : prompt;

      const response = await generateAPI.generate({
        chat_id: currentChat?.id,
        prompt: actualPrompt,
        reference_url: attachedReference?.url,
        size: settings.size,
        model: settings.model,
        variations: settings.variations,
        answers: answers,
        skip_clarification: !!answers || quickGenerate,
        deep_thinking: deepThinking,
        quick_generate: quickGenerate
      });

      // Обновляем ID сообщения пользователя если сервер вернул
      if (response.userMessageId) {
        get().updateMessage(tempUserMessageId, { id: response.userMessageId });
      }

      // Очищаем pending clarification
      set({ pendingClarification: null });

      // Если сервер вернул вопросы
      if (response.status === 'needs_clarification') {
        const clarificationMessage = {
          id: response.messageId,
          role: 'assistant',
          content: response.clarification.summary,
          clarification: response.clarification,
          createdAt: new Date().toISOString()
        };

        set(state => ({
          messages: [...state.messages, clarificationMessage],
          pendingClarification: {
            ...response.clarification,
            originalPrompt: prompt,
            messageId: response.messageId
          },
          isGenerating: false,
          generationPhase: null,
          generationMode: null,
          deepThinkingData: null
        }));

        // Обновляем чат если новый
        if (!currentChat && response.chatId) {
          await get().selectChat(response.chatId);
          await get().loadChats();
        }

        return response;
      }

      // Обычная генерация - добавляем placeholder для ответа ассистента
      const assistantMessageId = response.messageId || `assistant-${Date.now()}`;
      const assistantMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: null,
        isGenerating: true,
        generationPhase: deepThinking ? GENERATION_PHASES.DEEP_THINKING : GENERATION_PHASES.ANALYZING,
        deepThinking: deepThinking,
        createdAt: new Date().toISOString()
      };

      set(state => ({
        messages: [...state.messages, assistantMessage],
        generationMessageId: assistantMessageId,
        generationPhase: deepThinking ? GENERATION_PHASES.DEEP_THINKING : GENERATION_PHASES.ANALYZING
      }));

      // Обновляем текущий чат если его не было
      if (!currentChat && response.chatId) {
        // Не перезагружаем сообщения, просто обновляем currentChat
        const chat = await chatsAPI.getById(response.chatId);
        set({ currentChat: chat });
        await get().loadChats();
        wsManager.subscribe(response.chatId);
      }

      return response;

    } catch (error) {
      console.error('Generate error:', error);
      set({
        isGenerating: false,
        generationPhase: GENERATION_PHASES.ERROR,
        generationProgress: error.message,
        generationMode: null,
        deepThinkingData: null
      });
      throw error;
    }
  },

  // Отправка ответов на уточняющие вопросы - УЛУЧШЕННАЯ
  submitClarificationAnswers: async (answers, options = {}) => {
    const { pendingClarification } = get();
    if (!pendingClarification) return;

    return get().generate(pendingClarification.originalPrompt, answers, options);
  },

  // Пропустить вопросы и генерировать сразу - УЛУЧШЕННАЯ
  skipClarification: async (options = {}) => {
    const { pendingClarification, currentChat, attachedReference, settings } = get();
    if (!pendingClarification) return;

    const { deepThinking = false } = options;

    set({
      isGenerating: true,
      generationPhase: deepThinking ? GENERATION_PHASES.DEEP_THINKING : GENERATION_PHASES.STARTING,
      generationMode: deepThinking ? 'deep_thinking' : 'standard',
      deepThinkingData: deepThinking ? { stage: 'starting', message: 'Начинаю глубокий анализ...' } : null,
      pendingClarification: null
    });

    try {
      const response = await generateAPI.generate({
        chat_id: currentChat?.id,
        prompt: pendingClarification.originalPrompt,
        reference_url: attachedReference?.url,
        size: settings.size,
        model: settings.model,
        variations: settings.variations,
        skip_clarification: true,
        deep_thinking: deepThinking
      });

      const assistantMessageId = response.messageId || `assistant-${Date.now()}`;
      const assistantMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: null,
        isGenerating: true,
        generationPhase: deepThinking ? GENERATION_PHASES.DEEP_THINKING : GENERATION_PHASES.ANALYZING,
        deepThinking: deepThinking,
        createdAt: new Date().toISOString()
      };

      set(state => ({
        messages: [...state.messages, assistantMessage],
        generationMessageId: assistantMessageId,
        generationPhase: deepThinking ? GENERATION_PHASES.DEEP_THINKING : GENERATION_PHASES.ANALYZING,
        attachedReference: null
      }));

      return response;
    } catch (error) {
      console.error('Skip clarification error:', error);
      set({
        isGenerating: false,
        generationPhase: GENERATION_PHASES.ERROR,
        generationMode: null,
        deepThinkingData: null
      });
      throw error;
    }
  },

  // Быстрая генерация без вопросов - НОВАЯ
  quickGenerate: async (options = {}) => {
    const { pendingClarification, currentChat, attachedReference, settings } = get();
    if (!pendingClarification) return;

    const { deepThinking = false } = options;

    set({
      isGenerating: true,
      generationPhase: deepThinking ? GENERATION_PHASES.DEEP_THINKING : GENERATION_PHASES.STARTING,
      generationMode: 'quick',
      deepThinkingData: deepThinking ? { stage: 'starting', message: 'Быстрый глубокий анализ...' } : null,
      pendingClarification: null
    });

    try {
      const response = await generateAPI.generate({
        chat_id: currentChat?.id,
        prompt: pendingClarification.originalPrompt,
        reference_url: attachedReference?.url,
        size: settings.size,
        model: settings.model,
        variations: settings.variations,
        quick_generate: true,
        deep_thinking: deepThinking
      });

      const assistantMessageId = response.messageId || `assistant-${Date.now()}`;
      const assistantMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: null,
        isGenerating: true,
        generationPhase: GENERATION_PHASES.GENERATING,
        deepThinking: deepThinking,
        createdAt: new Date().toISOString()
      };

      set(state => ({
        messages: [...state.messages, assistantMessage],
        generationMessageId: assistantMessageId,
        generationPhase: GENERATION_PHASES.GENERATING,
        attachedReference: null
      }));

      return response;
    } catch (error) {
      console.error('Quick generate error:', error);
      set({
        isGenerating: false,
        generationPhase: GENERATION_PHASES.ERROR,
        generationMode: null,
        deepThinkingData: null
      });
      throw error;
    }
  },

  // Обновление прогресса генерации (из WebSocket) - УЛУЧШЕННАЯ
  updateGenerationProgress: (data) => {
    // Маппинг статусов от сервера на наши фазы
    const phaseMap = {
      'analyzing': GENERATION_PHASES.ANALYZING,
      'enhancing': GENERATION_PHASES.ENHANCING,
      'enhancing_prompt': GENERATION_PHASES.ENHANCING,
      'generating': GENERATION_PHASES.GENERATING,
      'generating_image': GENERATION_PHASES.GENERATING,
      'finalizing': GENERATION_PHASES.FINALIZING,
      'processing': GENERATION_PHASES.GENERATING,
      'deep_thinking': GENERATION_PHASES.DEEP_THINKING,
      'thinking': GENERATION_PHASES.THINKING
    };

    const phase = phaseMap[data.status] || GENERATION_PHASES.GENERATING;

    const updates = {
      generationPhase: phase,
      generationProgress: data.message
    };

    // Обновляем Deep Thinking данные если это thinking update
    if (data.status === 'deep_thinking' || data.type === 'thinking_update') {
      updates.deepThinkingData = {
        stage: data.stage || 'thinking',
        message: data.message,
        thinking: data.thinking
      };
    }

    set(updates);

    // Обновляем сообщение
    if (data.messageId) {
      set(state => ({
        messages: state.messages.map(msg =>
          msg.id === data.messageId
            ? {
                ...msg,
                generationPhase: phase,
                generationProgress: data.message,
                enhancedPromptPreview: data.enhanced_prompt
              }
            : msg
        )
      }));
    }
  },

  // Обработка Deep Analysis Complete (из WebSocket) - НОВАЯ
  handleDeepAnalysisComplete: (data) => {
    set({
      deepThinkingData: {
        stage: 'complete',
        message: 'Анализ завершён',
        analysis: data.analysis,
        thinking_process: data.thinking_process,
        confidence: data.confidence
      }
    });

    // Обновляем сообщение с результатами анализа
    if (data.messageId) {
      set(state => ({
        messages: state.messages.map(msg =>
          msg.id === data.messageId
            ? {
                ...msg,
                deepAnalysis: data.analysis,
                thinkingProcess: data.thinking_process,
                confidence: data.confidence
              }
            : msg
        )
      }));
    }
  },

  // Завершение генерации (из WebSocket) - УЛУЧШЕННАЯ
  completeGeneration: (data) => {
    set({
      isGenerating: false,
      generationPhase: GENERATION_PHASES.COMPLETE,
      generationProgress: null,
      generationMessageId: null,
      generationMode: null,
      deepThinkingData: null
    });

    // Обновляем сообщение с результатом
    if (data.messageId) {
      set(state => ({
        messages: state.messages.map(msg =>
          msg.id === data.messageId
            ? {
                ...msg,
                content: null,
                imageUrls: data.images,
                modelUsed: data.model,
                generationTimeMs: data.timeMs,
                enhancedPrompt: data.enhancedPrompt,
                isGenerating: false,
                generationPhase: null,
                deepThinking: data.deepThinking,
                deepAnalysis: data.deepAnalysis,
                detectedContext: data.detectedContext
              }
            : msg
        )
      }));
    }

    // Обновляем список чатов (название могло измениться)
    get().loadChats();
  },

  // Ошибка генерации (из WebSocket)
  failGeneration: (data) => {
    set({
      isGenerating: false,
      generationPhase: GENERATION_PHASES.ERROR,
      generationProgress: null,
      generationMessageId: null,
      generationMode: null,
      deepThinkingData: null
    });

    if (data.messageId) {
      set(state => ({
        messages: state.messages.map(msg =>
          msg.id === data.messageId
            ? {
                ...msg,
                content: null,
                errorMessage: data.error,
                isGenerating: false,
                generationPhase: GENERATION_PHASES.ERROR
              }
            : msg
        )
      }));
    }
  },

  // ==========================================
  // Reference
  // ==========================================

  setAttachedReference: (reference) => {
    set({ attachedReference: reference });
  },

  clearAttachedReference: () => {
    set({ attachedReference: null });
  },

  uploadReference: async (file) => {
    try {
      const result = await generateAPI.uploadReference(file);
      set({ attachedReference: { url: result.url, filename: result.filename } });
      return result;
    } catch (error) {
      console.error('Upload reference error:', error);
      throw error;
    }
  },

  // ==========================================
  // Settings & Presets
  // ==========================================

  updateSettings: (updates) => {
    set(state => ({
      settings: { ...state.settings, ...updates }
    }));
  },

  // Переключатель Deep Thinking - НОВЫЙ
  toggleDeepThinking: () => {
    set(state => ({
      settings: { ...state.settings, deepThinking: !state.settings.deepThinking }
    }));
  },

  loadPresets: async () => {
    try {
      const [presets, models] = await Promise.all([
        generateAPI.getPresets(),
        generateAPI.getModels()
      ]);
      set({ sizePresets: presets, availableModels: models });
    } catch (error) {
      console.error('Load presets error:', error);
    }
  },

  // ==========================================
  // WebSocket handlers - УЛУЧШЕННЫЕ
  // ==========================================

  initWebSocket: () => {
    const { currentChat } = get();

    wsManager.connect(currentChat?.id);

    wsManager.on('generation_progress', (data) => {
      get().updateGenerationProgress(data);
    });

    wsManager.on('thinking_update', (data) => {
      get().updateGenerationProgress(data);
    });

    wsManager.on('deep_analysis_complete', (data) => {
      get().handleDeepAnalysisComplete(data);
    });

    wsManager.on('generation_complete', (data) => {
      get().completeGeneration(data);
    });

    wsManager.on('generation_error', (data) => {
      get().failGeneration(data);
    });
  },

  disconnectWebSocket: () => {
    wsManager.disconnect();
  }
}));

export default useChatStore;
