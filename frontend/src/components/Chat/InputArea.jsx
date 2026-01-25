import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Paperclip,
  X,
  Image,
  Loader2,
  ArrowUp
} from 'lucide-react';
import { useChatStore } from '../../hooks/useChat';
import { toast } from '../UI/Toast';

/**
 * InputArea Component - Claude.ai Style
 *
 * ⭐ KEY DESIGN:
 * - Soft shadow (Claude's characteristic shadow)
 * - Rounded corners (20px)
 * - Clean, minimal design
 * - Sans-serif font for UI
 */
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

  // Keyboard shortcuts
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || !e.shiftKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = (message.trim() || attachedImages.length > 0) && !isGenerating;

  return (
    <div
      className={`bg-[var(--bg-primary)] border-t border-[var(--border)]
        transition-all ${isDragging ? 'bg-[var(--accent-light)]' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >

      {/* Drag overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-[var(--bg-primary)]/90 flex items-center justify-center">
          <div className="text-center">
            <div className="w-20 h-20 rounded-2xl bg-[var(--accent-light)] flex items-center justify-center mx-auto mb-4">
              <Image className="w-10 h-10 text-[var(--accent)]" />
            </div>
            <p className="text-xl font-sans font-semibold text-[var(--text-primary)]">
              Отпустите для загрузки
            </p>
            <p className="text-sm text-[var(--text-muted)] mt-2 font-sans">
              До 14 референсов
            </p>
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto p-4">
        {/* Attached images preview */}
        {attachedImages.length > 0 && (
          <div className="mb-4 bg-[var(--bg-secondary)] rounded-2xl p-4
            border border-[var(--border)]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[var(--accent-light)]
                  flex items-center justify-center">
                  <Image className="w-4 h-4 text-[var(--accent)]" />
                </div>
                <span className="text-sm font-sans font-medium text-[var(--text-primary)]">
                  {attachedImages.length} референс{attachedImages.length > 1 ? (attachedImages.length < 5 ? 'а' : 'ов') : ''}
                </span>
              </div>
              <button
                onClick={clearAttachedImages}
                className="text-xs font-sans text-[var(--text-muted)]
                  hover:text-red-500 transition-colors"
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
                    className="h-16 w-16 rounded-xl object-cover border border-[var(--border)]
                      group-hover:border-[var(--accent)] transition-all"
                  />
                  <button
                    onClick={() => removeAttachedImage(index)}
                    className="absolute -top-1.5 -right-1.5 p-1 bg-red-500 rounded-full
                      opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                  <div className="absolute bottom-1 left-1 px-1.5 py-0.5
                    bg-black/60 backdrop-blur rounded text-[10px] text-white font-sans font-medium">
                    {index + 1}
                  </div>
                </div>
              ))}
              {attachedImages.length < 14 && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="h-16 w-16 rounded-xl border-2 border-dashed border-[var(--border)]
                    hover:border-[var(--accent)] flex flex-col items-center justify-center
                    transition-all hover:bg-[var(--accent-light)] group"
                >
                  <span className="text-xl text-[var(--text-muted)] group-hover:text-[var(--accent)]
                    transition-colors font-sans">+</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ⭐ Main input - Claude.ai style with characteristic shadow */}
        <div className="relative bg-[var(--bg-primary)] rounded-[20px]
          border border-[var(--border)]
          shadow-[var(--shadow-input)]
          hover:shadow-[0_0.25rem_1.5rem_rgba(0,0,0,0.06)]
          focus-within:shadow-[0_0.25rem_1.5rem_rgba(0,0,0,0.08)]
          focus-within:border-[var(--accent)]
          transition-all duration-200">

          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Опишите баннер, который хотите создать..."
            className="w-full bg-transparent text-[var(--text-primary)]
              placeholder-[var(--text-muted)] resize-none
              px-5 py-4 pr-24 outline-none
              text-base font-serif leading-relaxed rounded-[20px]"
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
              onChange={(e) => {
                if (e.target.files?.length) handleFiles(e.target.files);
                e.target.value = '';
              }}
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 hover:bg-[var(--bg-hover)] rounded-xl transition-all group"
              title="Добавить референсы (до 14)"
            >
              <Paperclip className="w-5 h-5 text-[var(--text-muted)]
                group-hover:text-[var(--text-primary)] transition-colors" />
            </button>

            {/* Send button - круглая кнопка как у Claude */}
            <button
              onClick={handleSend}
              disabled={!canSend}
              className={`p-2.5 rounded-xl transition-all ${
                canSend
                  ? 'bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white shadow-sm'
                  : 'bg-[var(--bg-hover)] text-[var(--text-muted)] cursor-not-allowed'
              }`}
              title="Отправить"
            >
              {isGenerating ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <ArrowUp className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Hint */}
        <p className="text-xs text-[var(--text-muted)] mt-3 text-center font-sans">
          Перетащите референсы или нажмите 📎 • Enter для отправки
        </p>
      </div>
    </div>
  );
}

export default InputArea;
