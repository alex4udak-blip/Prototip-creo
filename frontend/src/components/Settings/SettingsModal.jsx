import { useEffect } from 'react';
import { X, Cpu, Ruler, Hash, Sparkles } from 'lucide-react';
import { useChatStore } from '../../hooks/useChat';

export function SettingsModal({ isOpen, onClose }) {
  const { settings, updateSettings, sizePresets, loadPresets } = useChatStore();

  // Загружаем пресеты при открытии
  useEffect(() => {
    if (isOpen) {
      loadPresets();
    }
  }, [isOpen, loadPresets]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-bg-secondary rounded-2xl border border-border w-full max-w-md mx-4 max-h-[90vh] overflow-hidden animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent" />
            Настройки генерации
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-bg-hover rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Model info - ВРЕМЕННО УПРОЩЕНО */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium mb-3">
              <Cpu className="w-4 h-4 text-text-muted" />
              Модель генерации
            </label>

            <div className="flex items-center gap-3 p-3 rounded-xl border border-accent bg-accent/10">
              <div className="w-10 h-10 rounded-lg bg-bg-primary flex items-center justify-center text-lg">
                🍌
              </div>
              <div className="text-left flex-1">
                <p className="font-medium">Nano Banana Pro</p>
                <p className="text-xs text-text-muted">Лучшая модель для текста и картинок</p>
              </div>
              <div className="w-2 h-2 rounded-full bg-accent" />
            </div>
          </div>

          {/* Size presets */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium mb-3">
              <Ruler className="w-4 h-4 text-text-muted" />
              Размер баннера
            </label>

            {Object.entries(sizePresets).map(([category, presets]) => (
              <div key={category} className="mb-3">
                <p className="text-xs text-text-muted mb-2 px-1 capitalize">{category}</p>
                <div className="grid grid-cols-2 gap-2">
                  {presets.map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => updateSettings({ size: `${preset.width}x${preset.height}` })}
                      className={`p-2 rounded-lg border text-left transition ${
                        settings.size === `${preset.width}x${preset.height}`
                          ? 'border-accent bg-accent/10'
                          : 'border-border hover:border-border-light'
                      }`}
                    >
                      <p className="text-sm font-medium truncate">{preset.name}</p>
                      <p className="text-xs text-text-muted">{preset.width}×{preset.height}</p>
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* Custom size input */}
            <div className="mt-3">
              <p className="text-xs text-text-muted mb-2 px-1">Или введите свой размер</p>
              <input
                type="text"
                value={settings.size}
                onChange={(e) => updateSettings({ size: e.target.value })}
                placeholder="1200x628"
                className="input text-sm"
              />
            </div>
          </div>

          {/* Variations */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium mb-3">
              <Hash className="w-4 h-4 text-text-muted" />
              Количество вариантов
            </label>

            <div className="flex gap-2">
              {[1, 2, 3, 4].map(num => (
                <button
                  key={num}
                  onClick={() => updateSettings({ variations: num })}
                  className={`flex-1 py-2 rounded-lg border transition ${
                    settings.variations === num
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border hover:border-border-light'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
            <p className="text-xs text-text-muted mt-2">
              Больше вариантов = дольше генерация
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <button onClick={onClose} className="w-full btn-primary">
            Готово
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
