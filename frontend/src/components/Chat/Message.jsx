import { useState } from 'react';
import { Download, Copy, Check, ExternalLink, AlertCircle, Sparkles, User, Maximize2, Brain, Wand2, ImageIcon, CheckCircle2, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { ClarificationQuestions } from './ClarificationQuestions';
import { GENERATION_PHASES, PHASE_LABELS } from '../../hooks/useChat';

/**
 * Generation Status Indicator Component
 * Beautiful animated status like Claude/Genspark
 */
function GenerationStatus({ phase, progress }) {
  const phaseConfig = {
    [GENERATION_PHASES.STARTING]: {
      icon: Sparkles,
      color: 'text-accent',
      bgColor: 'bg-accent/10'
    },
    [GENERATION_PHASES.ANALYZING]: {
      icon: Brain,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10'
    },
    [GENERATION_PHASES.ENHANCING]: {
      icon: Wand2,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10'
    },
    [GENERATION_PHASES.GENERATING]: {
      icon: ImageIcon,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10'
    },
    [GENERATION_PHASES.FINALIZING]: {
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10'
    },
    [GENERATION_PHASES.ERROR]: {
      icon: AlertCircle,
      color: 'text-error',
      bgColor: 'bg-error/10'
    }
  };

  const config = phaseConfig[phase] || phaseConfig[GENERATION_PHASES.GENERATING];
  const Icon = config.icon;
  const label = PHASE_LABELS[phase] || 'Обработка...';

  return (
    <div className={`flex items-center gap-3 p-4 rounded-xl ${config.bgColor} animate-fade-in`}>
      {/* Animated icon */}
      <div className={`relative ${config.color}`}>
        <Icon className="w-5 h-5 animate-pulse" />
        {/* Rotating ring */}
        <div className="absolute inset-0 -m-1">
          <svg className="w-7 h-7 animate-spin-slow" viewBox="0 0 24 24">
            <circle
              cx="12"
              cy="12"
              r="10"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="15 85"
              strokeLinecap="round"
              className="opacity-30"
            />
          </svg>
        </div>
      </div>

      {/* Text */}
      <div className="flex-1">
        <p className={`text-sm font-medium ${config.color}`}>
          {label}
        </p>
        {progress && (
          <p className="text-xs text-text-muted mt-0.5 animate-fade-in">
            {progress}
          </p>
        )}
      </div>

      {/* Animated dots */}
      <div className="flex gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40 animate-bounce-dot-1" style={{ color: config.color.replace('text-', '') }}></span>
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40 animate-bounce-dot-2" style={{ color: config.color.replace('text-', '') }}></span>
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40 animate-bounce-dot-3" style={{ color: config.color.replace('text-', '') }}></span>
      </div>
    </div>
  );
}

/**
 * Phase Progress Bar
 */
function PhaseProgress({ phase }) {
  const phases = [
    GENERATION_PHASES.ANALYZING,
    GENERATION_PHASES.ENHANCING,
    GENERATION_PHASES.GENERATING,
    GENERATION_PHASES.FINALIZING
  ];

  const currentIndex = phases.indexOf(phase);

  return (
    <div className="flex items-center gap-1 mt-3">
      {phases.map((p, index) => (
        <div
          key={p}
          className={`h-1 flex-1 rounded-full transition-all duration-500 ${
            index <= currentIndex
              ? 'bg-accent'
              : 'bg-bg-hover'
          }`}
        />
      ))}
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
            {/* Role label */}
            <span className="text-xs text-text-muted mb-1">
              {isUser ? 'Вы' : 'BannerGen'}
            </span>

            {/* Message bubble */}
            <div className={`rounded-2xl p-4 ${
              isUser
                ? 'bg-accent/20 border border-accent/30'
                : 'bg-bg-secondary border border-border'
            }`}>
              {/* Text content (only if not generating and has content) */}
              {message.content && !message.isGenerating && (
                <p className="text-text-primary whitespace-pre-wrap">
                  {message.content}
                </p>
              )}

              {/* Reference image (from user) */}
              {message.referenceUrl && (
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

              {/* Generated images */}
              {message.imageUrls?.length > 0 && (
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

                        {/* Bottom info bar */}
                        <div className="
                          absolute bottom-0 left-0 right-0
                          p-2
                          bg-gradient-to-t from-black/80 to-transparent
                          opacity-0 group-hover:opacity-100
                          transition-opacity duration-300
                        ">
                          <p className="text-xs text-white/80 text-center font-medium">
                            Вариация {index + 1}
                          </p>
                        </div>
                      </div>
                    ))}
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

              {/* Clarification questions */}
              {message.clarification && (
                <div className="mt-3">
                  <ClarificationQuestions clarification={message.clarification} messageId={message.id} />
                </div>
              )}

              {/* Analyzing status - показываем пока идёт анализ/clarification */}
              {message.isAnalyzing && !message.isGenerating && (
                <div className="mt-3">
                  <GenerationStatus phase={GENERATION_PHASES.ANALYZING} progress="Анализирую запрос..." />
                </div>
              )}

              {/* Generation status - красивый UI в чате */}
              {message.isGenerating && (
                <div className="mt-3">
                  <GenerationStatus phase={message.generationPhase} progress={message.generationProgress} />
                  <PhaseProgress phase={message.generationPhase} />
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
