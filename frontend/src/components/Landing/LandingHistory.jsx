import { useEffect } from 'react';
import { Download, Trash2, Eye, Clock, FileCode2 } from 'lucide-react';
import { useLandingStore } from '../../hooks/useLanding';

/**
 * Landing History Component - Claude.ai Style
 * Shows list of previously generated landings
 */
export function LandingHistory({ onSelect }) {
  const { landings, isLoadingHistory, loadLandings, deleteLanding, loadLanding } = useLandingStore();

  useEffect(() => {
    loadLandings();
  }, []);

  const handleSelect = async (landing) => {
    await loadLanding(landing.landing_id);
    if (onSelect) onSelect(landing);
  };

  const handleDelete = async (e, landingId) => {
    e.stopPropagation();
    if (confirm('Удалить этот лендинг?')) {
      await deleteLanding(landingId);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Только что';
    if (diffMins < 60) return `${diffMins} мин назад`;
    if (diffHours < 24) return `${diffHours} ч назад`;
    if (diffDays < 7) return `${diffDays} дн назад`;

    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  const getMechanicIcon = (type) => {
    const icons = {
      wheel: '🎡',
      boxes: '🎁',
      crash: '🐔',
      board: '🎲',
      scratch: '🎫',
      loader: '⏳',
      slot: '🎰'
    };
    return icons[type] || '🎮';
  };

  if (isLoadingHistory) {
    return (
      <div className="p-4 text-center text-[var(--text-muted)]">
        <div className="flex justify-center gap-1 mb-2">
          <span className="w-2 h-2 bg-[var(--accent)] rounded-full animate-bounce"
            style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-[var(--accent)] rounded-full animate-bounce"
            style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-[var(--accent)] rounded-full animate-bounce"
            style={{ animationDelay: '300ms' }} />
        </div>
        <span className="font-sans text-sm">Загрузка...</span>
      </div>
    );
  }

  if (!landings || landings.length === 0) {
    return (
      <div className="p-8 text-center text-[var(--text-muted)]">
        <div className="w-12 h-12 rounded-2xl bg-[var(--bg-secondary)]
          flex items-center justify-center mx-auto mb-3">
          <FileCode2 className="w-6 h-6 opacity-40" />
        </div>
        <p className="font-serif font-medium text-[var(--text-secondary)]">
          Нет сохранённых лендингов
        </p>
        <p className="text-sm font-sans mt-1 opacity-60">
          Созданные лендинги появятся здесь
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-[var(--border)]">
      {landings.map((landing) => (
        <div
          key={landing.landing_id || landing.id}
          onClick={() => handleSelect(landing)}
          className="p-4 hover:bg-[var(--bg-hover)] cursor-pointer transition-colors group"
        >
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="w-10 h-10 rounded-xl bg-[var(--bg-secondary)]
              flex items-center justify-center text-xl">
              {getMechanicIcon(landing.type)}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-serif font-medium text-[var(--text-primary)] truncate">
                  {landing.slot_name || landing.type || 'Лендинг'}
                </h4>
                <span className="text-xs font-sans text-[var(--text-muted)]
                  px-2 py-0.5 bg-[var(--bg-secondary)] rounded-lg capitalize">
                  {landing.type}
                </span>
              </div>

              <div className="flex items-center gap-3 mt-1 text-xs font-sans text-[var(--text-muted)]">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDate(landing.created_at)}
                </span>
                {landing.language && (
                  <span className="uppercase">{landing.language}</span>
                )}
                {landing.downloads_count > 0 && (
                  <span className="flex items-center gap-1">
                    <Download className="w-3 h-3" />
                    {landing.downloads_count}
                  </span>
                )}
              </div>

              {/* Prizes preview */}
              {landing.prizes && landing.prizes.length > 0 && (
                <div className="flex items-center gap-1 mt-2 flex-wrap">
                  {landing.prizes.slice(0, 3).map((prize, i) => (
                    <span
                      key={i}
                      className="text-xs font-sans px-2 py-0.5
                        bg-[var(--accent-light)] text-[var(--accent)] rounded-lg"
                    >
                      {prize}
                    </span>
                  ))}
                  {landing.prizes.length > 3 && (
                    <span className="text-xs font-sans text-[var(--text-muted)]">
                      +{landing.prizes.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelect(landing);
                }}
                className="p-2 hover:bg-[var(--bg-secondary)] rounded-xl transition-colors"
                title="Просмотр"
              >
                <Eye className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
              <button
                onClick={(e) => handleDelete(e, landing.landing_id)}
                className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                title="Удалить"
              >
                <Trash2 className="w-4 h-4 text-red-500" />
              </button>
            </div>
          </div>

          {/* Palette preview */}
          {landing.palette && Object.keys(landing.palette).length > 0 && (
            <div className="flex items-center gap-1 mt-3 ml-13">
              {Object.values(landing.palette).slice(0, 4).map((color, i) => (
                <div
                  key={i}
                  className="w-4 h-4 rounded-full border border-[var(--border)]"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default LandingHistory;
