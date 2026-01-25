import { useState } from 'react';
import { Download, Copy, Check, ExternalLink, AlertCircle, User, Maximize2, ChevronLeft, ChevronRight, X, RefreshCw, Edit3, Wand2, Palette, Crop, RotateCcw, Loader2 } from 'lucide-react';
import { useChatStore } from '../../hooks/useChat';

/**
 * Tool Use Indicator - Claude style
 * Subtle indicator for active tools
 */
function ToolUseIndicator({ tool, label, status, referenceUrls }) {
  const [showUrls, setShowUrls] = useState(false);

  const getIcon = (toolName) => {
    const icons = {
      image_understanding: '🔍',
      analysis: '🧠',
      clarification: '💬',
      image_generation: '🎨',
      thinking: '💭',
      deep_research: '🔬'
    };

    if (toolName.startsWith('image_generation_')) {
      return '🎨';
    }

    return icons[toolName] || '⚡';
  };

  const hasUrls = referenceUrls && referenceUrls.length > 0;

  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-secondary)]
        rounded-xl border border-[var(--border)]">
        <span className="text-xs text-[var(--text-muted)] font-sans">Использование инструмента</span>
        <span className="text-[var(--border)]">|</span>
        <span>{getIcon(tool)}</span>
        <span className="text-sm text-[var(--text-primary)] font-sans">{label}</span>

        {hasUrls && (
          <>
            <span className="text-[var(--border)]">|</span>
            <button
              onClick={() => setShowUrls(!showUrls)}
              className="flex items-center gap-1 text-xs text-[var(--accent)]
                hover:text-[var(--accent-hover)] transition font-sans"
            >
              🔗 <span>{referenceUrls.length} референс{referenceUrls.length > 1 ? 'ов' : ''}</span>
            </button>
          </>
        )}

        {status === 'running' && (
          <Loader2 className="w-3 h-3 animate-spin text-[var(--accent)] ml-auto" />
        )}
        {status === 'complete' && (
          <Check className="w-3 h-3 text-green-600 ml-auto" />
        )}
      </div>

      {showUrls && hasUrls && (
        <div className="mt-2 ml-4 flex flex-wrap gap-2 p-2 bg-[var(--bg-secondary)]
          rounded-xl border border-[var(--border)]">
          {referenceUrls.map((url, i) => (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2 py-1 bg-[var(--bg-hover)]
                hover:bg-[var(--bg-tertiary)] rounded-lg text-xs text-[var(--accent)]
                hover:text-[var(--accent-hover)] transition font-sans"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Референс {i + 1}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Fetch image URL and convert to File object
 */
async function fetchImageAsFile(url) {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const filename = url.split('/').pop() || 'reference.png';
    return new File([blob], filename, { type: blob.type || 'image/png' });
  } catch (error) {
    console.error('Failed to fetch image:', error);
    return null;
  }
}

/**
 * Image Edit Button - Claude style
 */
function ImageEditButton({ imageUrl, index }) {
  const { sendMessage, isGenerating } = useChatStore();
  const [loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const editOptions = [
    { label: 'Изменить текст', prompt: 'Сгенерируй такой же баннер но с другим, более продающим текстом. Сохрани стиль.' },
    { label: 'Другие цвета', prompt: 'Сгенерируй такой же баннер но в другой цветовой гамме — более яркой.' },
    { label: 'Улучшить', prompt: 'Сгенерируй улучшенную версию — добавь деталей, сделай чётче.' },
    { label: 'Квадрат 1:1', prompt: 'Сгенерируй такой же баннер но в формате 1:1 (квадрат).' },
    { label: 'Переделать', prompt: 'Сгенерируй другой вариант в похожем стиле.' }
  ];

  const handleEdit = async (prompt) => {
    if (isGenerating || loading) return;

    setLoading(true);
    setShowMenu(false);
    try {
      const imageFile = await fetchImageAsFile(imageUrl);
      await sendMessage(
        `Используя это изображение как референс: ${prompt}`,
        imageFile ? [imageFile] : null
      );
    } catch (error) {
      console.error('Image edit error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
        disabled={isGenerating || loading}
        className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5
          bg-white/90 hover:bg-white backdrop-blur-sm rounded-lg
          text-xs text-[var(--text-primary)] font-sans font-medium
          transition shadow-sm disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Edit3 className="w-3 h-3" />
        )}
        <span>Редактировать</span>
      </button>

      {showMenu && (
        <div
          className="absolute bottom-full left-0 right-0 mb-1 bg-[var(--bg-primary)]
            rounded-xl border border-[var(--border)] shadow-lg z-20 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {editOptions.map(({ label, prompt }) => (
            <button
              key={label}
              onClick={() => handleEdit(prompt)}
              className="w-full px-3 py-2 text-left text-xs text-[var(--text-primary)]
                hover:bg-[var(--bg-hover)] transition font-sans"
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * More Variants Button
 */
function MoreVariantsButton({ imageUrls }) {
  const { sendMessage, isGenerating } = useChatStore();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (isGenerating || loading) return;

    setLoading(true);
    try {
      const imageUrl = imageUrls?.[0];
      let imageFile = null;

      if (imageUrl) {
        imageFile = await fetchImageAsFile(imageUrl);
      }

      await sendMessage(
        'Используя это изображение как референс, сгенерируй 3 новых варианта баннера в таком же стиле.',
        imageFile ? [imageFile] : null
      );
    } catch (error) {
      console.error('More variants error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isGenerating || loading}
      className="flex items-center gap-1.5 px-3 py-1.5
        bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)]
        border border-[var(--border)] rounded-xl
        text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]
        transition font-sans disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <RefreshCw className="w-4 h-4" />
      )}
      <span>Ещё варианты</span>
    </button>
  );
}

/**
 * Quick Edit Buttons
 */
function QuickEditButtons({ imageUrls }) {
  const { sendMessage, isGenerating } = useChatStore();
  const [loading, setLoading] = useState(false);

  const quickActions = [
    { icon: Edit3, title: 'Изменить текст', prompt: 'Сгенерируй такой же баннер с другим текстом.' },
    { icon: Palette, title: 'Цвета', prompt: 'Сгенерируй такой же баннер в другой цветовой гамме.' },
    { icon: Wand2, title: 'Улучшить', prompt: 'Сгенерируй улучшенную версию.' },
    { icon: Crop, title: 'Размер', prompt: 'Сгенерируй в формате 1:1 (квадрат).' },
    { icon: RotateCcw, title: 'Переделать', prompt: 'Сгенерируй другой вариант в похожем стиле.' }
  ];

  const handleQuickAction = async (prompt) => {
    if (isGenerating || loading) return;

    setLoading(true);
    try {
      const imageUrl = imageUrls?.[0];
      let imageFile = null;

      if (imageUrl) {
        imageFile = await fetchImageAsFile(imageUrl);
      }

      await sendMessage(prompt, imageFile ? [imageFile] : null);
    } catch (error) {
      console.error('Quick action error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-1 ml-2 pl-2 border-l border-[var(--border)]">
      {quickActions.map(({ icon: Icon, title, prompt }) => (
        <button
          key={title}
          onClick={() => handleQuickAction(prompt)}
          disabled={isGenerating || loading}
          className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition group
            disabled:opacity-50 disabled:cursor-not-allowed"
          title={title}
        >
          <Icon className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--text-primary)]" />
        </button>
      ))}
    </div>
  );
}

/**
 * Simple Markdown parser
 */
function parseMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/^-\s+/gm, '• ')
    .replace(/^\d+\.\s+/gm, '')
    .trim();
}

/**
 * Generation Status - Claude style
 */
function GenerationStatus({ progress, status, imagesCount = 0, expectedImages = 3 }) {
  const getStatusInfo = () => {
    if (status === 'analyzing') {
      return { label: 'Анализирую запрос...', color: 'text-[var(--accent)]' };
    }
    if (status === 'generating_image') {
      return { label: `Создаю изображение ${imagesCount + 1}/${expectedImages}...`, color: 'text-[var(--accent)]' };
    }
    if (status === 'generating') {
      return { label: 'Генерирую ответ...', color: 'text-[var(--accent)]' };
    }
    return { label: progress || 'Обрабатываю...', color: 'text-[var(--text-muted)]' };
  };

  const statusInfo = getStatusInfo();

  return (
    <div className="flex items-center gap-2 text-sm font-sans">
      <Loader2 className={`w-4 h-4 animate-spin ${statusInfo.color}`} />
      <span className={statusInfo.color}>{statusInfo.label}</span>
    </div>
  );
}

/**
 * Message Component - Claude.ai Style
 *
 * ⭐ KEY DESIGN:
 * - Assistant messages: NO bubble, just text with serif font
 * - User messages: IN bubble on the right
 */
export function Message({ message }) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(null);
  const [referencePreview, setReferencePreview] = useState(false);

  const previewImage = referencePreview
    ? message.referenceUrl
    : (previewIndex !== null && message.imageUrls?.[previewIndex]
      ? message.imageUrls[previewIndex]
      : null);

  const hasMultipleImages = message.imageUrls?.length > 1 && !referencePreview;
  const canGoBack = hasMultipleImages && previewIndex > 0;
  const canGoForward = hasMultipleImages && previewIndex < message.imageUrls.length - 1;

  const goToPrevious = (e) => {
    e.stopPropagation();
    if (canGoBack) setPreviewIndex(previewIndex - 1);
  };

  const goToNext = (e) => {
    e.stopPropagation();
    if (canGoForward) setPreviewIndex(previewIndex + 1);
  };

  const openPreview = (index) => {
    setReferencePreview(false);
    setPreviewIndex(index);
  };

  const openReferencePreview = () => {
    setPreviewIndex(null);
    setReferencePreview(true);
  };

  const closePreview = () => {
    setPreviewIndex(null);
    setReferencePreview(false);
  };

  const copyPrompt = () => {
    const text = message.enhancedPrompt || message.content;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadImage = async (url, index) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `banner-${message.id}-${index + 1}.png`;
      a.click();

      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // USER MESSAGE - В BUBBLE справа
  // ═══════════════════════════════════════════════════════════════
  if (isUser) {
    return (
      <div className="flex justify-end mb-6">
        <div className="max-w-[85%] flex items-start gap-3">
          {/* Message bubble */}
          <div className="px-4 py-3 rounded-2xl bg-[var(--bg-secondary)]
            border border-[var(--border)] shadow-sm">

            {/* Text content */}
            {message.content && (
              <p className="text-[var(--text-primary)] font-serif leading-relaxed">
                {parseMarkdown(message.content)}
              </p>
            )}

            {/* Reference images */}
            {message.imageUrls?.length > 0 && (
              <div className="mt-3">
                <span className="text-xs text-[var(--text-muted)] block mb-2 font-sans">
                  📎 {message.imageUrls.length} референс{message.imageUrls.length > 1 ? 'ов' : ''}
                </span>
                <div className="flex flex-wrap gap-2">
                  {message.imageUrls.map((url, index) => (
                    <img
                      key={index}
                      src={url}
                      alt={`Reference ${index + 1}`}
                      className="h-16 w-16 rounded-xl object-cover cursor-pointer
                        hover:opacity-90 transition border border-[var(--border)]"
                      onClick={() => openPreview(index)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Single reference */}
            {message.referenceUrl && !message.imageUrls && (
              <div className="mt-3">
                <span className="text-xs text-[var(--text-muted)] block mb-1 font-sans">Референс:</span>
                <img
                  src={message.referenceUrl}
                  alt="Reference"
                  className="max-h-32 rounded-xl cursor-pointer hover:opacity-90 transition"
                  onClick={() => openReferencePreview()}
                />
              </div>
            )}
          </div>

          {/* User avatar */}
          <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center
            bg-[var(--accent-light)]">
            <User className="w-4 h-4 text-[var(--accent)]" />
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // ASSISTANT MESSAGE - БЕЗ BUBBLE, просто текст (Claude style)
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="flex justify-start mb-6">
      <div className="max-w-[85%]">
        {/* Label */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-full bg-[var(--accent)]
            flex items-center justify-center">
            <span className="text-white text-xs font-bold">M</span>
          </div>
          <span className="text-sm text-[var(--text-muted)] font-sans">MST CREO AI</span>
        </div>

        {/* Tool indicators */}
        {message.isGenerating && message.activeTools?.length > 0 && (
          <div className="mb-3">
            {message.activeTools.map((tool, i) => (
              <ToolUseIndicator key={i} {...tool} />
            ))}
          </div>
        )}

        {/* ⭐ Text content - NO BUBBLE, just serif text */}
        {message.content && (
          <div className="text-[var(--text-primary)] font-serif text-base leading-relaxed">
            {parseMarkdown(message.content)}
            {message.isGenerating && (
              <span className="inline-block w-0.5 h-5 bg-[var(--accent)] ml-0.5 animate-pulse" />
            )}
          </div>
        )}

        {/* Partial text during generation */}
        {!message.content && message.partialText && message.isGenerating && (
          <div className="text-[var(--text-primary)] font-serif text-base leading-relaxed">
            {parseMarkdown(message.partialText)}
            <span className="inline-block w-0.5 h-5 bg-[var(--accent)] ml-0.5 animate-pulse" />
          </div>
        )}

        {/* Generated images */}
        {message.imageUrls?.length > 0 && (
          <div className={`${message.content ? 'mt-6' : ''}`}>
            {/* Header for multiple images */}
            {message.imageUrls.length > 1 && (
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-[var(--border)]" />
                <span className="text-sm text-[var(--text-muted)] font-sans">
                  {message.imageUrls.length} вариации
                </span>
                <div className="h-px flex-1 bg-[var(--border)]" />
              </div>
            )}

            {/* Image grid */}
            <div className={`grid gap-4 ${
              message.imageUrls.length === 1 ? 'grid-cols-1 max-w-md'
                : message.imageUrls.length === 2 ? 'grid-cols-2'
                : 'grid-cols-3'
            }`}>
              {message.imageUrls.map((url, index) => (
                <div
                  key={index}
                  className="relative group rounded-2xl overflow-hidden cursor-pointer
                    ring-1 ring-[var(--border)] hover:ring-[var(--accent)]
                    shadow-sm hover:shadow-lg transition-all duration-200"
                  onClick={() => openPreview(index)}
                >
                  <img
                    src={url}
                    alt={`Вариация ${index + 1}`}
                    className="w-full aspect-square object-cover"
                  />

                  {/* Variation number */}
                  <div className="absolute top-2 left-2 z-10">
                    <span className="inline-flex items-center justify-center
                      w-6 h-6 text-xs font-sans font-bold
                      bg-white/90 backdrop-blur-sm text-[var(--text-primary)]
                      rounded-full shadow-sm">
                      {index + 1}
                    </span>
                  </div>

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0
                    group-hover:opacity-100 transition-opacity flex items-center
                    justify-center gap-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); openPreview(index); }}
                      className="p-2.5 bg-white/90 hover:bg-white rounded-full
                        transition shadow-sm"
                      title="Увеличить"
                    >
                      <Maximize2 className="w-4 h-4 text-[var(--text-primary)]" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); downloadImage(url, index); }}
                      className="p-2.5 bg-white/90 hover:bg-white rounded-full
                        transition shadow-sm"
                      title="Скачать"
                    >
                      <Download className="w-4 h-4 text-[var(--text-primary)]" />
                    </button>
                  </div>

                  {/* Bottom edit bar */}
                  <div className="absolute bottom-0 left-0 right-0 p-2
                    bg-gradient-to-t from-black/60 to-transparent
                    opacity-0 group-hover:opacity-100 transition-opacity">
                    <ImageEditButton imageUrl={url} index={index} />
                  </div>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <button
                onClick={() => {
                  message.imageUrls.forEach((url, i) => downloadImage(url, i));
                }}
                className="flex items-center gap-1.5 px-3 py-1.5
                  bg-[var(--accent)] hover:bg-[var(--accent-hover)]
                  text-white rounded-xl text-sm font-sans font-medium transition"
              >
                <Download className="w-4 h-4" />
                <span>Скачать все</span>
              </button>
              <MoreVariantsButton imageUrls={message.imageUrls} />
              <QuickEditButtons imageUrls={message.imageUrls} />
            </div>
          </div>
        )}

        {/* Error message */}
        {message.errorMessage && (
          <div className="mt-4 flex items-start gap-2 text-red-600
            bg-red-50 dark:bg-red-900/20 rounded-xl p-3 border border-red-200
            dark:border-red-800">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="text-sm font-sans">{message.errorMessage}</span>
          </div>
        )}

        {/* Generation status */}
        {message.isGenerating && (
          <div className="mt-4">
            <GenerationStatus
              progress={message.generationProgress}
              status={message.generationStatus}
              imagesCount={message.imageUrls?.length || 0}
              expectedImages={3}
            />
          </div>
        )}

        {/* Meta info */}
        {(message.modelUsed || message.generationTimeMs) && (
          <div className="flex items-center gap-3 mt-4 text-xs text-[var(--text-muted)] font-sans">
            {message.modelUsed && (
              <span className="px-2 py-0.5 bg-[var(--accent-light)]
                text-[var(--accent)] rounded-full">
                {message.modelUsed}
              </span>
            )}
            {message.generationTimeMs && (
              <span>{(message.generationTimeMs / 1000).toFixed(1)}с</span>
            )}

            {message.enhancedPrompt && (
              <button
                onClick={copyPrompt}
                className="flex items-center gap-1 hover:text-[var(--text-primary)] transition"
                title="Копировать промпт"
              >
                {copied ? (
                  <Check className="w-3 h-3 text-green-600" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                <span>Промпт</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Image Preview Modal */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={closePreview}
        >
          {/* Close button */}
          <button
            onClick={closePreview}
            className="absolute top-4 right-4 z-10 p-2 rounded-full
              bg-white/10 hover:bg-white/20 transition"
            title="Закрыть"
          >
            <X className="w-5 h-5 text-white" />
          </button>

          {/* Image counter */}
          {hasMultipleImages && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10
              px-4 py-2 rounded-full bg-black/60 text-white text-sm font-sans">
              <span className="text-[var(--accent)]">{previewIndex + 1}</span>
              <span className="text-white/60 mx-1">/</span>
              <span>{message.imageUrls.length}</span>
            </div>
          )}

          {/* Previous button */}
          {hasMultipleImages && (
            <button
              onClick={goToPrevious}
              disabled={!canGoBack}
              className={`absolute left-4 top-1/2 -translate-y-1/2 z-10
                p-3 rounded-full bg-white/10 hover:bg-white/20 transition
                ${canGoBack ? 'cursor-pointer' : 'opacity-30 cursor-not-allowed'}`}
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
          )}

          {/* Next button */}
          {hasMultipleImages && (
            <button
              onClick={goToNext}
              disabled={!canGoForward}
              className={`absolute right-4 top-1/2 -translate-y-1/2 z-10
                p-3 rounded-full bg-white/10 hover:bg-white/20 transition
                ${canGoForward ? 'cursor-pointer' : 'opacity-30 cursor-not-allowed'}`}
            >
              <ChevronRight className="w-6 h-6 text-white" />
            </button>
          )}

          {/* Main image */}
          <div className="relative max-w-[90vw] max-h-[80vh] p-4" onClick={(e) => e.stopPropagation()}>
            <img
              src={previewImage}
              alt={referencePreview ? 'Reference' : `Вариация ${previewIndex + 1}`}
              className="max-w-full max-h-[75vh] object-contain rounded-2xl shadow-2xl"
            />

            {!referencePreview && (
              <div className="absolute top-6 left-6 px-3 py-1.5 rounded-lg
                bg-black/60 text-white text-sm font-sans">
                Вариация {previewIndex + 1}
              </div>
            )}
          </div>

          {/* Bottom action bar */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2
            flex items-center gap-3 p-2 rounded-2xl bg-black/60">
            <button
              onClick={(e) => {
                e.stopPropagation();
                const a = document.createElement('a');
                a.href = previewImage;
                a.download = referencePreview ? 'reference.png' : `banner-variation-${previewIndex + 1}.png`;
                a.click();
              }}
              className="flex items-center gap-2 px-4 py-2
                bg-[var(--accent)] hover:bg-[var(--accent-hover)]
                text-white rounded-xl transition font-sans text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Скачать
            </button>
            <a
              href={previewImage}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2
                bg-white/10 hover:bg-white/20 text-white rounded-xl
                transition font-sans text-sm font-medium"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="w-4 h-4" />
              Открыть
            </a>
          </div>

          {/* Thumbnail strip */}
          {hasMultipleImages && message.imageUrls.length <= 5 && (
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2
              flex items-center gap-2 p-2 rounded-xl bg-black/40">
              {message.imageUrls.map((url, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewIndex(idx);
                  }}
                  className={`w-12 h-12 rounded-lg overflow-hidden transition
                    ${idx === previewIndex
                      ? 'ring-2 ring-[var(--accent)] scale-110'
                      : 'opacity-60 hover:opacity-100 hover:scale-105'
                    }`}
                >
                  <img
                    src={url}
                    alt={`Thumbnail ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Message;
