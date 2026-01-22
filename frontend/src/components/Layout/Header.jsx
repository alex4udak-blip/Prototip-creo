import { Menu, Settings, Zap } from 'lucide-react';
import { useChatStore } from '../../hooks/useChat';

export function Header({ onMenuClick, onSettingsClick }) {
  const { currentChat, isGenerating, generationProgress } = useChatStore();

  return (
    <header className="h-14 flex items-center justify-between px-4 border-b border-border bg-bg-primary/50 backdrop-blur-sm">
      {/* Left: Menu button (mobile) + Chat title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 hover:bg-bg-secondary rounded-lg transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <h1 className="font-medium text-text-primary truncate max-w-[200px] md:max-w-[400px]">
            {currentChat?.title || 'BannerGen'}
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

      {/* Right: Settings */}
      <div className="flex items-center gap-2">
        <button
          onClick={onSettingsClick}
          className="p-2 hover:bg-bg-secondary rounded-lg transition-colors"
          title="Настройки генерации"
        >
          <Settings className="w-5 h-5 text-text-secondary hover:text-text-primary transition-colors" />
        </button>
      </div>
    </header>
  );
}

export default Header;
