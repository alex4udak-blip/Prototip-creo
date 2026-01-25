import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../hooks/useAuth';
import { useChatStore } from '../hooks/useChat';
import { useLandingStore } from '../hooks/useLanding';
import { Sidebar } from '../components/Layout/Sidebar';
import { Header } from '../components/Layout/Header';
import { ChatWindow } from '../components/Chat/ChatWindow';
import { InputArea } from '../components/Chat/InputArea';
import { LandingInput, LandingPreview, LandingProgress, LandingHistory } from '../components/Landing';

export function ChatPage() {
  const navigate = useNavigate();
  const { checkAuth } = useAuthStore();
  const { loadChats, initWebSocket, disconnectWebSocket } = useChatStore();
  const { reset: resetLanding, loadMechanics, cleanup: cleanupLanding, generationState } = useLandingStore();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [mode, setMode] = useState('banners'); // banners | landings

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

      // Загружаем механики для лендингов
      await loadMechanics();

      // Подключаем WebSocket
      initWebSocket();

      setIsLoading(false);
    };

    init();

    // Отключаем WebSocket при unmount
    return () => {
      disconnectWebSocket();
      cleanupLanding();
    };
  }, []);

  // Handle mode change
  const handleModeChange = (newMode) => {
    setMode(newMode);
    if (newMode === 'banners') {
      resetLanding();
    }
  };

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
      {/* Sidebar (desktop) - only for banners mode */}
      {mode === 'banners' && (
        <Sidebar className="hidden md:flex w-64 flex-shrink-0" />
      )}

      {/* Mobile sidebar overlay */}
      {sidebarOpen && mode === 'banners' && (
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
          mode={mode}
          onModeChange={handleModeChange}
        />

        {/* Banners Mode */}
        {mode === 'banners' && (
          <>
            <ChatWindow className="flex-1 overflow-hidden" />
            <InputArea />
          </>
        )}

        {/* Landings Mode */}
        {mode === 'landings' && (
          <div className="flex-1 flex overflow-hidden">
            {/* Left Panel: History + Progress */}
            <div className="w-80 flex-shrink-0 border-r border-border bg-bg-primary flex flex-col overflow-hidden">
              {/* Progress (if generating) */}
              {generationState !== 'idle' && (
                <div className="border-b border-border">
                  <LandingProgress />
                </div>
              )}

              {/* History */}
              <div className="flex-1 overflow-y-auto">
                <div className="px-4 py-3 border-b border-border">
                  <h3 className="text-sm font-medium text-text-secondary">История</h3>
                </div>
                <LandingHistory />
              </div>
            </div>

            {/* Right Panel: Preview */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <LandingPreview />
              <LandingInput />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default ChatPage;
