/**
 * Tests for Message component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock the chat store
vi.mock('../hooks/useChat', () => ({
  useChatStore: vi.fn(() => ({})),
  GENERATION_PHASES: {
    IDLE: 'idle',
    GENERATING: 'generating',
    COMPLETE: 'complete',
    ERROR: 'error'
  },
  PHASE_LABELS: {
    idle: '',
    generating: 'Генерирую...',
    complete: 'Готово!',
    error: 'Ошибка'
  }
}));

import { Message } from '../components/Chat/Message';

describe('Message', () => {
  describe('User Message', () => {
    it('should render user message content', () => {
      const message = {
        id: '1',
        role: 'user',
        content: 'Create a casino banner',
        createdAt: new Date().toISOString()
      };

      render(<Message message={message} />);

      expect(screen.getByText('Create a casino banner')).toBeInTheDocument();
      expect(screen.getByText('Вы')).toBeInTheDocument();
    });

    it('should show user avatar', () => {
      const message = {
        id: '1',
        role: 'user',
        content: 'Test message',
        createdAt: new Date().toISOString()
      };

      render(<Message message={message} />);

      // User icon should be present
      expect(screen.getByText('Вы')).toBeInTheDocument();
    });

    it('should show reference images for user message', () => {
      const message = {
        id: '1',
        role: 'user',
        content: 'Test with refs',
        imageUrls: ['/uploads/ref1.png', '/uploads/ref2.png'],
        createdAt: new Date().toISOString()
      };

      render(<Message message={message} />);

      expect(screen.getByText(/2 референс/i)).toBeInTheDocument();
      const images = screen.getAllByRole('img');
      expect(images).toHaveLength(2);
    });
  });

  describe('Assistant Message', () => {
    it('should render assistant message content', () => {
      const message = {
        id: '1',
        role: 'assistant',
        content: 'Here is your banner!',
        createdAt: new Date().toISOString()
      };

      render(<Message message={message} />);

      expect(screen.getByText('Here is your banner!')).toBeInTheDocument();
      expect(screen.getByText('MST CREO AI')).toBeInTheDocument();
    });

    it('should show sparkles icon for assistant', () => {
      const message = {
        id: '1',
        role: 'assistant',
        content: 'Test',
        createdAt: new Date().toISOString()
      };

      render(<Message message={message} />);

      expect(screen.getByText('MST CREO AI')).toBeInTheDocument();
    });

    it('should show generated images', () => {
      const message = {
        id: '1',
        role: 'assistant',
        content: 'Generated banners',
        imageUrls: ['/uploads/banner1.png', '/uploads/banner2.png', '/uploads/banner3.png'],
        createdAt: new Date().toISOString()
      };

      render(<Message message={message} />);

      expect(screen.getByText(/3 вариации/i)).toBeInTheDocument();
      const images = screen.getAllByRole('img');
      expect(images).toHaveLength(3);
    });

    it('should show download all button for multiple images', () => {
      const message = {
        id: '1',
        role: 'assistant',
        content: 'Generated',
        imageUrls: ['/uploads/1.png', '/uploads/2.png'],
        createdAt: new Date().toISOString()
      };

      render(<Message message={message} />);

      expect(screen.getByText(/Скачать все/i)).toBeInTheDocument();
    });

    it('should show quick action buttons', () => {
      const message = {
        id: '1',
        role: 'assistant',
        content: 'Generated',
        imageUrls: ['/uploads/1.png'],
        createdAt: new Date().toISOString()
      };

      render(<Message message={message} />);

      expect(screen.getByText(/Ещё варианты/i)).toBeInTheDocument();
    });
  });

  describe('Generating State', () => {
    it('should show generation status indicator', () => {
      const message = {
        id: '1',
        role: 'assistant',
        content: null,
        isGenerating: true,
        generationStatus: 'analyzing',
        generationProgress: 'Анализирую запрос...',
        createdAt: new Date().toISOString()
      };

      render(<Message message={message} />);

      expect(screen.getByText(/Анализирую/i)).toBeInTheDocument();
    });

    it('should show typing cursor during generation', () => {
      const message = {
        id: '1',
        role: 'assistant',
        content: 'Partial text',
        isGenerating: true,
        createdAt: new Date().toISOString()
      };

      render(<Message message={message} />);

      expect(screen.getByText(/▋/)).toBeInTheDocument();
    });

    it('should show partial text during streaming', () => {
      const message = {
        id: '1',
        role: 'assistant',
        content: null,
        partialText: 'Streaming text...',
        isGenerating: true,
        createdAt: new Date().toISOString()
      };

      render(<Message message={message} />);

      expect(screen.getByText(/Streaming text/i)).toBeInTheDocument();
    });

    it('should show tool use indicators', () => {
      const message = {
        id: '1',
        role: 'assistant',
        content: null,
        isGenerating: true,
        activeTools: [
          { tool: 'image_understanding', label: 'Понимание изображения', status: 'running' },
          { tool: 'thinking', label: 'Думаю...', status: 'running' }
        ],
        createdAt: new Date().toISOString()
      };

      render(<Message message={message} />);

      expect(screen.getByText(/Понимание изображения/i)).toBeInTheDocument();
      expect(screen.getByText(/Думаю/i)).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should show error message', () => {
      const message = {
        id: '1',
        role: 'assistant',
        content: null,
        errorMessage: 'Запрос заблокирован модерацией',
        createdAt: new Date().toISOString()
      };

      render(<Message message={message} />);

      expect(screen.getByText(/заблокирован модерацией/i)).toBeInTheDocument();
    });
  });

  describe('Markdown Parsing', () => {
    it('should remove ** from text', () => {
      const message = {
        id: '1',
        role: 'assistant',
        content: 'This is **bold** text',
        createdAt: new Date().toISOString()
      };

      render(<Message message={message} />);

      expect(screen.getByText(/This is bold text/i)).toBeInTheDocument();
      expect(screen.queryByText(/\*\*/)).not.toBeInTheDocument();
    });

    it('should convert - to bullet points', () => {
      const message = {
        id: '1',
        role: 'assistant',
        content: '- Item 1\n- Item 2',
        createdAt: new Date().toISOString()
      };

      render(<Message message={message} />);

      expect(screen.getByText(/• Item 1/)).toBeInTheDocument();
    });
  });

  describe('Image Preview', () => {
    it('should open preview on image click', async () => {
      const message = {
        id: '1',
        role: 'assistant',
        content: 'Banner',
        imageUrls: ['/uploads/banner.png'],
        createdAt: new Date().toISOString()
      };

      render(<Message message={message} />);

      const image = screen.getByRole('img');
      await userEvent.click(image);

      // Preview modal should be visible - there are multiple "Скачать" buttons
      const downloadButtons = screen.getAllByText(/Скачать/i);
      expect(downloadButtons.length).toBeGreaterThan(0);
    });
  });
});
