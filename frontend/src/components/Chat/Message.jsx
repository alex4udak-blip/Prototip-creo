import { useState } from 'react';
import { Download, Copy, Check, ExternalLink, AlertCircle, Sparkles, User, Maximize2 } from 'lucide-react';
import { ClarificationQuestions } from './ClarificationQuestions';

export function Message({ message }) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

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
              {/* Text content */}
              {message.content && (
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
                    onClick={() => setPreviewImage(message.referenceUrl)}
                  />
                </div>
              )}

              {/* Generated images */}
              {message.imageUrls?.length > 0 && (
                <div className={`grid gap-2 mt-3 ${
                  message.imageUrls.length === 1 ? 'grid-cols-1' :
                  message.imageUrls.length === 2 ? 'grid-cols-2' :
                  'grid-cols-2'
                }`}>
                  {message.imageUrls.map((url, index) => (
                    <div key={index} className="relative group rounded-lg overflow-hidden">
                      <img
                        src={url}
                        alt={`Generated ${index + 1}`}
                        className="w-full rounded-lg cursor-pointer"
                        onClick={() => setPreviewImage(url)}
                      />

                      {/* Hover overlay */}
                      <div className="image-overlay rounded-lg">
                        <button
                          onClick={(e) => { e.stopPropagation(); setPreviewImage(url); }}
                          className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition"
                          title="Увеличить"
                        >
                          <Maximize2 className="w-4 h-4 text-white" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); downloadImage(url, index); }}
                          className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition"
                          title="Скачать"
                        >
                          <Download className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    </div>
                  ))}
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
                  <ClarificationQuestions clarification={message.clarification} />
                </div>
              )}

              {/* Generating indicator */}
              {message.isGenerating && (
                <div className="mt-3 flex items-center gap-2">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <span className="text-sm text-text-muted">Генерирую...</span>
                </div>
              )}
            </div>

            {/* Meta info (model, time) */}
            {(message.modelUsed || message.generationTimeMs) && (
              <div className="flex items-center gap-3 mt-2 text-xs text-text-muted">
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
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <img
            src={previewImage}
            alt="Preview"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Download button */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4">
            <button
              onClick={() => {
                const a = document.createElement('a');
                a.href = previewImage;
                a.download = 'banner.png';
                a.click();
              }}
              className="btn-primary flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Скачать
            </button>
            <a
              href={previewImage}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary flex items-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="w-4 h-4" />
              Открыть
            </a>
          </div>

          {/* Close hint */}
          <p className="absolute top-4 right-4 text-text-muted text-sm">
            Нажмите для закрытия
          </p>
        </div>
      )}
    </div>
  );
}

export default Message;
