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
 * Без лишних settings — модель сама умная
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

  // Референсы (до 14 картинок)
  attachedImages: [],

  // ==========================================
  // Chats
  // ==========================================

  loadChats: async () => {
    set({ chatsLoading: true });
    try {
      const chats = await chatsAPI.getAll();
      const { currentChat } = get();
      let updatedCurrentChat = currentChat;

      if (currentChat?.id) {
        const foundChat = chats.find(c => c.id === currentChat.id);
        if (foundChat) {
          const localIsDefault = !currentChat.title || currentChat.title === 'Новый чат';
          const serverIsDefault = !foundChat.title || foundChat.title === 'Новый чат';

          if (localIsDefault && !serverIsDefault) {
            updatedCurrentChat = { ...currentChat, title: foundChat.title };
          }
        }
      }
      set({ chats, chatsLoading: false, currentChat: updatedCurrentChat });
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
    // Always unsubscribe from previous chat first to prevent duplicate subscriptions
    wsManager.unsubscribe();

    if (!chatId) {
      set({ currentChat: null, messages: [] });
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

      // Subscribe to new chat after setting state
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

  sendMessage: async (prompt, imageFiles = null) => {
    const { currentChat, attachedImages } = get();

    const allImages = imageFiles
      ? (Array.isArray(imageFiles) ? imageFiles : [imageFiles])
      : attachedImages;

    if (!prompt?.trim() && allImages.length === 0) {
      return;
    }

    const tempUserMessageId = `user-${Date.now()}`;
    const tempAssistantMessageId = `assistant-${Date.now()}`;

    const userMessage = {
      id: tempUserMessageId,
      role: 'user',
      content: prompt,
      imageUrls: allImages.map(img => URL.createObjectURL(img)),
      createdAt: new Date().toISOString()
    };

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
      attachedImages: []
    }));

    try {
      const formData = new FormData();
      formData.append('prompt', prompt || '');
      if (currentChat?.id) {
        formData.append('chat_id', currentChat.id);
      }

      for (const img of allImages) {
        formData.append('references', img);
      }

      const response = await generateAPI.sendWithFormData(formData);

      if (response.userMessageId) {
        get().updateMessage(tempUserMessageId, { id: response.userMessageId });
      }

      if (response.chatId) {
        const isNewChat = !currentChat || currentChat.id !== response.chatId;
        const newTitle = prompt?.substring(0, 50) || 'Новый чат';

        if (isNewChat) {
          const newChat = {
            id: response.chatId,
            title: newTitle,
            createdAt: new Date().toISOString()
          };

          set(state => ({
            currentChat: newChat,
            chats: [newChat, ...state.chats.filter(c => c.id !== response.chatId)]
          }));
        } else {
          const isTitleDefault = currentChat?.title === 'Новый чат' || !currentChat?.title;
          if (isTitleDefault) {
            set(state => ({
              currentChat: { ...state.currentChat, title: newTitle },
              chats: state.chats.map(chat =>
                chat.id === response.chatId ? { ...chat, title: newTitle } : chat
              )
            }));
          }
        }

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

      get().updateMessage(tempAssistantMessageId, {
        isGenerating: false,
        errorMessage: error.message
      });

      throw error;
    }
  },

  // ==========================================
  // References
  // ==========================================

  setAttachedImages: (files) => {
    set({ attachedImages: Array.isArray(files) ? files.slice(0, 14) : [files].slice(0, 14) });
  },

  addAttachedImage: (file) => {
    set(state => ({
      attachedImages: [...state.attachedImages, file].slice(0, 14)
    }));
  },

  removeAttachedImage: (index) => {
    set(state => ({
      attachedImages: state.attachedImages.filter((_, i) => i !== index)
    }));
  },

  clearAttachedImages: () => {
    set({ attachedImages: [] });
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
          generationStatus: data.status,
          partialText: data.partialText || updatedMessages[targetIndex].partialText,
          content: data.partialText || updatedMessages[targetIndex].content,
          imageUrls: data.newImage
            ? [...(updatedMessages[targetIndex].imageUrls || []), typeof data.newImage === 'object' ? data.newImage.url : data.newImage]
            : updatedMessages[targetIndex].imageUrls,
          progress: data.progress || updatedMessages[targetIndex].progress
        };

        return { messages: updatedMessages };
      });
    });

    wsManager.on('tool_use', (data) => {
      set(state => {
        const messages = [...state.messages];
        let targetIndex = -1;

        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].role === 'assistant' && messages[i].isGenerating) {
            targetIndex = i;
            break;
          }
        }

        if (targetIndex === -1) return state;

        const currentTools = messages[targetIndex].activeTools || [];
        const toolIndex = currentTools.findIndex(t => t.tool === data.tool);

        if (toolIndex === -1) {
          currentTools.push(data);
        } else {
          currentTools[toolIndex] = data;
        }

        messages[targetIndex] = {
          ...messages[targetIndex],
          activeTools: [...currentTools]
        };

        return { messages };
      });
    });

    wsManager.on('tool_use_complete', (data) => {
      set(state => {
        const messages = [...state.messages];
        let targetIndex = -1;

        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].role === 'assistant' && messages[i].isGenerating) {
            targetIndex = i;
            break;
          }
        }

        if (targetIndex === -1) return state;

        const currentTools = (messages[targetIndex].activeTools || []).map(tool => ({
          ...tool,
          status: 'complete'
        }));

        messages[targetIndex] = {
          ...messages[targetIndex],
          activeTools: currentTools
        };

        return { messages };
      });
    });

    wsManager.on('generation_complete', (data) => {
      set({
        isGenerating: false,
        generationPhase: GENERATION_PHASES.COMPLETE,
        generationProgress: null
      });

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

        let imageUrls = data.images || data.imageUrls || [];
        if (imageUrls.length > 0 && typeof imageUrls[0] === 'object' && imageUrls[0].url) {
          imageUrls = imageUrls.map(img => img.url);
        }

        const updatedMessages = [...messages];
        updatedMessages[targetIndex] = {
          ...updatedMessages[targetIndex],
          id: data.messageId || updatedMessages[targetIndex].id,
          content: data.content,
          imageUrls: imageUrls,
          isGenerating: false,
          generationPhase: GENERATION_PHASES.COMPLETE
        };

        return { messages: updatedMessages };
      });

      if (!data.content && !data.images?.length) {
        get().loadChats();
      }
    });

    wsManager.on('generation_error', (data) => {
      set({
        isGenerating: false,
        generationPhase: GENERATION_PHASES.ERROR,
        generationProgress: null
      });

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
