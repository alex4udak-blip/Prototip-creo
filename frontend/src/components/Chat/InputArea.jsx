import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Paperclip,
  X,
  Image,
  Loader2,
  Sparkles
} from 'lucide-react';
import { useChatStore } from '../../hooks/useChat';
import { toast } from '../UI/Toast';

export function InputArea() {
  const {
    sendMessage,
    isGenerating,
    attachedImages,
    addAttachedImage,
    removeAttachedImage,
    clearAttachedImages
  } = useChatStore();

  const [message, setMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(Math.max(ta.scrollHeight, 56), 200) + 'px';
  }, []);

  useEffect(() => { adjustHeight(); }, [message, adjustHeight]);
  useEffect(() => { textareaRef.current?.focus(); }, []);

  // Send
  const handleSend = async () => {
    if ((!message.trim() && attachedImages.length === 0) || isGenerating) return;

    const prompt = message.trim();
    setMessage('');
    if (textareaRef.current) textareaRef.current.style.height = '56px';

    try {
      await sendMessage(prompt, attachedImages);
    } catch (error) {
      toast.error('Ошибка: ' + error.message);
    }
  };

  // File upload
  const handleFiles = (files) => {
    const fileArray = Array.from(files);
    let added = 0;

    for (const file of fileArray) {
      if (attachedImages.length + added >= 14) {
        toast.warning('Максимум 14 референсов');
        break;
      }
      if (!file?.type.startsWith('image/')) {
        toast.error('Только изображения');
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Максимум 10MB на файл');
        continue;
      }
      addAttachedImage(file);
      added++;
    }

    if (added > 0) {
      toast.success(`Добавлено ${added} референс${added === 1 ? '' : added < 5 ? 'а' : 'ов'}`);
    }
  };

  // Drag & Drop
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  // Keyboard shortcuts: Enter или Ctrl+Enter для отправки
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || !e.shiftKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = (message.trim() || attachedImages.length > 0) && !isGenerating;

  return (
    <div
      className={`border-t border-border/50 bg-gradient-to-t from-bg-primary to-transparent backdrop-blur-xl transition-all ${isDragging ? 'bg-accent/5 border-accent' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >

      {/* Drag overlay */}
      {isDragging && (
        <div className="drag-overlay">
          <div className="text-center">
            <Image className="w-16 h-16 text-accent mx-auto mb-3 animate-bounce" />
            <p className="text-xl font-semibold text-white">Отпустите для загрузки</p>
            <p className="text-sm text-text-muted mt-1">До 14 референсов</p>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto p-4">
        {/* Attached images preview */}
        {attachedImages.length > 0 && (
          <div className="mb-4 bg-bg-secondary/80 backdrop-blur rounded-2xl p-4 border border-border/50 animate-scale-in">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                  <Image className="w-4 h-4 text-accent" />
                </div>
                <span className="text-sm font-medium text-text-primary">
                  {attachedImages.length} референс{attachedImages.length > 1 ? (attachedImages.length < 5 ? 'а' : 'ов') : ''}
                </span>
              </div>
              <button
                onClick={clearAttachedImages}
                className="text-xs text-text-muted hover:text-error transition-colors"
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
                    className="h-20 w-20 rounded-xl object-cover border-2 border-border/50 group-hover:border-accent/50 transition-all shadow-lg"
                  />
                  <button
                    onClick={() => removeAttachedImage(index)}
                    className="absolute -top-2 -right-2 p-1.5 bg-error rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg hover:scale-110"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                  <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/60 backdrop-blur rounded text-[10px] text-white font-medium">
                    {index + 1}
                  </div>
                </div>
              ))}
              {attachedImages.length < 14 && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="h-20 w-20 rounded-xl border-2 border-dashed border-border/50 hover:border-accent/50 flex flex-col items-center justify-center transition-all hover:bg-accent/5 group"
                >
                  <span className="text-2xl text-text-muted group-hover:text-accent transition-colors">+</span>
                  <span className="text-[10px] text-text-muted mt-0.5">{14 - attachedImages.length}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Main input */}
        <div className="relative bg-bg-secondary/80 backdrop-blur rounded-2xl border-2 border-border/50 hover:border-border focus-within:border-accent/50 transition-all shadow-xl">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Опишите баннер или задайте вопрос..."
            className="w-full bg-transparent text-text-primary placeholder-text-muted resize-none px-5 py-4 pr-28 outline-none text-[15px] leading-relaxed"
            style={{ minHeight: '56px', maxHeight: '200px' }}
            disabled={isGenerating}
          />

          <div className="absolute right-3 bottom-3 flex items-center gap-2">
            {/* File input */}
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
              className="p-2.5 hover:bg-bg-hover rounded-xl transition-all group"
              title="Добавить референсы (до 14)"
            >
              <Paperclip className="w-5 h-5 text-text-muted group-hover:text-accent transition-colors" />
            </button>

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={!canSend}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
                canSend
                  ? 'bg-accent hover:bg-accent-hover text-white shadow-lg hover:shadow-xl hover:scale-[1.02]'
                  : 'bg-bg-hover text-text-muted cursor-not-allowed'
              }`}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="hidden sm:inline">Генерация...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span className="hidden sm:inline">Создать</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Hint */}
        <p className="text-xs text-text-muted mt-3 text-center opacity-60">
          Перетащите референсы или нажмите 📎 • Enter/Ctrl+Enter для отправки • Shift+Enter для новой строки
        </p>
      </div>
    </div>
  );
}

export default InputArea;
