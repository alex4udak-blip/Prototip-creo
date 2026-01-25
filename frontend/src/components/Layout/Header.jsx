import { Menu, Zap, Image, Layout } from 'lucide-react';
import { useChatStore } from '../../hooks/useChat';
import { Logo } from '../UI/Logo';

/**
 * Header Component with Mode Tabs
 * Claude.ai inspired design
 */
export function Header({ onMenuClick, mode, onModeChange }) {
  const { currentChat, isGenerating, generationProgress } = useChatStore();

  const tabs = [
    { id: 'banners', label: 'Banners', icon: Image },
    { id: 'landings', label: 'Landings', icon: Layout }
  ];

  return (
    <header className="h-14 flex items-center justify-between px-4
      bg-[var(--bg-secondary)] border-b border-[var(--border)]">

      {/* Left: Menu button (mobile) + Logo */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 rounded-lg text-[var(--text-muted)]
            hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]
            transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Logo */}
        <Logo size="md" className="hidden md:flex" />
      </div>

      {/* Center: Mode Tabs */}
      <nav className="flex gap-1 p-1 bg-[var(--bg-primary)] rounded-lg">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = mode === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onModeChange(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-1.5 rounded-md
                text-sm font-sans font-medium transition-all duration-200
                ${isActive
                  ? 'bg-[var(--accent-light)] text-[var(--accent)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                }
              `}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Right: Chat title or status */}
      <div className="flex items-center gap-3 min-w-[200px] justify-end">
        {mode === 'banners' && currentChat && (
          <div className="hidden md:flex items-center gap-2">
            <h1 className="font-serif font-medium text-[var(--text-primary)]
              truncate max-w-[180px]">
              {currentChat.title}
            </h1>

            {isGenerating && (
              <div className="flex items-center gap-1.5 text-xs font-sans
                text-[var(--accent)] animate-pulse-soft">
                <Zap className="w-3.5 h-3.5" />
                <span>{generationProgress || 'Generating...'}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;
