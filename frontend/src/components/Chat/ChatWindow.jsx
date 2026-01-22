import { useEffect, useRef } from 'react';
import { Sparkles, Wand2, Image, Zap } from 'lucide-react';
import { useChatStore } from '../../hooks/useChat';
import { Message } from './Message';

export function ChatWindow({ className = '' }) {
  const { currentChat, messages, chatLoading, isGenerating } = useChatStore();
  const messagesEndRef = useRef(null);

  // Автоскролл при новых сообщениях
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  // Empty state (нет чата)
  if (!currentChat && !chatLoading) {
    return (
      <div className={`flex-1 flex items-center justify-center ${className}`}>
        <div className="text-center max-w-md px-4">
          {/* Logo */}
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-accent to-accent-hover flex items-center justify-center">
            <Sparkles className="w-10 h-10 text-white" />
          </div>

          <h2 className="text-2xl font-bold text-text-primary mb-2">
            Добро пожаловать в BannerGen
          </h2>
          <p className="text-text-secondary mb-8">
            AI-генератор рекламных баннеров для арбитража трафика
          </p>

          {/* Features */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
            <div className="card">
              <Wand2 className="w-6 h-6 text-accent mb-2" />
              <h3 className="font-medium text-sm mb-1">Умные промпты</h3>
              <p className="text-xs text-text-muted">
                Пишите на русском — AI улучшит запрос
              </p>
            </div>

            <div className="card">
              <Image className="w-6 h-6 text-accent mb-2" />
              <h3 className="font-medium text-sm mb-1">Референсы</h3>
              <p className="text-xs text-text-muted">
                Перетащите картинку для стилизации
              </p>
            </div>

            <div className="card">
              <Zap className="w-6 h-6 text-accent mb-2" />
              <h3 className="font-medium text-sm mb-1">Быстро</h3>
              <p className="text-xs text-text-muted">
                Генерация за 5-10 секунд
              </p>
            </div>
          </div>

          {/* Examples */}
          <div className="mt-8">
            <p className="text-xs text-text-muted mb-3">Примеры запросов:</p>
            <div className="space-y-2">
              {[
                'Баннер для казино с текстом "Бонус 100%"',
                'Креатив под слот Book of Dead, яркий',
                'Спортивная ставка, футбол, зелёные тона'
              ].map((example, i) => (
                <button
                  key={i}
                  className="block w-full text-left px-4 py-2 bg-bg-secondary hover:bg-bg-hover rounded-lg text-sm text-text-secondary transition"
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
        <div className="typing-indicator">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    );
  }

  // Chat with messages
  return (
    <div className={`flex-1 overflow-y-auto ${className}`}>
      <div className="max-w-4xl mx-auto p-4">
        {messages.length === 0 ? (
          // Empty chat
          <div className="text-center py-12">
            <Sparkles className="w-12 h-12 text-accent mx-auto mb-4 opacity-50" />
            <p className="text-text-muted">
              Опишите баннер, который хотите создать
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
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

export default ChatWindow;
