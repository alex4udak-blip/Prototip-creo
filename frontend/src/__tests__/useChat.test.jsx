/**
 * Tests for useChat store (Zustand)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock API services
vi.mock('../services/api', () => ({
  chatsAPI: {
    getAll: vi.fn().mockResolvedValue([]),
    getById: vi.fn().mockResolvedValue({ id: 1, messages: [] }),
    create: vi.fn().mockResolvedValue({ id: 1, title: 'New Chat' }),
    delete: vi.fn().mockResolvedValue({}),
    rename: vi.fn().mockResolvedValue({ title: 'Renamed' })
  },
  generateAPI: {
    generate: vi.fn().mockResolvedValue({ messageId: 1 }),
    uploadReference: vi.fn().mockResolvedValue({ url: '/uploads/test.png', filename: 'test.png' }),
    getPresets: vi.fn().mockResolvedValue({}),
    getModels: vi.fn().mockResolvedValue([])
  },
  wsManager: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    on: vi.fn()
  }
}));

// Import store after mocks
import useChatStore from '../hooks/useChat';

describe('useChatStore', () => {
  beforeEach(() => {
    // Reset store state
    useChatStore.setState({
      chats: [],
      chatsLoading: false,
      currentChat: null,
      messages: [],
      chatLoading: false,
      isGenerating: false,
      generationStatus: null,
      generationProgress: null,
      attachedReference: null,
      settings: {
        model: 'auto',
        size: '1200x628',
        variations: 1
      },
      sizePresets: {},
      availableModels: []
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useChatStore());

      expect(result.current.chats).toEqual([]);
      expect(result.current.currentChat).toBeNull();
      expect(result.current.messages).toEqual([]);
      expect(result.current.isGenerating).toBe(false);
      expect(result.current.attachedReference).toBeNull();
      expect(result.current.settings.model).toBe('auto');
      expect(result.current.settings.size).toBe('1200x628');
    });
  });

  describe('Settings', () => {
    it('should update settings', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.updateSettings({ model: 'runware-flux-dev' });
      });

      expect(result.current.settings.model).toBe('runware-flux-dev');
    });

    it('should update size', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.updateSettings({ size: '1080x1080' });
      });

      expect(result.current.settings.size).toBe('1080x1080');
    });

    it('should update multiple settings at once', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.updateSettings({
          model: 'google-nano',
          size: '1200x628',
          variations: 2
        });
      });

      expect(result.current.settings.model).toBe('google-nano');
      expect(result.current.settings.variations).toBe(2);
    });
  });

  describe('References', () => {
    it('should set attached reference', () => {
      const { result } = renderHook(() => useChatStore());

      const reference = {
        url: '/uploads/test.png',
        filename: 'test.png'
      };

      act(() => {
        result.current.setAttachedReference(reference);
      });

      expect(result.current.attachedReference).toEqual(reference);
    });

    it('should clear attached reference', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.setAttachedReference({ url: '/test.png' });
      });

      expect(result.current.attachedReference).not.toBeNull();

      act(() => {
        result.current.clearAttachedReference();
      });

      expect(result.current.attachedReference).toBeNull();
    });
  });

  describe('Generation Progress', () => {
    it('should update generation progress', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.updateGenerationProgress({
          status: 'processing',
          message: 'Generating image...'
        });
      });

      expect(result.current.generationStatus).toBe('processing');
      expect(result.current.generationProgress).toBe('Generating image...');
    });

    it('should complete generation', () => {
      const { result } = renderHook(() => useChatStore());

      // First set up a message
      useChatStore.setState({
        isGenerating: true,
        messages: [{
          id: 1,
          role: 'assistant',
          content: 'Generating...',
          isGenerating: true
        }]
      });

      act(() => {
        result.current.completeGeneration({
          messageId: 1,
          images: ['/uploads/result.png'],
          model: 'flux-dev',
          timeMs: 5000
        });
      });

      expect(result.current.isGenerating).toBe(false);
      expect(result.current.generationStatus).toBe('complete');
      expect(result.current.messages[0].imageUrls).toEqual(['/uploads/result.png']);
      expect(result.current.messages[0].isGenerating).toBe(false);
    });

    it('should handle generation failure', () => {
      const { result } = renderHook(() => useChatStore());

      // Set up a message
      useChatStore.setState({
        isGenerating: true,
        messages: [{
          id: 1,
          role: 'assistant',
          content: 'Generating...',
          isGenerating: true
        }]
      });

      act(() => {
        result.current.failGeneration({
          messageId: 1,
          error: 'API Error'
        });
      });

      expect(result.current.isGenerating).toBe(false);
      expect(result.current.generationStatus).toBe('error');
      expect(result.current.messages[0].errorMessage).toBe('API Error');
    });
  });

  describe('Chat Selection', () => {
    it('should select chat and clear messages', async () => {
      const { result } = renderHook(() => useChatStore());

      // Set some initial state
      useChatStore.setState({
        currentChat: { id: 1 },
        messages: [{ id: 1, content: 'test' }]
      });

      await act(async () => {
        await result.current.selectChat(null);
      });

      expect(result.current.currentChat).toBeNull();
      expect(result.current.messages).toEqual([]);
    });
  });

  describe('Chat Management', () => {
    it('should add chat to list on create', async () => {
      const { result } = renderHook(() => useChatStore());

      await act(async () => {
        await result.current.createChat();
      });

      expect(result.current.chats.length).toBeGreaterThan(0);
      expect(result.current.chats[0].title).toBe('New Chat');
    });

    it('should remove chat from list on delete', async () => {
      const { result } = renderHook(() => useChatStore());

      // Add a chat first
      useChatStore.setState({
        chats: [{ id: 1, title: 'Test Chat' }]
      });

      await act(async () => {
        await result.current.deleteChat(1);
      });

      expect(result.current.chats).toHaveLength(0);
    });
  });
});
