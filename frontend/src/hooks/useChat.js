import { create } from 'zustand';
import { chatsAPI, generateAPI, wsManager } from '../services/api';

/**
 * Chat Store (Zustand)
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
  generationStatus: null,
  generationProgress: null,

  // Уточняющие вопросы
  pendingClarification: null,  // { questions, summary, originalPrompt }

  // Референс (прикреплённая картинка)
  attachedReference: null,

  // Настройки генерации
  settings: {
    model: 'auto',
    size: '1200x628',
    variations: 1
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
      set({ currentChat: null, messages: [] });
      wsManager.unsubscribe();
      return;
    }

    set({ chatLoading: true });
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
        messages: state.currentChat?.id === chatId ? [] : state.messages
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
  // Generation
  // ==========================================

  generate: async (prompt, answers = null) => {
    const { currentChat, attachedReference, settings, pendingClarification } = get();

    set({ isGenerating: true, generationStatus: 'starting', generationProgress: null });

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
        skip_clarification: !!answers  // Пропускаем вопросы если уже ответили
      });

      // Очищаем pending clarification
      set({ pendingClarification: null });

      // Если сервер вернул вопросы
      if (response.status === 'needs_clarification') {
        const userMessage = {
          id: response.userMessageId || Date.now(),
          role: 'user',
          content: prompt,
          referenceUrl: attachedReference?.url,
          createdAt: new Date().toISOString()
        };

        const clarificationMessage = {
          id: response.messageId,
          role: 'assistant',
          content: response.clarification.summary,
          clarification: response.clarification,
          createdAt: new Date().toISOString()
        };

        set(state => ({
          messages: [...state.messages, userMessage, clarificationMessage],
          pendingClarification: {
            ...response.clarification,
            originalPrompt: prompt,
            messageId: response.messageId
          },
          isGenerating: false,
          attachedReference: null
        }));

        // Обновляем чат если новый
        if (!currentChat && response.chatId) {
          await get().selectChat(response.chatId);
          await get().loadChats();
        }

        return response;
      }

      // Обычная генерация
      // Обновляем текущий чат если его не было
      if (!currentChat && response.chatId) {
        await get().selectChat(response.chatId);
        await get().loadChats();
      } else {
        // Если чат уже есть - добавляем сообщения локально
        const userMessage = {
          id: response.userMessageId || Date.now(),
          role: 'user',
          content: answers ? `${actualPrompt}` : prompt,
          referenceUrl: attachedReference?.url,
          createdAt: new Date().toISOString()
        };

        const assistantMessage = {
          id: response.messageId,
          role: 'assistant',
          content: 'Генерирую...',
          isGenerating: true,
          createdAt: new Date().toISOString()
        };

        set(state => ({
          messages: [...state.messages, userMessage, assistantMessage],
          attachedReference: null
        }));
      }

      // Очищаем референс в любом случае
      if (currentChat) {
        set({ attachedReference: null });
      }

      return response;

    } catch (error) {
      console.error('Generate error:', error);
      set({ isGenerating: false, generationStatus: 'error' });
      throw error;
    }
  },

  // Отправка ответов на уточняющие вопросы
  submitClarificationAnswers: async (answers) => {
    const { pendingClarification } = get();
    if (!pendingClarification) return;

    return get().generate(pendingClarification.originalPrompt, answers);
  },

  // Пропустить вопросы и генерировать сразу
  skipClarification: async () => {
    const { pendingClarification, currentChat, attachedReference, settings } = get();
    if (!pendingClarification) return;

    set({ isGenerating: true, pendingClarification: null });

    try {
      const response = await generateAPI.generate({
        chat_id: currentChat?.id,
        prompt: pendingClarification.originalPrompt,
        reference_url: attachedReference?.url,
        size: settings.size,
        model: settings.model,
        variations: settings.variations,
        skip_clarification: true
      });

      const assistantMessage = {
        id: response.messageId,
        role: 'assistant',
        content: 'Генерирую...',
        isGenerating: true,
        createdAt: new Date().toISOString()
      };

      set(state => ({
        messages: [...state.messages, assistantMessage],
        attachedReference: null
      }));

      return response;
    } catch (error) {
      console.error('Skip clarification error:', error);
      set({ isGenerating: false });
      throw error;
    }
  },

  // Обновление прогресса генерации (из WebSocket)
  updateGenerationProgress: (data) => {
    set({
      generationStatus: data.status,
      generationProgress: data.message
    });

    // Обновляем сообщение
    if (data.messageId) {
      set(state => ({
        messages: state.messages.map(msg =>
          msg.id === data.messageId
            ? { ...msg, content: data.message || msg.content }
            : msg
        )
      }));
    }
  },

  // Завершение генерации (из WebSocket)
  completeGeneration: (data) => {
    set({ isGenerating: false, generationStatus: 'complete', generationProgress: null });

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
                isGenerating: false
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
    set({ isGenerating: false, generationStatus: 'error', generationProgress: null });

    if (data.messageId) {
      set(state => ({
        messages: state.messages.map(msg =>
          msg.id === data.messageId
            ? { ...msg, content: null, errorMessage: data.error, isGenerating: false }
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
  // WebSocket handlers
  // ==========================================

  initWebSocket: () => {
    const { currentChat } = get();

    wsManager.connect(currentChat?.id);

    wsManager.on('generation_progress', (data) => {
      get().updateGenerationProgress(data);
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
