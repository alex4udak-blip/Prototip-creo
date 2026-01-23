import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Paperclip,
  X,
  Image,
  Loader2,
  CornerDownLeft,
  AlertCircle,
  CheckCircle,
  Settings2,
  Zap,
  MessageSquare,
  Search
} from 'lucide-react';
import { useChatStore } from '../../hooks/useChat';

// Toast component
function Toast({ message, type = 'error', onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
      <div className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg backdrop-blur-sm ${
        type === 'error' ? 'bg-error/90 text-white' : 'bg-success/90 text-white'
      }`}>
        {type === 'error' ? <AlertCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
        <span className="text-sm font-medium">{message}</span>
        <button onClick={onClose} className="ml-2 hover:opacity-70"><X className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

// Aspect ratios
const ASPECT_RATIOS = [
  { value: 'auto', label: 'Auto', icon: '🤖' },
  { value: '1:1', label: '1:1', icon: '⬜' },
  { value: '16:9', label: '16:9', icon: '🖼️' },
  { value: '9:16', label: '9:16', icon: '📱' },
  { value: '4:3', label: '4:3', icon: '📺' }
];

// Variants
const VARIANTS = [1, 2, 3, 4];

// Resolution
const RESOLUTIONS = [
  { value: '1K', label: '1K' },
  { value: '2K', label: '2K' },
  { value: '4K', label: '4K' }
];

export function InputArea() {
  const {
    sendMessage,
    isGenerating,
    attachedImages,
    addAttachedImage,
    removeAttachedImage,
    clearAttachedImages,
    settings,
    updateSettings
  } = useChatStore();

  const [message, setMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [toast, setToast] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  const showToast = (msg, type = 'error') => setToast({ message: msg, type });

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(Math.max(ta.scrollHeight, 52), 180) + 'px';
  }, []);

  useEffect(() => { adjustHeight(); }, [message, adjustHeight]);
  useEffect(() => { textareaRef.current?.focus(); }, []);

  // Send
  const handleSend = async () => {
    if ((!message.trim() && attachedImages.length === 0) || isGenerating) return;

    const prompt = message.trim();
    setMessage('');
    setShowSettings(false);
    if (textareaRef.current) textareaRef.current.style.height = '52px';

    try {
      await sendMessage(prompt, attachedImages);
    } catch (error) {
      showToast('Ошибка: ' + error.message);
    }
  };

  // File upload (множественные)
  const handleFiles = (files) => {
    const fileArray = Array.from(files);
    let added = 0;

    for (const file of fileArray) {
      if (attachedImages.length + added >= 14) {
        showToast('Максимум 14 картинок');
        break;
      }
      if (!file?.type.startsWith('image/')) {
        showToast('Только изображения');
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        showToast('Максимум 10MB на файл');
        continue;
      }
      addAttachedImage(file);
      added++;
    }

    if (added > 0) {
      showToast(`Добавлено ${added} картинок!`, 'success');
    }
  };

  // Drag & Drop (множественные)
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  // Keyboard
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = (message.trim() || attachedImages.length > 0) && !isGenerating;

  return (
    <div
      className={`border-t border-border bg-bg-primary transition-all ${isDragging ? 'bg-accent/5 border-accent' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Drag overlay */}
      {isDragging && (
        <div className="drag-overlay">
          <div className="text-center">
            <Image className="w-12 h-12 text-accent mx-auto mb-2" />
            <p className="text-lg font-medium">Отпустите для загрузки</p>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto p-4">
        {/* Settings Panel */}
        {showSettings && (
          <div className="mb-4 p-4 bg-bg-secondary rounded-2xl border border-border animate-slide-up">
            {/* Mode */}
            <div className="mb-4">
              <label className="text-xs text-text-muted uppercase mb-2 block">Режим</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => updateSettings({ mode: 'smart' })}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl transition ${
                    settings.mode === 'smart' ? 'bg-blue-500/20 text-blue-400 border-2 border-blue-500/30' : 'bg-bg-hover text-text-secondary'
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  <span className="text-sm font-medium">Умный</span>
                </button>
                <button
                  onClick={() => updateSettings({ mode: 'fast' })}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl transition ${
                    settings.mode === 'fast' ? 'bg-yellow-500/20 text-yellow-400 border-2 border-yellow-500/30' : 'bg-bg-hover text-text-secondary'
                  }`}
                >
                  <Zap className="w-4 h-4" />
                  <span className="text-sm font-medium">Быстрый</span>
                </button>
                {/* Deep Research button (like Genspark) */}
                <button
                  onClick={() => updateSettings({ deepResearch: !settings.deepResearch })}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl transition ${
                    settings.deepResearch ? 'bg-purple-500/20 text-purple-400 border-2 border-purple-500/30' : 'bg-bg-hover text-text-secondary'
                  }`}
                >
                  <Search className="w-4 h-4" />
                  <span className="text-sm font-medium">Глубокое исследование</span>
                </button>
              </div>
            </div>

            {/* Aspect Ratio */}
            <div className="mb-4">
              <label className="text-xs text-text-muted uppercase mb-2 block">Размер</label>
              <div className="flex flex-wrap gap-2">
                {ASPECT_RATIOS.map(ar => (
                  <button
                    key={ar.value}
                    onClick={() => updateSettings({ aspectRatio: ar.value })}
                    className={`px-3 py-1.5 rounded-lg text-sm transition ${
                      settings.aspectRatio === ar.value ? 'bg-accent text-white' : 'bg-bg-hover text-text-secondary hover:bg-bg-tertiary'
                    }`}
                  >
                    {ar.icon} {ar.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Variants */}
            <div className="mb-4">
              <label className="text-xs text-text-muted uppercase mb-2 block">Варианты</label>
              <div className="flex gap-2">
                {VARIANTS.map(v => (
                  <button
                    key={v}
                    onClick={() => updateSettings({ variants: v })}
                    className={`w-10 h-10 rounded-lg text-sm font-medium transition ${
                      settings.variants === v ? 'bg-accent text-white' : 'bg-bg-hover text-text-secondary hover:bg-bg-tertiary'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Resolution */}
            <div>
              <label className="text-xs text-text-muted uppercase mb-2 block">Качество</label>
              <div className="flex gap-2">
                {RESOLUTIONS.map(r => (
                  <button
                    key={r.value}
                    onClick={() => updateSettings({ resolution: r.value })}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      settings.resolution === r.value ? 'bg-accent text-white' : 'bg-bg-hover text-text-secondary hover:bg-bg-tertiary'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Attached images preview (до 14 референсов) */}
        {attachedImages.length > 0 && (
          <div className="mb-3 bg-bg-secondary rounded-xl p-3 animate-scale-in">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-text-muted">
                📎 {attachedImages.length} / 14 референсов
              </span>
              <button
                onClick={clearAttachedImages}
                className="text-xs text-error hover:underline"
              >
                Удалить все
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {attachedImages.map((img, index) => (
                <div key={index} className="relative group">
                  <img
                    src={URL.createObjectURL(img)}
                    alt={`Reference ${index + 1}`}
                    className="h-16 w-16 rounded-lg object-cover border border-border"
                  />
                  <button
                    onClick={() => removeAttachedImage(index)}
                    className="absolute -top-1 -right-1 p-1 bg-error rounded-full opacity-0 group-hover:opacity-100 transition shadow-md"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ))}
              {attachedImages.length < 14 && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="h-16 w-16 rounded-lg border-2 border-dashed border-border hover:border-accent flex items-center justify-center transition"
                >
                  <span className="text-2xl text-text-muted">+</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Main input */}
        <div className="relative bg-bg-secondary rounded-2xl border-2 border-transparent hover:border-border focus-within:border-accent/50 transition">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Опишите баннер..."
            className="w-full bg-transparent text-text-primary placeholder-text-muted resize-none px-4 py-3 pr-24 outline-none"
            style={{ minHeight: '52px', maxHeight: '180px' }}
            disabled={isGenerating}
          />

          <div className="flex items-center justify-between px-3 pb-3">
            <div className="flex items-center gap-1">
              {/* File input (множественный) */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = ''; }}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 hover:bg-bg-hover rounded-xl transition"
                title="Прикрепить картинку"
              >
                <Paperclip className="w-5 h-5 text-text-muted" />
              </button>

              {/* Settings */}
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded-xl transition ${showSettings ? 'bg-accent/20 text-accent' : 'hover:bg-bg-hover text-text-muted'}`}
                title="Настройки"
              >
                <Settings2 className="w-5 h-5" />
              </button>

              {/* Mode indicator */}
              <div className={`hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg ${
                settings.mode === 'fast' ? 'bg-yellow-500/10' : 'bg-blue-500/10'
              }`}>
                {settings.mode === 'fast' ? (
                  <Zap className="w-3.5 h-3.5 text-yellow-400" />
                ) : (
                  <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                )}
                <span className={`text-xs font-medium ${settings.mode === 'fast' ? 'text-yellow-400' : 'text-blue-400'}`}>
                  {settings.mode === 'fast' ? 'Быстрый' : 'Умный'}
                </span>
              </div>
            </div>

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={!canSend}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium text-sm transition ${
                canSend
                  ? 'bg-accent hover:bg-accent-hover text-white shadow-md hover:shadow-lg'
                  : 'bg-bg-hover text-text-muted cursor-not-allowed'
              }`}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Генерация...</span>
                </>
              ) : (
                <>
                  <CornerDownLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Enter</span>
                </>
              )}
            </button>
          </div>
        </div>

        <p className="text-xs text-text-muted mt-2 opacity-70">
          💡 Перетащите до 14 картинок • Нажмите ⚙️ для настроек
        </p>
      </div>
    </div>
  );
}

export default InputArea;
