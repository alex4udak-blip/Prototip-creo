import { Image, Layout } from 'lucide-react';

/**
 * Mode Tabs Component
 * Claude-style tabs for switching between Banners and Landings
 */
export function ModeTabs({ mode, onModeChange }) {
  const tabs = [
    { id: 'banners', label: 'Баннеры', icon: Image },
    { id: 'landings', label: 'Лендинги', icon: Layout }
  ];

  return (
    <div className="flex items-center gap-1 p-1 bg-bg-secondary rounded-lg">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = mode === tab.id;

        // Guard against undefined icons
        if (!Icon) return null;

        return (
          <button
            key={tab.id}
            onClick={() => onModeChange(tab.id)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium
              transition-all duration-200
              ${isActive
                ? 'bg-accent text-white shadow-sm'
                : 'text-text-muted hover:text-text-primary hover:bg-bg-primary'
              }
            `}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default ModeTabs;
