/**
 * Tests for useChat store (Zustand)
 * Updated for simplified version without settings
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
    sendWithFormData: vi.fn().mockResolvedValue({ chatId: 1, userMessageId: 1 })
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
import useChatStore, { GENERATION_PHASES } from '../hooks/useChat';

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
      generationPhase: GENERATION_PHASES.IDLE,
      generationProgress: null,
      attachedImages: []
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useChatStore());

      expect(result.current.chats).toEqual([]);
      expect(result.current.currentChat).toBeNull();
      expect(result.current.messages).toEqual([]);
      expect(result.current.isGenerating).toBe(false);
      expect(result.current.attachedImages).toEqual([]);
      expect(result.current.generationPhase).toBe(GENERATION_PHASES.IDLE);
    });
  });

  describe('Attached Images (References)', () => {
    it('should add attached image', () => {
      const { result } = renderHook(() => useChatStore());

      const mockFile = new File([''], 'test.png', { type: 'image/png' });

      act(() => {
        result.current.addAttachedImage(mockFile);
      });

      expect(result.current.attachedImages).toHaveLength(1);
      expect(result.current.attachedImages[0]).toBe(mockFile);
    });

    it('should limit to 14 images', () => {
      const { result } = renderHook(() => useChatStore());

      // Add 15 images
      act(() => {
        for (let i = 0; i < 15; i++) {
          const mockFile = new File([''], `test${i}.png`, { type: 'image/png' });
          result.current.addAttachedImage(mockFile);
        }
      });

      expect(result.current.attachedImages).toHaveLength(14);
    });

    it('should remove attached image by index', () => {
      const { result } = renderHook(() => useChatStore());

      const file1 = new File([''], 'test1.png', { type: 'image/png' });
      const file2 = new File([''], 'test2.png', { type: 'image/png' });

      act(() => {
        result.current.addAttachedImage(file1);
        result.current.addAttachedImage(file2);
      });

      expect(result.current.attachedImages).toHaveLength(2);

      act(() => {
        result.current.removeAttachedImage(0);
      });

      expect(result.current.attachedImages).toHaveLength(1);
      expect(result.current.attachedImages[0]).toBe(file2);
    });

    it('should clear all attached images', () => {
      const { result } = renderHook(() => useChatStore());

      act(() => {
        result.current.addAttachedImage(new File([''], 'test1.png', { type: 'image/png' }));
        result.current.addAttachedImage(new File([''], 'test2.png', { type: 'image/png' }));
      });

      expect(result.current.attachedImages).toHaveLength(2);

      act(() => {
        result.current.clearAttachedImages();
      });

      expect(result.current.attachedImages).toHaveLength(0);
    });

    it('should set multiple attached images at once', () => {
      const { result } = renderHook(() => useChatStore());

      const files = [
        new File([''], 'test1.png', { type: 'image/png' }),
        new File([''], 'test2.png', { type: 'image/png' }),
        new File([''], 'test3.png', { type: 'image/png' })
      ];

      act(() => {
        result.current.setAttachedImages(files);
      });

      expect(result.current.attachedImages).toHaveLength(3);
    });
  });

  describe('Messages', () => {
    it('should add message', () => {
      const { result } = renderHook(() => useChatStore());

      const message = {
        id: 'test-1',
        role: 'user',
        content: 'Hello',
        createdAt: new Date().toISOString()
      };

      act(() => {
        result.current.addMessage(message);
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].content).toBe('Hello');
    });

    it('should update message', () => {
      const { result } = renderHook(() => useChatStore());

      useChatStore.setState({
        messages: [{
          id: 'test-1',
          role: 'assistant',
          content: 'Initial',
          isGenerating: true
        }]
      });

      act(() => {
        result.current.updateMessage('test-1', {
          content: 'Updated',
          isGenerating: false
        });
      });

      expect(result.current.messages[0].content).toBe('Updated');
      expect(result.current.messages[0].isGenerating).toBe(false);
    });
  });

  describe('Chat Selection', () => {
    it('should select chat and clear messages', async () => {
      const { result } = renderHook(() => useChatStore());

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

      useChatStore.setState({
        chats: [{ id: 1, title: 'Test Chat' }]
      });

      await act(async () => {
        await result.current.deleteChat(1);
      });

      expect(result.current.chats).toHaveLength(0);
    });
  });

  describe('Generation Phases', () => {
    it('should have correct phase constants', () => {
      expect(GENERATION_PHASES.IDLE).toBe('idle');
      expect(GENERATION_PHASES.GENERATING).toBe('generating');
      expect(GENERATION_PHASES.COMPLETE).toBe('complete');
      expect(GENERATION_PHASES.ERROR).toBe('error');
    });
  });
});
