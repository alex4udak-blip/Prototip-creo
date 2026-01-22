import { useState, useRef } from 'react';
import { Send, Paperclip, X, Image, Loader2 } from 'lucide-react';
import { useChatStore } from '../../hooks/useChat';

// Популярные размеры для быстрого выбора
const QUICK_SIZES = [
  { label: '1200×628', value: '1200x628' },
  { label: '1080×1080', value: '1080x1080' },
  { label: '160×600', value: '160x600' },
  { label: '300×250', value: '300x250' },
];

export function InputArea() {
  const {
    generate,
    isGenerating,
    attachedReference,
    setAttachedReference,
    clearAttachedReference,
    uploadReference,
    settings,
    updateSettings
  } = useChatStore();

  const [message, setMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const textInputRef = useRef(null);

  // Отправка сообщения
  const handleSend = async () => {
    if ((!message.trim() && !attachedReference) || isGenerating) return;

    const prompt = message.trim();
    setMessage('');

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
    textInputRef.current?.focus();
  };

  return (
    <div
      className={`border-t border-border p-4 bg-bg-primary transition-colors ${
        isDragging ? 'bg-accent/10 border-accent' : ''
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

      {/* Attached reference preview */}
      {attachedReference && (
        <div className="mb-3 inline-flex items-start gap-2 bg-bg-secondary rounded-lg p-2">
          <img
            src={attachedReference.url}
            alt="Reference"
            className="h-16 w-auto rounded object-cover"
          />
          <button
            onClick={clearAttachedReference}
            className="p-1 hover:bg-error/20 rounded transition"
            title="Удалить референс"
          >
            <X className="w-4 h-4 text-error" />
          </button>
        </div>
      )}

      {/* Input row */}
      <div className="flex items-end gap-2">
        {/* Attach button */}
        <div className="relative">
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
            className="p-3 hover:bg-bg-secondary rounded-xl transition-colors disabled:opacity-50"
            title="Прикрепить референс"
          >
            {isUploading ? (
              <Loader2 className="w-5 h-5 text-text-secondary animate-spin" />
            ) : (
              <Paperclip className="w-5 h-5 text-text-secondary" />
            )}
          </button>
        </div>

        {/* Text input */}
        <div className="flex-1 relative">
          <textarea
            ref={textInputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Опишите баннер... (можно на русском)"
            rows={1}
            className="input resize-none min-h-[48px] max-h-[120px] pr-12"
            style={{
              height: 'auto',
              overflowY: message.split('\n').length > 3 ? 'auto' : 'hidden'
            }}
            disabled={isGenerating}
          />

          {/* Character count */}
          {message.length > 100 && (
            <span className="absolute bottom-2 right-14 text-xs text-text-muted">
              {message.length}
            </span>
          )}
        </div>

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={(!message.trim() && !attachedReference) || isGenerating}
          className="p-3 bg-accent hover:bg-accent-hover rounded-xl transition-colors disabled:opacity-50 disabled:hover:bg-accent"
        >
          {isGenerating ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Quick size buttons */}
      <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide">
        <span className="text-xs text-text-muted whitespace-nowrap">Размер:</span>
        {QUICK_SIZES.map(size => (
          <button
            key={size.value}
            onClick={() => selectSize(size.value)}
            className={`px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors ${
              settings.size === size.value
                ? 'bg-accent text-white'
                : 'bg-bg-secondary hover:bg-bg-hover text-text-secondary'
            }`}
          >
            {size.label}
          </button>
        ))}
      </div>

      {/* Hint */}
      <p className="text-xs text-text-muted mt-2">
        Перетащите картинку для использования как референс • Enter для отправки
      </p>
    </div>
  );
}

export default InputArea;
