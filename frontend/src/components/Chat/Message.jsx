import { useState } from 'react';
import { Download, Copy, Check, ExternalLink, AlertCircle, Sparkles, User, Maximize2, ImageIcon, ChevronLeft, ChevronRight, X, RefreshCw, Edit3, Wrench, Brain, MessageSquare, Wand2, Palette, Crop, RotateCcw, Loader2, Search } from 'lucide-react';
import { GENERATION_PHASES, PHASE_LABELS, useChatStore } from '../../hooks/useChat';

/**
 * Tool Use Indicator (like Genspark)
 * Показывает плашки: "Использование инструмента | 🔍 Понимание изображения | 🔗 URL"
 */
function ToolUseIndicator({ tool, label, status, referenceUrls }) {
  const [showUrls, setShowUrls] = useState(false);

  // Иконки для инструментов (поддерживаем динамические ID типа image_generation_1)
  const getIcon = (toolName) => {
    const icons = {
      image_understanding: '🔍',
      analysis: '🧠',
      clarification: '💬',
      image_generation: '🎨',
      thinking: '💭',
      deep_research: '🔬'
    };

    // Проверяем динамические tool ID (image_generation_1, image_generation_2, etc.)
    if (toolName.startsWith('image_generation_')) {
      return '🎨';
    }

    return icons[toolName] || '⚡';
  };

  const hasUrls = referenceUrls && referenceUrls.length > 0;

  return (
    <div className="mb-2 animate-fade-in">
      <div className="flex items-center gap-2 px-3 py-2 glass-light rounded-lg">
        <span className="text-xs text-text-muted">Использование инструмента</span>
        <span className="text-text-muted">|</span>
        <span>{getIcon(tool)}</span>
        <span className="text-sm text-text-primary">{label}</span>

        {/* Reference URL link (like Genspark) */}
        {hasUrls && (
          <>
            <span className="text-text-muted">|</span>
            <button
              onClick={() => setShowUrls(!showUrls)}
              className="flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition"
            >
              🔗 <span>{referenceUrls.length} референс{referenceUrls.length > 1 ? 'ов' : ''}</span>
              <span className="text-text-muted">Посмотреть</span>
            </button>
          </>
        )}

        {status === 'running' && (
          <Loader2 className="w-3 h-3 animate-spin text-accent ml-auto" />
        )}
        {status === 'complete' && (
          <Check className="w-3 h-3 text-green-400 ml-auto" />
        )}
      </div>

      {/* Reference URLs dropdown */}
      {showUrls && hasUrls && (
        <div className="mt-1 ml-4 flex flex-wrap gap-2 p-2 bg-bg-tertiary rounded-lg border border-border animate-fade-in">
          {referenceUrls.map((url, i) => (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2 py-1 bg-bg-secondary hover:bg-bg-hover rounded text-xs text-accent hover:text-accent-hover transition"
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
 * Image Edit Button - appears on hover over each image
 * Allows editing specific image
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
        className="w-full flex items-center justify-center gap-1.5 px-2 py-1 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded text-xs text-white font-medium transition disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Edit3 className="w-3 h-3" />
        )}
        <span>Редактировать #{index + 1}</span>
      </button>

      {/* Dropdown menu */}
      {showMenu && (
        <div
          className="absolute bottom-full left-0 right-0 mb-1 bg-bg-secondary/95 backdrop-blur-sm rounded-lg border border-border shadow-xl z-20 overflow-hidden animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          {editOptions.map(({ label, prompt }) => (
            <button
              key={label}
              onClick={() => handleEdit(prompt)}
              className="w-full px-3 py-2 text-left text-xs text-text-primary hover:bg-bg-hover transition"
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
 * More Variants Button - generates 3 more variants using the image as reference
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
        'Используя это изображение как референс, сгенерируй 3 новых варианта баннера в таком же стиле. Сохрани композицию и общий вид, но сделай вариации.',
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
      className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-hover hover:bg-bg-tertiary rounded-lg text-sm text-text-secondary hover:text-text-primary transition disabled:opacity-50 disabled:cursor-not-allowed"
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
 * Quick Edit Buttons - instant actions that send prompts with the image as reference
 */
function QuickEditButtons({ imageUrls }) {
  const { sendMessage, isGenerating } = useChatStore();
  const [loading, setLoading] = useState(false);

  const quickActions = [
    {
      icon: Edit3,
      title: 'Изменить текст',
      prompt: 'Используя это изображение как референс, сгенерируй такой же баннер но с другим, более продающим и цепляющим текстом. Сохрани стиль и композицию.'
    },
    {
      icon: Palette,
      title: 'Изменить цвета',
      prompt: 'Используя это изображение как референс, сгенерируй такой же баннер но в другой цветовой гамме — более яркой и контрастной.'
    },
    {
      icon: Wand2,
      title: 'Улучшить качество',
      prompt: 'Используя это изображение как референс, сгенерируй улучшенную версию — добавь больше деталей, сделай элементы чётче и профессиональнее.'
    },
    {
      icon: Crop,
      title: 'Другой размер',
      prompt: 'Используя это изображение как референс, сгенерируй такой же баннер но в формате 1:1 (квадрат). Адаптируй композицию.'
    },
    {
      icon: RotateCcw,
      title: 'Переделать',
      prompt: 'Используя это изображение как референс стиля, сгенерируй совершенно другой вариант баннера. Другая композиция и подход, но похожий стиль.'
    }
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
    <div className="flex gap-1 ml-2 pl-2 border-l border-border">
      {quickActions.map(({ icon: Icon, title, prompt }) => (
        <button
          key={title}
          onClick={() => handleQuickAction(prompt)}
          disabled={isGenerating || loading}
          className="p-2 hover:bg-bg-hover rounded-lg transition group disabled:opacity-50 disabled:cursor-not-allowed"
          title={title}
        >
          <Icon className="w-4 h-4 text-text-muted group-hover:text-text-primary" />
        </button>
      ))}
    </div>
  );
}

/**
 * Simple Markdown parser - removes ** and converts to clean text
 */
function parseMarkdown(text) {
  if (!text) return '';
  return text
    // Bold **text** → text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    // Italic *text* → text
    .replace(/\*([^*]+)\*/g, '$1')
    // Headers ## → nothing
    .replace(/^#+\s*/gm, '')
    // Lists - → •
    .replace(/^-\s+/gm, '• ')
    // Numbered lists
    .replace(/^\d+\.\s+/gm, '')
    .trim();
}

/**
 * Generation Status Indicator Component
 * Фазы: analyzing → generating → generating_image → complete
 * С progress bar и процентами
 */
function GenerationStatus({ phase, progress, status, imagesCount = 0, expectedImages = 3 }) {
  // Определяем фазу по статусу от сервера или по тексту
  const getPhaseInfo = () => {
    // Сначала проверяем статус от WebSocket
    if (status === 'analyzing') {
      return {
        icon: Brain,
        label: '🧠 Анализирую запрос...',
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/10',
        progressColor: 'bg-purple-400',
        percent: 15
      };
    }

    if (status === 'generating_image') {
      // Прогресс на основе количества сгенерированных картинок
      const imagePercent = 50 + Math.round((imagesCount / expectedImages) * 40);
      return {
        icon: ImageIcon,
        label: `🎨 Создаю изображение ${imagesCount + 1}/${expectedImages}...`,
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500/10',
        progressColor: 'bg-yellow-400',
        percent: Math.min(imagePercent, 90)
      };
    }

    if (status === 'generating') {
      return {
        icon: Sparkles,
        label: '✨ Генерирую ответ...',
        color: 'text-green-400',
        bgColor: 'bg-green-500/10',
        progressColor: 'bg-green-400',
        percent: 35
      };
    }

    // Fallback: определяем по тексту progress
    const progressLower = (progress || '').toLowerCase();

    if (progressLower.includes('анализ') || progressLower.includes('думаю')) {
      return {
        icon: Brain,
        label: '🧠 Анализирую запрос...',
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/10',
        progressColor: 'bg-purple-400',
        percent: 15
      };
    }

    if (progressLower.includes('изображен') || progressLower.includes('картин') ||
        progressLower.includes('image') || progressLower.includes('создаю')) {
      return {
        icon: ImageIcon,
        label: '🎨 Создаю изображение...',
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500/10',
        progressColor: 'bg-yellow-400',
        percent: 60
      };
    }

    if (progressLower.includes('генер') || progressLower.includes('ответ')) {
      return {
        icon: Sparkles,
        label: '✨ Генерирую ответ...',
        color: 'text-green-400',
        bgColor: 'bg-green-500/10',
        progressColor: 'bg-green-400',
        percent: 35
      };
    }

    // По умолчанию
    return {
      icon: Wrench,
      label: progress || '⚡ Обрабатываю...',
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      progressColor: 'bg-blue-400',
      percent: 25
    };
  };

  const phaseInfo = getPhaseInfo();
  const Icon = phaseInfo.icon;

  return (
    <div className={`p-3 rounded-xl ${phaseInfo.bgColor} animate-fade-in`}>
      {/* Phase indicator */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm">
          <span className={`flex items-center gap-1.5 ${phaseInfo.color}`}>
            <Icon className="w-4 h-4 animate-pulse" />
            <span className="font-medium">{phaseInfo.label}</span>
          </span>
        </div>

        {/* Percentage */}
        <span className={`text-xs font-medium ${phaseInfo.color}`}>
          {phaseInfo.percent}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-black/20 rounded-full overflow-hidden">
        <div
          className={`h-full ${phaseInfo.progressColor} rounded-full transition-all duration-500 ease-out progress-stripe progress-glow`}
          style={{ width: `${phaseInfo.percent}%` }}
        />
      </div>

      {/* Animated dots */}
      <div className="flex justify-center gap-1 mt-2">
        <span className={`w-1.5 h-1.5 rounded-full ${phaseInfo.color.replace('text-', 'bg-')} opacity-60 animate-bounce`} style={{ animationDelay: '0ms' }}></span>
        <span className={`w-1.5 h-1.5 rounded-full ${phaseInfo.color.replace('text-', 'bg-')} opacity-60 animate-bounce`} style={{ animationDelay: '150ms' }}></span>
        <span className={`w-1.5 h-1.5 rounded-full ${phaseInfo.color.replace('text-', 'bg-')} opacity-60 animate-bounce`} style={{ animationDelay: '300ms' }}></span>
      </div>
    </div>
  );
}

/**
 * Nano Banana Pro Badge
 */
function NanoBananaBadge() {
  return (
    <div className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-full text-xs border border-white/10">
      <span>🍌</span>
      <span className="text-yellow-400 font-medium">Nano Banana Pro</span>
    </div>
  );
}

export function Message({ message }) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(null);
  const [referencePreview, setReferencePreview] = useState(false);

  // Get the current preview image URL
  const previewImage = referencePreview
    ? message.referenceUrl
    : (previewIndex !== null && message.imageUrls?.[previewIndex]
      ? message.imageUrls[previewIndex]
      : null);

  // Check if we have multiple images for navigation
  const hasMultipleImages = message.imageUrls?.length > 1 && !referencePreview;
  const canGoBack = hasMultipleImages && previewIndex > 0;
  const canGoForward = hasMultipleImages && previewIndex < message.imageUrls.length - 1;

  // Navigation functions for preview modal
  const goToPrevious = (e) => {
    e.stopPropagation();
    if (canGoBack) {
      setPreviewIndex(previewIndex - 1);
    }
  };

  const goToNext = (e) => {
    e.stopPropagation();
    if (canGoForward) {
      setPreviewIndex(previewIndex + 1);
    }
  };

  // Open preview at specific index
  const openPreview = (index) => {
    setReferencePreview(false);
    setPreviewIndex(index);
  };

  // Open reference preview
  const openReferencePreview = () => {
    setPreviewIndex(null);
    setReferencePreview(true);
  };

  // Close preview
  const closePreview = () => {
    setPreviewIndex(null);
    setReferencePreview(false);
  };

  // Копирование промпта
  const copyPrompt = () => {
    const text = message.enhancedPrompt || message.content;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Скачивание изображения
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

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 animate-slide-up`}>
      <div className={`max-w-[85%] md:max-w-[75%] ${isUser ? 'order-2' : 'order-1'}`}>
        {/* Avatar + Message */}
        <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
          {/* Avatar */}
          <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
            isUser ? 'bg-accent/20' : 'bg-gradient-to-br from-accent to-accent-hover'
          }`}>
            {isUser ? (
              <User className="w-4 h-4 text-accent" />
            ) : (
              <Sparkles className="w-4 h-4 text-white" />
            )}
          </div>

          {/* Content */}
          <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
            {/* Role label with Deep Research button for assistant */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-text-muted">
                {isUser ? 'Вы' : 'MST CREO AI'}
              </span>

            </div>

            {/* Message bubble - Glass morphism */}
            <div className={`rounded-2xl p-4 ${
              isUser
                ? 'glass-accent'
                : 'glass'
            }`}>
              {/* Tool use indicators ПЕРВЫМИ (like Genspark) */}
              {message.isGenerating && message.activeTools?.length > 0 && (
                <div className="mb-3">
                  {message.activeTools.map((tool, i) => (
                    <ToolUseIndicator key={i} {...tool} />
                  ))}
                </div>
              )}

              {/* Text content - показываем и во время генерации (streaming) */}
              {message.content && (
                <p className="text-text-primary whitespace-pre-wrap">
                  {parseMarkdown(message.content)}
                  {message.isGenerating && <span className="typing-cursor">▋</span>}
                </p>
              )}

              {/* Partial text во время генерации (если content ещё пустой) */}
              {!message.content && message.partialText && message.isGenerating && (
                <p className="text-text-primary whitespace-pre-wrap">
                  {parseMarkdown(message.partialText)}
                  <span className="typing-cursor">▋</span>
                </p>
              )}

              {/* Reference image (from user) - single */}
              {message.referenceUrl && !message.imageUrls && (
                <div className="mt-3">
                  <span className="text-xs text-text-muted block mb-1">Референс:</span>
                  <img
                    src={message.referenceUrl}
                    alt="Reference"
                    className="max-h-32 rounded-lg cursor-pointer hover:opacity-90 transition"
                    onClick={() => openReferencePreview()}
                  />
                </div>
              )}

              {/* Multiple reference images (from user) - до 14 картинок */}
              {isUser && message.imageUrls?.length > 0 && (
                <div className="mt-3">
                  <span className="text-xs text-text-muted block mb-2">
                    📎 {message.imageUrls.length} референс{message.imageUrls.length > 1 ? 'ов' : ''}:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {message.imageUrls.map((url, index) => (
                      <img
                        key={index}
                        src={url}
                        alt={`Reference ${index + 1}`}
                        className="h-16 w-16 rounded-lg object-cover cursor-pointer hover:opacity-90 transition border border-border"
                        onClick={() => openPreview(index)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Generated images (only for assistant) */}
              {!isUser && message.imageUrls?.length > 0 && (
                <div className={`${message.content ? 'mt-4' : ''}`}>
                  {/* Section header for multiple images */}
                  {message.imageUrls.length > 1 && (
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
                      <span className="text-xs text-text-muted font-medium px-2">
                        {message.imageUrls.length} вариации
                      </span>
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
                    </div>
                  )}

                  {/* Responsive image grid */}
                  <div className={`grid gap-3 ${
                    message.imageUrls.length === 1
                      ? 'grid-cols-1'
                      : message.imageUrls.length === 2
                        ? 'grid-cols-2'
                        : message.imageUrls.length === 3
                          ? 'grid-cols-3 md:grid-cols-3'
                          : message.imageUrls.length === 4
                            ? 'grid-cols-2'
                            : 'grid-cols-3'
                  }`}>
                    {message.imageUrls.map((url, index) => (
                      <div
                        key={index}
                        className={`relative group rounded-xl overflow-hidden animate-scale-in cursor-pointer
                          ${message.imageUrls.length === 5 && index >= 3 ? 'col-span-1' : ''}
                          transition-all duration-300 ease-out
                          hover:scale-[1.02] hover:z-10
                          ring-2 ring-transparent hover:ring-accent/50
                          shadow-lg hover:shadow-xl hover:shadow-accent/20
                        `}
                        style={{ animationDelay: `${index * 75}ms` }}
                        onClick={() => openPreview(index)}
                      >
                        {/* Image */}
                        <img
                          src={url}
                          alt={`Вариация ${index + 1}`}
                          className="w-full h-full object-cover aspect-square transition-transform duration-300"
                        />

                        {/* Nano Banana Pro badge */}
                        <NanoBananaBadge />

                        {/* Variation number badge */}
                        <div className="absolute top-2 left-2 z-10">
                          <span className="
                            inline-flex items-center justify-center
                            w-6 h-6 text-xs font-bold
                            bg-black/60 backdrop-blur-sm
                            text-white rounded-full
                            border border-white/20
                            shadow-lg
                          ">
                            {index + 1}
                          </span>
                        </div>

                        {/* Gradient overlay on hover */}
                        <div className="
                          absolute inset-0
                          bg-gradient-to-t from-black/70 via-black/20 to-transparent
                          opacity-0 group-hover:opacity-100
                          transition-opacity duration-300
                        " />

                        {/* Action buttons overlay */}
                        <div className="
                          absolute inset-0
                          flex items-center justify-center gap-3
                          opacity-0 group-hover:opacity-100
                          transition-all duration-300
                          translate-y-2 group-hover:translate-y-0
                        ">
                          <button
                            onClick={(e) => { e.stopPropagation(); openPreview(index); }}
                            className="
                              p-2.5
                              bg-white/20 hover:bg-white/30
                              backdrop-blur-sm
                              rounded-full
                              transition-all duration-200
                              hover:scale-110
                              border border-white/20
                              shadow-lg
                            "
                            title="Увеличить"
                          >
                            <Maximize2 className="w-4 h-4 text-white" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); downloadImage(url, index); }}
                            className="
                              p-2.5
                              bg-white/20 hover:bg-white/30
                              backdrop-blur-sm
                              rounded-full
                              transition-all duration-200
                              hover:scale-110
                              border border-white/20
                              shadow-lg
                            "
                            title="Скачать"
                          >
                            <Download className="w-4 h-4 text-white" />
                          </button>
                        </div>

                        {/* Bottom action bar with edit button */}
                        <div className="
                          absolute bottom-0 left-0 right-0
                          p-2
                          bg-gradient-to-t from-black/80 to-transparent
                          opacity-0 group-hover:opacity-100
                          transition-opacity duration-300
                        ">
                          <ImageEditButton imageUrl={url} index={index} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Quick actions after images - Genspark style */}
                  <div className="flex flex-wrap gap-2 mt-4">
                    {/* Primary actions */}
                    <button
                      onClick={() => {
                        message.imageUrls.forEach((url, i) => downloadImage(url, i));
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/20 hover:bg-accent/30 text-accent rounded-lg text-sm font-medium transition"
                    >
                      <Download className="w-4 h-4" />
                      <span>Скачать все</span>
                    </button>
                    <MoreVariantsButton imageUrls={message.imageUrls} />
                  </div>
                </div>
              )}

              {/* Error message */}
              {message.errorMessage && (
                <div className="mt-3 flex items-start gap-2 text-error bg-error/10 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span className="text-sm">{message.errorMessage}</span>
                </div>
              )}

              {/* Generation status with phases and progress bar */}
              {message.isGenerating && (
                <div className="mt-3">
                  <GenerationStatus
                    phase={message.generationPhase}
                    progress={message.generationProgress}
                    status={message.generationStatus}
                    imagesCount={message.imageUrls?.length || 0}
                    expectedImages={3}
                  />
                </div>
              )}
            </div>

            {/* Meta info (model, time) */}
            {(message.modelUsed || message.generationTimeMs) && (
              <div className="flex items-center gap-3 mt-2 text-xs text-text-muted animate-fade-in">
                {message.modelUsed && (
                  <span className="badge-accent">
                    {message.modelUsed}
                  </span>
                )}
                {message.generationTimeMs && (
                  <span>{(message.generationTimeMs / 1000).toFixed(1)}с</span>
                )}

                {/* Copy enhanced prompt */}
                {message.enhancedPrompt && (
                  <button
                    onClick={copyPrompt}
                    className="flex items-center gap-1 hover:text-text-primary transition"
                    title="Копировать промпт"
                  >
                    {copied ? (
                      <Check className="w-3 h-3 text-success" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>Промпт</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center animate-fade-in"
          onClick={closePreview}
        >
          {/* Close button */}
          <button
            onClick={closePreview}
            className="
              absolute top-4 right-4 z-10
              p-2 rounded-full
              bg-white/10 hover:bg-white/20
              backdrop-blur-sm
              border border-white/10
              transition-all duration-200
              hover:scale-110
            "
            title="Закрыть (Esc)"
          >
            <X className="w-5 h-5 text-white" />
          </button>

          {/* Image counter badge */}
          {hasMultipleImages && (
            <div className="
              absolute top-4 left-1/2 -translate-x-1/2 z-10
              px-4 py-2 rounded-full
              bg-black/60 backdrop-blur-sm
              border border-white/10
              text-white text-sm font-medium
            ">
              <span className="text-accent">{previewIndex + 1}</span>
              <span className="text-white/60 mx-1">/</span>
              <span>{message.imageUrls.length}</span>
            </div>
          )}

          {/* Navigation - Previous */}
          {hasMultipleImages && (
            <button
              onClick={goToPrevious}
              disabled={!canGoBack}
              className={`
                absolute left-4 top-1/2 -translate-y-1/2 z-10
                p-3 rounded-full
                bg-white/10 hover:bg-white/20
                backdrop-blur-sm
                border border-white/10
                transition-all duration-200
                ${canGoBack ? 'hover:scale-110 cursor-pointer' : 'opacity-30 cursor-not-allowed'}
              `}
              title="Предыдущее"
            >
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
          )}

          {/* Navigation - Next */}
          {hasMultipleImages && (
            <button
              onClick={goToNext}
              disabled={!canGoForward}
              className={`
                absolute right-4 top-1/2 -translate-y-1/2 z-10
                p-3 rounded-full
                bg-white/10 hover:bg-white/20
                backdrop-blur-sm
                border border-white/10
                transition-all duration-200
                ${canGoForward ? 'hover:scale-110 cursor-pointer' : 'opacity-30 cursor-not-allowed'}
              `}
              title="Следующее"
            >
              <ChevronRight className="w-6 h-6 text-white" />
            </button>
          )}

          {/* Main image container */}
          <div className="relative max-w-[90vw] max-h-[80vh] p-4" onClick={(e) => e.stopPropagation()}>
            <img
              src={previewImage}
              alt={referencePreview ? 'Reference' : `Вариация ${previewIndex + 1}`}
              className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-2xl animate-scale-in"
            />

            {/* Variation badge on image */}
            {!referencePreview && (
              <div className="
                absolute top-6 left-6
                px-3 py-1.5 rounded-lg
                bg-black/60 backdrop-blur-sm
                border border-white/10
                text-white text-sm font-medium
              ">
                Вариация {previewIndex + 1}
              </div>
            )}
          </div>

          {/* Bottom action bar */}
          <div className="
            absolute bottom-6 left-1/2 -translate-x-1/2
            flex items-center gap-3
            p-2 rounded-2xl
            bg-black/60 backdrop-blur-md
            border border-white/10
          ">
            <button
              onClick={(e) => {
                e.stopPropagation();
                const a = document.createElement('a');
                a.href = previewImage;
                a.download = referencePreview ? 'reference.png' : `banner-variation-${previewIndex + 1}.png`;
                a.click();
              }}
              className="
                flex items-center gap-2 px-4 py-2
                bg-accent hover:bg-accent-hover
                text-white rounded-xl
                transition-all duration-200
                font-medium text-sm
              "
            >
              <Download className="w-4 h-4" />
              Скачать
            </button>
            <a
              href={previewImage}
              target="_blank"
              rel="noopener noreferrer"
              className="
                flex items-center gap-2 px-4 py-2
                bg-white/10 hover:bg-white/20
                text-white rounded-xl
                transition-all duration-200
                font-medium text-sm
              "
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="w-4 h-4" />
              Открыть
            </a>
          </div>

          {/* Thumbnail strip for multiple images */}
          {hasMultipleImages && message.imageUrls.length <= 5 && (
            <div className="
              absolute bottom-24 left-1/2 -translate-x-1/2
              flex items-center gap-2
              p-2 rounded-xl
              bg-black/40 backdrop-blur-sm
              border border-white/10
            ">
              {message.imageUrls.map((url, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewIndex(idx);
                  }}
                  className={`
                    w-12 h-12 rounded-lg overflow-hidden
                    transition-all duration-200
                    ${idx === previewIndex
                      ? 'ring-2 ring-accent scale-110'
                      : 'opacity-60 hover:opacity-100 hover:scale-105'
                    }
                  `}
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
