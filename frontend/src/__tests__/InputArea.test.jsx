/**
 * Tests for InputArea component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock the chat store
const mockSendMessage = vi.fn();
const mockAddAttachedImage = vi.fn();
const mockRemoveAttachedImage = vi.fn();
const mockClearAttachedImages = vi.fn();

vi.mock('../hooks/useChat', () => ({
  useChatStore: vi.fn(() => ({
    sendMessage: mockSendMessage,
    isGenerating: false,
    attachedImages: [],
    addAttachedImage: mockAddAttachedImage,
    removeAttachedImage: mockRemoveAttachedImage,
    clearAttachedImages: mockClearAttachedImages
  }))
}));

import { InputArea } from '../components/Chat/InputArea';
import { useChatStore } from '../hooks/useChat';

describe('InputArea', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useChatStore.mockReturnValue({
      sendMessage: mockSendMessage,
      isGenerating: false,
      attachedImages: [],
      addAttachedImage: mockAddAttachedImage,
      removeAttachedImage: mockRemoveAttachedImage,
      clearAttachedImages: mockClearAttachedImages
    });
  });

  it('should render textarea and buttons', () => {
    render(<InputArea />);

    expect(screen.getByPlaceholderText(/Опишите баннер/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Создать/i })).toBeInTheDocument();
  });

  it('should have disabled send button when empty', () => {
    render(<InputArea />);

    const sendButton = screen.getByRole('button', { name: /Создать/i });
    expect(sendButton).toBeDisabled();
  });

  it('should enable send button when text is entered', async () => {
    render(<InputArea />);

    const textarea = screen.getByPlaceholderText(/Опишите баннер/i);
    await userEvent.type(textarea, 'Create a casino banner');

    const sendButton = screen.getByRole('button', { name: /Создать/i });
    expect(sendButton).not.toBeDisabled();
  });

  it('should call sendMessage on submit', async () => {
    mockSendMessage.mockResolvedValue({});
    render(<InputArea />);

    const textarea = screen.getByPlaceholderText(/Опишите баннер/i);
    await userEvent.type(textarea, 'Create a casino banner');

    const sendButton = screen.getByRole('button', { name: /Создать/i });
    await userEvent.click(sendButton);

    expect(mockSendMessage).toHaveBeenCalledWith('Create a casino banner', []);
  });

  it('should clear textarea after sending', async () => {
    mockSendMessage.mockResolvedValue({});
    render(<InputArea />);

    const textarea = screen.getByPlaceholderText(/Опишите баннер/i);
    await userEvent.type(textarea, 'Test message');
    await userEvent.click(screen.getByRole('button', { name: /Создать/i }));

    await waitFor(() => {
      expect(textarea).toHaveValue('');
    });
  });

  it('should show loading state when generating', () => {
    useChatStore.mockReturnValue({
      sendMessage: mockSendMessage,
      isGenerating: true,
      attachedImages: [],
      addAttachedImage: mockAddAttachedImage,
      removeAttachedImage: mockRemoveAttachedImage,
      clearAttachedImages: mockClearAttachedImages
    });

    render(<InputArea />);

    expect(screen.getByText(/Генерация/i)).toBeInTheDocument();
  });

  it('should disable textarea when generating', () => {
    useChatStore.mockReturnValue({
      sendMessage: mockSendMessage,
      isGenerating: true,
      attachedImages: [],
      addAttachedImage: mockAddAttachedImage,
      removeAttachedImage: mockRemoveAttachedImage,
      clearAttachedImages: mockClearAttachedImages
    });

    render(<InputArea />);

    const textarea = screen.getByPlaceholderText(/Опишите баннер/i);
    expect(textarea).toBeDisabled();
  });

  it('should show attached images count', () => {
    const mockFiles = [
      new File([''], 'test1.png', { type: 'image/png' }),
      new File([''], 'test2.png', { type: 'image/png' })
    ];

    useChatStore.mockReturnValue({
      sendMessage: mockSendMessage,
      isGenerating: false,
      attachedImages: mockFiles,
      addAttachedImage: mockAddAttachedImage,
      removeAttachedImage: mockRemoveAttachedImage,
      clearAttachedImages: mockClearAttachedImages
    });

    render(<InputArea />);

    expect(screen.getByText(/2 референса/i)).toBeInTheDocument();
  });

  it('should call clearAttachedImages when clicking delete all', async () => {
    const mockFiles = [
      new File([''], 'test1.png', { type: 'image/png' })
    ];

    useChatStore.mockReturnValue({
      sendMessage: mockSendMessage,
      isGenerating: false,
      attachedImages: mockFiles,
      addAttachedImage: mockAddAttachedImage,
      removeAttachedImage: mockRemoveAttachedImage,
      clearAttachedImages: mockClearAttachedImages
    });

    render(<InputArea />);

    const deleteAllButton = screen.getByText(/Удалить все/i);
    await userEvent.click(deleteAllButton);

    expect(mockClearAttachedImages).toHaveBeenCalled();
  });

  it('should submit on Enter key', async () => {
    mockSendMessage.mockResolvedValue({});
    render(<InputArea />);

    const textarea = screen.getByPlaceholderText(/Опишите баннер/i);
    await userEvent.type(textarea, 'Test message');
    await userEvent.keyboard('{Enter}');

    expect(mockSendMessage).toHaveBeenCalled();
  });

  it('should not submit on Shift+Enter', async () => {
    render(<InputArea />);

    const textarea = screen.getByPlaceholderText(/Опишите баннер/i);
    await userEvent.type(textarea, 'Test message');
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}');

    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('should show hint text', () => {
    render(<InputArea />);

    expect(screen.getByText(/Перетащите референсы/i)).toBeInTheDocument();
    expect(screen.getByText(/Enter для отправки/i)).toBeInTheDocument();
  });
});
