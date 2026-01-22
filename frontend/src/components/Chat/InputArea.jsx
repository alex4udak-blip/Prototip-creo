import { useState, useRef, useEffect, useCallback } from 'react';
import { Paperclip, X, Image, Loader2, CornerDownLeft } from 'lucide-react';
import { useChatStore } from '../../hooks/useChat';

// Популярные размеры для быстрого выбора
const QUICK_SIZES = [
  { label: '1200×628', value: '1200x628' },
  { label: '1080×1080', value: '1080x1080' },
  { label: '160×600', value: '160x600' },
  { label: '300×250', value: '300x250' },
];

const MIN_HEIGHT = 52;
const MAX_HEIGHT = 180; // ~6 строк
const LINE_HEIGHT = 24;

export function InputArea() {
  const {
    generate,
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
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  // Умное авторасширение textarea
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to get actual scrollHeight
    textarea.style.height = 'auto';

    // Calculate new height
    const scrollHeight = textarea.scrollHeight;
    const newHeight = Math.min(Math.max(scrollHeight, MIN_HEIGHT), MAX_HEIGHT);

    textarea.style.height = `${newHeight}px`;

    // Enable/disable scrolling
    textarea.style.overflowY = scrollHeight > MAX_HEIGHT ? 'auto' : 'hidden';
  }, []);

  // Adjust height on message change
  useEffect(() => {
    adjustTextareaHeight();
  }, [message, adjustTextareaHeight]);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Отправка сообщения
  const handleSend = async () => {
    if ((!message.trim() && !attachedReference) || isGenerating) return;

    const prompt = message.trim();
    setMessage('');

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = `${MIN_HEIGHT}px`;
    }

    try {
      await generate(prompt);
    } catch (error) {
      console.error('Generate error:', error);
    }
  };

  // Загрузка файла
  const handleFileUpload = async (file) => {
    if (!file || !file.type.startsWith('image/')) {
      alert('Только изображения (JPEG, PNG, WebP, GIF)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('Максимальный размер файла: 10MB');
      return;
    }

    setIsUploading(true);
    try {
      await uploadReference(file);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Ошибка загрузки: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Drag & Drop handlers
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
    if (file) {
      handleFileUpload(file);
    }
  };

  // Keyboard handler
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Выбор размера
  const selectSize = (size) => {
    updateSettings({ size });
    textareaRef.current?.focus();
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
        {/* Attached reference preview */}
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

        {/* Main input container - Claude-style */}
        <div
          className={`relative bg-bg-secondary rounded-2xl border-2 transition-all duration-200 ${
            isFocused
              ? 'border-accent/50 shadow-lg shadow-accent/10'
              : 'border-transparent hover:border-border'
          }`}
        >
          {/* Textarea */}
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

          {/* Bottom row with buttons */}
          <div className="flex items-center justify-between px-3 pb-3">
            {/* Left side - attach */}
            <div className="flex items-center gap-2">
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
                title="Прикрепить референс (изображение)"
              >
                {isUploading ? (
                  <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
                ) : (
                  <Paperclip className="w-5 h-5 text-text-muted group-hover:text-text-secondary transition-colors" />
                )}
              </button>

              {/* Character count */}
              {message.length > 50 && (
                <span className="text-xs text-text-muted animate-fade-in">
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

        {/* Quick size buttons */}
        <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide">
          <span className="text-xs text-text-muted whitespace-nowrap">Размер:</span>
          {QUICK_SIZES.map(size => (
            <button
              key={size.value}
              onClick={() => selectSize(size.value)}
              className={`px-3 py-1.5 text-xs rounded-full whitespace-nowrap transition-all duration-200 ${
                settings.size === size.value
                  ? 'bg-accent text-white shadow-sm'
                  : 'bg-bg-secondary hover:bg-bg-hover text-text-secondary hover:text-text-primary'
              }`}
            >
              {size.label}
            </button>
          ))}
        </div>

        {/* Hint */}
        <p className="text-xs text-text-muted mt-2 opacity-70">
          Перетащите картинку для референса
        </p>
      </div>
    </div>
  );
}

export default InputArea;
