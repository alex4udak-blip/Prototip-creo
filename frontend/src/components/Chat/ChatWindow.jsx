import { useEffect, useRef } from 'react';
import { Sparkles, Wand2, Image, Zap } from 'lucide-react';
import { useChatStore } from '../../hooks/useChat';
import { Message } from './Message';

export function ChatWindow({ className = '' }) {
  const {
    currentChat,
    messages,
    chatLoading,
    isGenerating,
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

  // Empty state (нет чата И нет сообщений) - компактный дизайн
  // Важно: показываем welcome только если нет сообщений, т.к. сообщение может быть добавлено локально до создания чата
  if (!currentChat && !chatLoading && messages.length === 0 && !isGenerating) {
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
      {/* Status bar removed - теперь красивый статус показывается внутри сообщения */}

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
