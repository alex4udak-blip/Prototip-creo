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
  ChevronDown,
  ChevronUp,
  Zap,
  Brain,
  MessageSquare,
  Sparkles,
  Grid2X2,
  Maximize2,
  Copy
} from 'lucide-react';
import { useChatStore } from '../../hooks/useChat';

// Toast notification component
function Toast({ message, type = 'error', onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
      <div className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg backdrop-blur-sm ${
        type === 'error'
          ? 'bg-error/90 text-white'
          : 'bg-success/90 text-white'
      }`}>
        {type === 'error' ? (
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
        ) : (
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
        )}
        <span className="text-sm font-medium">{message}</span>
        <button onClick={onClose} className="ml-2 hover:opacity-70 transition">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Generation Modes
const GENERATION_MODES = [
  {
    id: 'smart',
    label: 'Умный',
    description: 'Задаёт уточняющие вопросы для лучшего результата',
    icon: MessageSquare,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30'
  },
  {
    id: 'fast',
    label: 'Быстрый',
    description: 'Генерация сразу без вопросов',
    icon: Zap,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30'
  },
  {
    id: 'deep',
    label: 'Глубокий',
    description: 'Расширенный анализ Claude для сложных задач',
    icon: Brain,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30'
  }
];

// Size presets
const SIZE_PRESETS = {
  social: [
    { label: 'FB/Insta пост', value: '1080x1080', icon: '📱' },
    { label: 'FB ссылка', value: '1200x628', icon: '🔗' },
    { label: 'Stories', value: '1080x1920', icon: '📲' },
    { label: 'Twitter', value: '1200x675', icon: '🐦' },
  ],
  ads: [
    { label: 'Баннер 300×250', value: '300x250', icon: '📊' },
    { label: 'Баннер 728×90', value: '728x90', icon: '📏' },
    { label: 'Баннер 160×600', value: '160x600', icon: '📐' },
    { label: 'Баннер 320×50', value: '320x50', icon: '📱' },
  ],
  custom: [
    { label: 'Квадрат', value: '1024x1024', icon: '⬜' },
    { label: 'Широкий', value: '1920x1080', icon: '🖼️' },
    { label: 'Портрет', value: '768x1024', icon: '🎨' },
  ]
};

// Image count options
const IMAGE_COUNTS = [1, 2, 4];

const MIN_HEIGHT = 52;
const MAX_HEIGHT = 180;
const LINE_HEIGHT = 24;

export function InputArea() {
  const {
    generate,
    quickGenerate,
    isGenerating,
    attachedReference,
    clearAttachedReference,
    uploadReference,
    settings,
    updateSettings
  } = useChatStore();

  const [message, setMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [toast, setToast] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState('social');

  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  // Show toast
  const showToast = (msg, type = 'error') => {
    setToast({ message: msg, type });
  };

  // Get current mode config
  const currentMode = GENERATION_MODES.find(m => m.id === (settings.mode || 'smart')) || GENERATION_MODES[0];

  // Auto-expand textarea
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;
    const newHeight = Math.min(Math.max(scrollHeight, MIN_HEIGHT), MAX_HEIGHT);
    textarea.style.height = `${newHeight}px`;
    textarea.style.overflowY = scrollHeight > MAX_HEIGHT ? 'auto' : 'hidden';
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [message, adjustTextareaHeight]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Send message
  const handleSend = async () => {
    if ((!message.trim() && !attachedReference) || isGenerating) return;

    const prompt = message.trim();
    setMessage('');
    setShowSettings(false);

    if (textareaRef.current) {
      textareaRef.current.style.height = `${MIN_HEIGHT}px`;
    }

    try {
      if (settings.mode === 'fast') {
        // Быстрая генерация без вопросов
        await quickGenerate(prompt);
      } else {
        // Умная или глубокая генерация
        await generate(prompt, { deepThinking: settings.mode === 'deep' });
      }
    } catch (error) {
      console.error('Generate error:', error);
      showToast('Ошибка: ' + error.message, 'error');
    }
  };

  // File upload
  const handleFileUpload = async (file) => {
    if (!file || !file.type.startsWith('image/')) {
      showToast('Только изображения (JPEG, PNG, WebP, GIF)', 'error');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showToast('Максимальный размер: 10MB', 'error');
      return;
    }

    setIsUploading(true);
    try {
      await uploadReference(file);
      showToast('Референс загружен!', 'success');
    } catch (error) {
      console.error('Upload error:', error);
      showToast('Ошибка загрузки: ' + error.message, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // Drag & Drop
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  // Keyboard
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Update settings
  const selectSize = (size) => {
    updateSettings({ size });
  };

  const selectMode = (mode) => {
    updateSettings({ mode });
  };

  const selectImageCount = (count) => {
    updateSettings({ variations: count });
  };

  const canSend = (message.trim() || attachedReference) && !isGenerating;

  return (
    <div
      className={`border-t border-border bg-bg-primary transition-all duration-200 ${
        isDragging ? 'bg-accent/5 border-accent' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Toast */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* Drag overlay */}
      {isDragging && (
        <div className="drag-overlay">
          <div className="text-center">
            <Image className="w-12 h-12 text-accent mx-auto mb-2" />
            <p className="text-lg font-medium">Отпустите для загрузки референса</p>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto p-4">
        {/* Settings Panel (collapsible) */}
        {showSettings && (
          <div className="mb-4 p-4 bg-bg-secondary rounded-2xl border border-border animate-slide-up">
            {/* Generation Mode */}
            <div className="mb-4">
              <label className="text-xs text-text-muted uppercase tracking-wide mb-2 block">
                Режим генерации
              </label>
              <div className="grid grid-cols-3 gap-2">
                {GENERATION_MODES.map(mode => {
                  const Icon = mode.icon;
                  const isActive = (settings.mode || 'smart') === mode.id;
                  return (
                    <button
                      key={mode.id}
                      onClick={() => selectMode(mode.id)}
                      className={`p-3 rounded-xl border-2 transition-all duration-200 text-left ${
                        isActive
                          ? `${mode.bgColor} ${mode.borderColor} ${mode.color}`
                          : 'bg-bg-hover border-transparent hover:border-border'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className={`w-4 h-4 ${isActive ? mode.color : 'text-text-muted'}`} />
                        <span className={`text-sm font-medium ${isActive ? mode.color : 'text-text-primary'}`}>
                          {mode.label}
                        </span>
                      </div>
                      <p className="text-xs text-text-muted line-clamp-2">
                        {mode.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Image Count */}
            <div className="mb-4">
              <label className="text-xs text-text-muted uppercase tracking-wide mb-2 block">
                Количество изображений
              </label>
              <div className="flex gap-2">
                {IMAGE_COUNTS.map(count => (
                  <button
                    key={count}
                    onClick={() => selectImageCount(count)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200 ${
                      settings.variations === count
                        ? 'bg-accent text-white'
                        : 'bg-bg-hover hover:bg-bg-tertiary text-text-secondary'
                    }`}
                  >
                    {count === 1 ? (
                      <Maximize2 className="w-4 h-4" />
                    ) : count === 2 ? (
                      <Copy className="w-4 h-4" />
                    ) : (
                      <Grid2X2 className="w-4 h-4" />
                    )}
                    <span className="text-sm font-medium">{count}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Size Presets */}
            <div>
              <label className="text-xs text-text-muted uppercase tracking-wide mb-2 block">
                Размер изображения
              </label>

              {/* Tabs */}
              <div className="flex gap-1 mb-3 bg-bg-hover rounded-lg p-1">
                {Object.keys(SIZE_PRESETS).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      activeTab === tab
                        ? 'bg-bg-secondary text-text-primary shadow-sm'
                        : 'text-text-muted hover:text-text-secondary'
                    }`}
                  >
                    {tab === 'social' ? 'Соцсети' : tab === 'ads' ? 'Реклама' : 'Другое'}
                  </button>
                ))}
              </div>

              {/* Size buttons */}
              <div className="grid grid-cols-2 gap-2">
                {SIZE_PRESETS[activeTab].map(size => (
                  <button
                    key={size.value}
                    onClick={() => selectSize(size.value)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all duration-200 ${
                      settings.size === size.value
                        ? 'bg-accent/20 border-2 border-accent/50 text-accent'
                        : 'bg-bg-hover border-2 border-transparent hover:border-border text-text-secondary'
                    }`}
                  >
                    <span className="text-lg">{size.icon}</span>
                    <div>
                      <div className="text-sm font-medium">{size.label}</div>
                      <div className="text-xs opacity-60">{size.value}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Reference preview */}
        {attachedReference && (
          <div className="mb-3 inline-flex items-start gap-2 bg-bg-secondary rounded-xl p-2 animate-scale-in">
            <img
              src={attachedReference.url}
              alt="Reference"
              className="h-16 w-auto rounded-lg object-cover"
            />
            <button
              onClick={clearAttachedReference}
              className="p-1 hover:bg-error/20 rounded-lg transition-colors"
              title="Удалить референс"
            >
              <X className="w-4 h-4 text-error" />
            </button>
          </div>
        )}

        {/* Main input */}
        <div
          className={`relative bg-bg-secondary rounded-2xl border-2 transition-all duration-200 ${
            isFocused
              ? 'border-accent/50 shadow-lg shadow-accent/10'
              : 'border-transparent hover:border-border'
          }`}
        >
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Опишите баннер... Shift+Enter для новой строки"
            className="w-full bg-transparent text-text-primary placeholder-text-muted resize-none px-4 py-3 pr-24 outline-none scrollbar-thin"
            style={{
              minHeight: `${MIN_HEIGHT}px`,
              maxHeight: `${MAX_HEIGHT}px`,
              lineHeight: `${LINE_HEIGHT}px`
            }}
            disabled={isGenerating}
          />

          {/* Bottom controls */}
          <div className="flex items-center justify-between px-3 pb-3">
            {/* Left side */}
            <div className="flex items-center gap-1">
              {/* Attach button */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                  e.target.value = '';
                }}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="p-2 hover:bg-bg-hover rounded-xl transition-colors disabled:opacity-50 group"
                title="Прикрепить референс"
              >
                {isUploading ? (
                  <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
                ) : (
                  <Paperclip className="w-5 h-5 text-text-muted group-hover:text-text-secondary transition-colors" />
                )}
              </button>

              {/* Settings toggle */}
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded-xl transition-colors ${
                  showSettings ? 'bg-accent/20 text-accent' : 'hover:bg-bg-hover text-text-muted hover:text-text-secondary'
                }`}
                title="Настройки генерации"
              >
                <Settings2 className="w-5 h-5" />
              </button>

              {/* Current mode indicator */}
              <div className={`hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg ${currentMode.bgColor}`}>
                <currentMode.icon className={`w-3.5 h-3.5 ${currentMode.color}`} />
                <span className={`text-xs font-medium ${currentMode.color}`}>{currentMode.label}</span>
              </div>

              {/* Current settings summary */}
              <div className="hidden md:flex items-center gap-2 text-xs text-text-muted">
                <span className="px-2 py-0.5 bg-bg-hover rounded">
                  {settings.size}
                </span>
                <span className="px-2 py-0.5 bg-bg-hover rounded">
                  ×{settings.variations || 1}
                </span>
              </div>

              {/* Character count */}
              {message.length > 50 && (
                <span className="text-xs text-text-muted animate-fade-in ml-2">
                  {message.length}
                </span>
              )}
            </div>

            {/* Right side - send button */}
            <button
              onClick={handleSend}
              disabled={!canSend}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium text-sm transition-all duration-200 ${
                canSend
                  ? 'bg-accent hover:bg-accent-hover text-white shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]'
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

        {/* Quick hint */}
        <p className="text-xs text-text-muted mt-2 opacity-70">
          💡 Перетащите картинку для референса • Нажмите ⚙️ для настроек
        </p>
      </div>
    </div>
  );
}

export default InputArea;
