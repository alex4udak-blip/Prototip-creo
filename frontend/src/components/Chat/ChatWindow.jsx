import { useEffect, useRef } from 'react';
import { Sparkles, Image, Zap } from 'lucide-react';
import { useChatStore } from '../../hooks/useChat';
import { Message } from './Message';
import { Logo } from '../UI/Logo';

/**
 * ChatWindow Component - Claude.ai Style
 *
 * ⭐ KEY DESIGN:
 * - Clean, minimal welcome screen
 * - Serif typography for content
 * - Warm, inviting design
 */
export function ChatWindow({ className = '' }) {
  const {
    currentChat,
    messages,
    chatLoading,
    isGenerating,
    sendMessage
  } = useChatStore();
  const messagesEndRef = useRef(null);

  // Autoscroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  // Handle example click
  const handleExampleClick = async (example) => {
    try {
      await sendMessage(example);
    } catch (error) {
      console.error('Generate error:', error);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // Empty state - Welcome screen (Claude style)
  // ═══════════════════════════════════════════════════════════════
  if (!currentChat && !chatLoading && messages.length === 0 && !isGenerating) {
    return (
      <div className={`flex-1 flex flex-col justify-center overflow-y-auto py-8 ${className}`}>
        <div className="text-center max-w-md mx-auto px-6">
          {/* Logo */}
          <div className="mx-auto mb-6">
            <Logo size="lg" />
          </div>

          {/* Welcome text */}
          <h2 className="text-2xl font-serif text-[var(--text-primary)] mb-2">
            Чем могу помочь?
          </h2>
          <p className="text-[var(--text-secondary)] font-serif mb-8">
            Опишите баннер, который хотите создать, или загрузите референс
          </p>

          {/* Features - subtle, horizontal */}
          <div className="flex justify-center gap-6 mb-8">
            <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <div className="w-8 h-8 rounded-xl bg-[var(--accent-light)]
                flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-[var(--accent)]" />
              </div>
              <span className="font-sans">Умные промпты</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <div className="w-8 h-8 rounded-xl bg-[var(--accent-light)]
                flex items-center justify-center">
                <Image className="w-4 h-4 text-[var(--accent)]" />
              </div>
              <span className="font-sans">До 14 референсов</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <div className="w-8 h-8 rounded-xl bg-[var(--accent-light)]
                flex items-center justify-center">
                <Zap className="w-4 h-4 text-[var(--accent)]" />
              </div>
              <span className="font-sans">5-10 сек</span>
            </div>
          </div>

          {/* Example prompts - Claude style buttons */}
          <div>
            <p className="text-xs text-[var(--text-muted)] mb-3 font-sans">
              Попробуйте один из примеров:
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                'Казино "Бонус 100%"',
                'Слот Book of Dead',
                'Ставки на футбол'
              ].map((example, i) => (
                <button
                  key={i}
                  onClick={() => handleExampleClick(example)}
                  disabled={isGenerating}
                  className="px-4 py-2 bg-[var(--bg-secondary)]
                    hover:bg-[var(--bg-hover)] border border-[var(--border)]
                    rounded-xl text-sm font-sans text-[var(--text-secondary)]
                    hover:text-[var(--text-primary)] transition-all
                    disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // Loading state
  // ═══════════════════════════════════════════════════════════════
  if (chatLoading) {
    return (
      <div className={`flex-1 flex items-center justify-center ${className}`}>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-[var(--accent)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-[var(--accent)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-[var(--accent)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-[var(--text-muted)] text-sm font-sans">Загрузка чата...</span>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // Chat with messages
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className={`flex-1 overflow-y-auto ${className}`}>
      <div className="max-w-3xl mx-auto px-4 py-6">
        {messages.length === 0 ? (
          // Empty chat placeholder
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-full bg-[var(--accent-light)]
              flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-6 h-6 text-[var(--accent)]" />
            </div>
            <p className="text-[var(--text-secondary)] font-serif">
              Опишите баннер, который хотите создать
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-2 font-sans">
              Можно на русском языке
            </p>
          </div>
        ) : (
          // Messages list
          <div className="space-y-2">
            {messages.map(message => (
              <Message key={message.id} message={message} />
            ))}
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} className="h-4" />
      </div>
    </div>
  );
}

export default ChatWindow;
