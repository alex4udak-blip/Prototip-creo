import { Menu, Zap } from 'lucide-react';
import { useChatStore } from '../../hooks/useChat';

export function Header({ onMenuClick }) {
  const { currentChat, isGenerating, generationProgress } = useChatStore();

  return (
    <header className="h-14 flex items-center justify-between px-4 border-b border-border glass">
      {/* Left: Menu button (mobile) + Chat title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 hover:bg-bg-secondary rounded-lg transition-colors"
          aria-label="Открыть меню"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <h1 className="font-medium text-text-primary truncate max-w-[200px] md:max-w-[400px]">
            {currentChat?.title || 'MST CREO AI'}
          </h1>

          {/* Generation indicator */}
          {isGenerating && (
            <div className="flex items-center gap-2 text-xs text-accent animate-pulse">
              <Zap className="w-4 h-4" />
              <span className="hidden sm:inline">
                {generationProgress || 'Генерирую...'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Right: Empty - settings removed */}
      <div className="flex items-center gap-2">
        {/* Placeholder for future actions */}
      </div>
    </header>
  );
}

export default Header;
