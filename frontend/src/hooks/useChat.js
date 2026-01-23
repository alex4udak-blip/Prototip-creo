import { create } from 'zustand';
import { chatsAPI, generateAPI, wsManager } from '../services/api';

/**
 * Generation phases
 */
export const GENERATION_PHASES = {
  IDLE: 'idle',
  GENERATING: 'generating',
  COMPLETE: 'complete',
  ERROR: 'error'
};

export const PHASE_LABELS = {
  [GENERATION_PHASES.IDLE]: '',
  [GENERATION_PHASES.GENERATING]: 'Генерирую...',
  [GENERATION_PHASES.COMPLETE]: 'Готово!',
  [GENERATION_PHASES.ERROR]: 'Ошибка'
};

/**
 * Chat Store — УПРОЩЁННЫЙ
 * Только базовая логика: чаты, сообщения, генерация через Gemini
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
  generationPhase: GENERATION_PHASES.IDLE,
  generationProgress: null,

  // Референс (прикреплённая картинка)
  attachedImage: null,

  // Настройки
  settings: {
    aspectRatio: 'auto',  // '1:1', '16:9', '9:16', '4:3', 'auto'
    variants: 3,          // 1-4
    resolution: '2K',     // '1K', '2K', '4K'
    mode: 'smart'         // 'smart' | 'fast'
  },

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
  // Messages
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
  // Generation — УПРОЩЁННАЯ
  // ==========================================

  sendMessage: async (prompt, imageFile = null) => {
    const { currentChat, settings, attachedImage } = get();

    if (!prompt?.trim() && !imageFile && !attachedImage) {
      return;
    }

    const tempUserMessageId = `user-${Date.now()}`;
    const tempAssistantMessageId = `assistant-${Date.now()}`;

    // Добавляем сообщение пользователя
    const userMessage = {
      id: tempUserMessageId,
      role: 'user',
      content: prompt,
      imageUrl: attachedImage ? URL.createObjectURL(attachedImage) : null,
      createdAt: new Date().toISOString()
    };

    // Добавляем placeholder для ответа
    const assistantPlaceholder = {
      id: tempAssistantMessageId,
      role: 'assistant',
      content: null,
      isGenerating: true,
      createdAt: new Date().toISOString()
    };

    set(state => ({
      messages: [...state.messages, userMessage, assistantPlaceholder],
      isGenerating: true,
      generationPhase: GENERATION_PHASES.GENERATING,
      generationProgress: 'Генерирую...',
      attachedImage: null
    }));

    try {
      // Подготавливаем FormData
      const formData = new FormData();
      formData.append('prompt', prompt || '');
      if (currentChat?.id) {
        formData.append('chat_id', currentChat.id);
      }
      formData.append('settings', JSON.stringify({
        aspectRatio: settings.aspectRatio,
        variants: settings.variants,
        resolution: settings.resolution,
        mode: settings.mode
      }));

      // Картинка
      const imageToSend = imageFile || attachedImage;
      if (imageToSend) {
        formData.append('reference', imageToSend);
      }

      // Отправляем
      const response = await generateAPI.sendWithFormData(formData);

      // Обновляем ID сообщения пользователя
      if (response.userMessageId) {
        get().updateMessage(tempUserMessageId, { id: response.userMessageId });
      }

      // Обновляем placeholder
      if (response.chatId && !currentChat) {
        set({ currentChat: { id: response.chatId, title: 'Новый чат' } });
        await get().loadChats();
        wsManager.subscribe(response.chatId);
      }

      return response;

    } catch (error) {
      console.error('Send message error:', error);
      set({
        isGenerating: false,
        generationPhase: GENERATION_PHASES.ERROR,
        generationProgress: error.message
      });

      // Обновляем placeholder с ошибкой
      get().updateMessage(tempAssistantMessageId, {
        isGenerating: false,
        errorMessage: error.message
      });

      throw error;
    }
  },

  // ==========================================
  // Reference
  // ==========================================

  setAttachedImage: (file) => {
    set({ attachedImage: file });
  },

  clearAttachedImage: () => {
    set({ attachedImage: null });
  },

  // ==========================================
  // Settings
  // ==========================================

  updateSettings: (updates) => {
    set(state => ({
      settings: { ...state.settings, ...updates }
    }));
  },

  // ==========================================
  // WebSocket handlers
  // ==========================================

  initWebSocket: () => {
    const { currentChat } = get();

    wsManager.connect(currentChat?.id);

    wsManager.on('generation_progress', (data) => {
      set({
        generationPhase: GENERATION_PHASES.GENERATING,
        generationProgress: data.message
      });

      // Обновляем placeholder с текущим progress
      set(state => {
        const messages = state.messages;
        let targetIndex = -1;

        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].role === 'assistant' && messages[i].isGenerating) {
            targetIndex = i;
            break;
          }
        }

        if (targetIndex === -1) {
          return state;
        }

        const updatedMessages = [...messages];
        updatedMessages[targetIndex] = {
          ...updatedMessages[targetIndex],
          generationProgress: data.message,
          generationStatus: data.status  // analyzing, generating, generating_image
        };

        return { messages: updatedMessages };
      });
    });

    wsManager.on('generation_complete', (data) => {
      set({
        isGenerating: false,
        generationPhase: GENERATION_PHASES.COMPLETE,
        generationProgress: null
      });

      // Обновляем сообщение с результатом
      // Ищем: 1) по messageId 2) по временному ID 3) последний generating assistant
      set(state => {
        const messages = state.messages;
        let targetIndex = -1;

        // Сначала ищем по messageId от сервера
        if (data.messageId) {
          targetIndex = messages.findIndex(msg => msg.id === data.messageId);
        }

        // Если не нашли, ищем последний assistant placeholder (isGenerating: true)
        if (targetIndex === -1) {
          for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'assistant' && messages[i].isGenerating) {
              targetIndex = i;
              break;
            }
          }
        }

        if (targetIndex === -1) {
          return state; // Не нашли что обновлять
        }

        const updatedMessages = [...messages];
        updatedMessages[targetIndex] = {
          ...updatedMessages[targetIndex],
          id: data.messageId || updatedMessages[targetIndex].id,
          content: data.content,
          imageUrls: data.images || data.imageUrls || [],
          isGenerating: false,
          generationPhase: GENERATION_PHASES.COMPLETE
        };

        return { messages: updatedMessages };
      });

      get().loadChats();
    });

    wsManager.on('generation_error', (data) => {
      set({
        isGenerating: false,
        generationPhase: GENERATION_PHASES.ERROR,
        generationProgress: null
      });

      // Ищем placeholder так же как в generation_complete
      set(state => {
        const messages = state.messages;
        let targetIndex = -1;

        if (data.messageId) {
          targetIndex = messages.findIndex(msg => msg.id === data.messageId);
        }

        if (targetIndex === -1) {
          for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'assistant' && messages[i].isGenerating) {
              targetIndex = i;
              break;
            }
          }
        }

        if (targetIndex === -1) {
          return state;
        }

        const updatedMessages = [...messages];
        updatedMessages[targetIndex] = {
          ...updatedMessages[targetIndex],
          errorMessage: data.error,
          isGenerating: false,
          generationPhase: GENERATION_PHASES.ERROR
        };

        return { messages: updatedMessages };
      });
    });
  },

  disconnectWebSocket: () => {
    wsManager.disconnect();
  }
}));

export default useChatStore;
