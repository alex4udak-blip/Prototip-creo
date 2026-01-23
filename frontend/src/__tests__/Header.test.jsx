/**
 * Tests for Header component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock the chat store
vi.mock('../hooks/useChat', () => ({
  useChatStore: vi.fn(() => ({
    currentChat: null,
    isGenerating: false,
    generationProgress: null
  }))
}));

import { Header } from '../components/Layout/Header';
import { useChatStore } from '../hooks/useChat';

describe('Header', () => {
  const mockOnMenuClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useChatStore.mockReturnValue({
      currentChat: null,
      isGenerating: false,
      generationProgress: null
    });
  });

  it('should render default title when no chat selected', () => {
    render(<Header onMenuClick={mockOnMenuClick} />);

    expect(screen.getByText('MST CREO AI')).toBeInTheDocument();
  });

  it('should render chat title when chat is selected', () => {
    useChatStore.mockReturnValue({
      currentChat: { id: 1, title: 'Casino Banner Project' },
      isGenerating: false,
      generationProgress: null
    });

    render(<Header onMenuClick={mockOnMenuClick} />);

    expect(screen.getByText('Casino Banner Project')).toBeInTheDocument();
  });

  it('should call onMenuClick when menu button is clicked', async () => {
    render(<Header onMenuClick={mockOnMenuClick} />);

    const menuButton = screen.getByRole('button', { name: /меню/i });
    await userEvent.click(menuButton);

    expect(mockOnMenuClick).toHaveBeenCalledTimes(1);
  });

  it('should show generation indicator when generating', () => {
    useChatStore.mockReturnValue({
      currentChat: null,
      isGenerating: true,
      generationProgress: 'Создаю изображение...'
    });

    render(<Header onMenuClick={mockOnMenuClick} />);

    expect(screen.getByText(/Создаю изображение/i)).toBeInTheDocument();
  });

  it('should show default progress text when generating without message', () => {
    useChatStore.mockReturnValue({
      currentChat: null,
      isGenerating: true,
      generationProgress: null
    });

    render(<Header onMenuClick={mockOnMenuClick} />);

    expect(screen.getByText(/Генерирую/i)).toBeInTheDocument();
  });

  it('should not show generation indicator when not generating', () => {
    useChatStore.mockReturnValue({
      currentChat: null,
      isGenerating: false,
      generationProgress: null
    });

    render(<Header onMenuClick={mockOnMenuClick} />);

    expect(screen.queryByText(/Генерирую/i)).not.toBeInTheDocument();
  });

  it('should not have settings button (removed in refactoring)', () => {
    render(<Header onMenuClick={mockOnMenuClick} />);

    // Settings button should not exist
    expect(screen.queryByTitle(/Настройки/i)).not.toBeInTheDocument();
  });
});
