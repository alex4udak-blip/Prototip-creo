import { useEffect, useRef } from 'react';
import { Sparkles, Wand2, Image, Zap } from 'lucide-react';
import { useChatStore, PHASE_LABELS } from '../../hooks/useChat';
import { Message } from './Message';

/**
 * Global Generation Status Bar
 * Shows at the top when generating
 */
function GlobalGenerationStatus({ phase, progress }) {
  if (!phase) return null;

  const label = PHASE_LABELS[phase] || 'Обработка...';

  return (
    <div className="sticky top-0 z-10 bg-gradient-to-b from-bg-primary via-bg-primary to-transparent pb-4">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center gap-3 py-2 px-4 bg-accent/10 border border-accent/20 rounded-xl animate-fade-in">
          {/* Animated icon */}
          <div className="relative">
            <Sparkles className="w-4 h-4 text-accent animate-pulse" />
          </div>

          {/* Status text */}
          <span className="text-sm text-accent font-medium">
            {label}
          </span>

          {/* Progress message */}
          {progress && (
            <span className="text-xs text-text-muted">
              - {progress}
            </span>
          )}

          {/* Animated dots */}
          <div className="flex gap-0.5 ml-auto">
            <span className="w-1 h-1 rounded-full bg-accent animate-bounce-dot-1"></span>
            <span className="w-1 h-1 rounded-full bg-accent animate-bounce-dot-2"></span>
            <span className="w-1 h-1 rounded-full bg-accent animate-bounce-dot-3"></span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ChatWindow({ className = '' }) {
  const {
    currentChat,
    messages,
    chatLoading,
    isGenerating,
    generationPhase,
    generationProgress,
    generate
  } = useChatStore();
  const messagesEndRef = useRef(null);

  // Автоскролл при новых сообщениях
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  // Handle example click
  const handleExampleClick = async (example) => {
    try {
      await generate(example);
    } catch (error) {
      console.error('Generate error:', error);
    }
  };

  // Empty state (нет чата) - компактный дизайн
  if (!currentChat && !chatLoading) {
    return (
      <div className={`flex-1 flex flex-col justify-center overflow-y-auto py-4 ${className}`}>
        <div className="text-center max-w-lg mx-auto px-4">
          {/* Logo - меньше */}
          <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-gradient-to-br from-accent to-accent-hover flex items-center justify-center shadow-lg shadow-accent/20">
            <Sparkles className="w-7 h-7 text-white" />
          </div>

          <h2 className="text-xl font-bold text-text-primary mb-1">
            BannerGen
          </h2>
          <p className="text-sm text-text-secondary mb-4">
            AI-генератор баннеров для арбитража
          </p>

          {/* Features - горизонтально, компактно */}
          <div className="flex justify-center gap-6 mb-6 text-xs">
            <div className="flex items-center gap-1.5 text-text-muted">
              <Wand2 className="w-4 h-4 text-accent" />
              <span>Умные промпты</span>
            </div>
            <div className="flex items-center gap-1.5 text-text-muted">
              <Image className="w-4 h-4 text-accent" />
              <span>Референсы</span>
            </div>
            <div className="flex items-center gap-1.5 text-text-muted">
              <Zap className="w-4 h-4 text-accent" />
              <span>5-10 сек</span>
            </div>
          </div>

          {/* Examples - компактнее */}
          <div>
            <p className="text-xs text-text-muted mb-2">Попробуйте:</p>
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
                  className="px-3 py-1.5 bg-bg-secondary hover:bg-bg-hover rounded-lg text-xs text-text-secondary transition-all hover:text-text-primary disabled:opacity-50"
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

  // Loading state
  if (chatLoading) {
    return (
      <div className={`flex-1 flex items-center justify-center ${className}`}>
        <div className="flex items-center gap-3">
          <div className="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <span className="text-text-muted text-sm">Загрузка чата...</span>
        </div>
      </div>
    );
  }

  // Chat with messages
  return (
    <div className={`flex-1 overflow-y-auto ${className}`}>
      {/* Global status bar when generating */}
      {isGenerating && (
        <GlobalGenerationStatus phase={generationPhase} progress={generationProgress} />
      )}

      <div className="max-w-4xl mx-auto p-4">
        {messages.length === 0 ? (
          // Empty chat
          <div className="text-center py-12">
            <Sparkles className="w-12 h-12 text-accent mx-auto mb-4 opacity-50" />
            <p className="text-text-muted">
              Опишите баннер, который хотите создать
            </p>
            <p className="text-xs text-text-muted mt-2 opacity-70">
              Можно на русском языке
            </p>
          </div>
        ) : (
          // Messages
          <div className="space-y-4">
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
