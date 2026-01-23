import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../hooks/useAuth';
import { useChatStore } from '../hooks/useChat';
import { Sidebar } from '../components/Layout/Sidebar';
import { Header } from '../components/Layout/Header';
import { ChatWindow } from '../components/Chat/ChatWindow';
import { InputArea } from '../components/Chat/InputArea';

export function ChatPage() {
  const navigate = useNavigate();
  const { isAuthenticated, checkAuth } = useAuthStore();
  const { loadChats, initWebSocket, disconnectWebSocket } = useChatStore();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Проверка авторизации при загрузке
  useEffect(() => {
    const init = async () => {
      const authed = await checkAuth();
      if (!authed) {
        navigate('/');
        return;
      }

      // Загружаем чаты
      await loadChats();

      // Подключаем WebSocket
      initWebSocket();

      setIsLoading(false);
    };

    init();

    // Отключаем WebSocket при unmount
    return () => {
      disconnectWebSocket();
    };
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg-primary">
        <div className="text-center">
          <div className="typing-indicator mb-4">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <p className="text-text-muted">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-bg-chat overflow-hidden">
      {/* Sidebar (desktop) */}
      <Sidebar className="hidden md:flex w-64 flex-shrink-0" />

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <Sidebar
            className="w-64 h-full animate-slide-down"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
        />

        <ChatWindow className="flex-1 overflow-hidden" />

        <InputArea />
      </main>
    </div>
  );
}

export default ChatPage;
