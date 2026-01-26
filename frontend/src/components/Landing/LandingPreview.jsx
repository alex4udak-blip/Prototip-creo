import { useState, useEffect, useRef, useCallback } from 'react';
import { Download, ExternalLink, Smartphone, Monitor, RefreshCw, Copy, Check, Loader2, Star } from 'lucide-react';
import { useLandingStore } from '../../hooks/useLanding';
import { LandingRating } from './LandingRating';

/**
 * Landing Preview Component - Claude.ai Style
 * Shows live preview in iframe with device switching
 */
export function LandingPreview() {
  const { previewHtml, streamingHtml, isStreaming, zipUrl, generationState, analysis, palette, currentLandingId } = useLandingStore();

  const [viewMode, setViewMode] = useState('desktop');
  const [copied, setCopied] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [hasRated, setHasRated] = useState(false);
  const iframeRef = useRef(null);
  const blobUrlRef = useRef(null); // Track blob URL for cleanup

  // Show rating panel when generation is complete and not yet rated
  useEffect(() => {
    if (generationState === 'complete' && currentLandingId && !hasRated) {
      // Show rating after a short delay
      const timer = setTimeout(() => setShowRating(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [generationState, currentLandingId, hasRated]);

  // Reset rating state when new generation starts
  useEffect(() => {
    if (generationState === 'generating') {
      setShowRating(false);
      setHasRated(false);
    }
  }, [generationState]);

  const iframeWidth = viewMode === 'mobile' ? 390 : '100%';
  const iframeHeight = viewMode === 'mobile' ? 844 : '100%';

  // Content to display: streaming HTML during generation, or final HTML when complete
  // Use streamingHtml if it has content (even during streaming), otherwise use previewHtml
  const displayHtml = (streamingHtml && streamingHtml.length > 0) ? streamingHtml : previewHtml;

  // Update iframe content using srcdoc (avoids "Identifier already declared" errors)
  // srcdoc creates a fresh document each time, unlike doc.write which can accumulate state
  useEffect(() => {
    if (iframeRef.current && displayHtml) {
      iframeRef.current.srcdoc = displayHtml;
    }
  }, [displayHtml]);

  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!zipUrl || isDownloading) return;

    setIsDownloading(true);
    try {
      const token = localStorage.getItem('mstcreo_token');
      const response = await fetch(zipUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `landing-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleOpenInNewTab = useCallback(() => {
    // Use displayHtml for consistency
    const htmlToOpen = displayHtml;
    if (htmlToOpen) {
      // Clean up previous blob URL
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
      const blob = new Blob([htmlToOpen], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;
      window.open(url, '_blank');
      // Cleanup after a delay to allow tab to load
      setTimeout(() => {
        if (blobUrlRef.current === url) {
          URL.revokeObjectURL(url);
          blobUrlRef.current = null;
        }
      }, 5000);
    }
  }, [displayHtml]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, []);

  const handleCopyHtml = async () => {
    // Use displayHtml for consistency - it already has the right priority
    if (displayHtml) {
      await navigator.clipboard.writeText(displayHtml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const refreshPreview = () => {
    if (iframeRef.current && displayHtml) {
      const iframe = iframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;

      if (doc) {
        doc.open();
        doc.write(displayHtml);
        doc.close();
      }
    }
  };

  // Empty state (but show streaming HTML even during generation)
  if (!displayHtml && generationState !== 'complete') {
    return (
      <div className="h-full flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="text-center text-[var(--text-muted)] max-w-sm px-4">
          <div className="w-16 h-16 rounded-2xl bg-[var(--bg-secondary)]
            flex items-center justify-center mx-auto mb-4">
            {generationState === 'generating' ? (
              <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
            ) : (
              <Monitor className="w-8 h-8 opacity-40" />
            )}
          </div>
          <p className="text-lg font-serif font-medium text-[var(--text-secondary)] mb-2">
            {generationState === 'generating' ? 'Генерация лендинга...' : 'Предпросмотр лендинга'}
          </p>
          <p className="text-sm font-sans opacity-60">
            {generationState === 'generating'
              ? 'Ожидаем HTML-код от Claude...'
              : 'Здесь появится готовый лендинг после генерации'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)]">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2
        border-b border-[var(--border)] bg-[var(--bg-secondary)]">
        {/* Device switcher */}
        <div className="flex items-center gap-1 bg-[var(--bg-primary)] rounded-xl p-1">
          <button
            onClick={() => setViewMode('desktop')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'desktop'
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
            title="Desktop"
          >
            <Monitor className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('mobile')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'mobile'
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
            title="Mobile"
          >
            <Smartphone className="w-4 h-4" />
          </button>
        </div>

        {/* Analysis info + Streaming indicator */}
        <div className="hidden md:flex items-center gap-2 text-xs font-sans text-[var(--text-muted)]">
          {isStreaming && (
            <span className="flex items-center gap-1.5 px-2 py-1 bg-[var(--accent-light)] text-[var(--accent)] rounded-lg">
              <Loader2 className="w-3 h-3 animate-spin" />
              Стриминг HTML...
            </span>
          )}
          {analysis?.slotName && (
            <span className="px-2 py-1 bg-[var(--bg-primary)] rounded-lg">
              {analysis.slotName}
            </span>
          )}
          {analysis?.mechanicType && (
            <span className="px-2 py-1 bg-[var(--bg-primary)] rounded-lg capitalize">
              {analysis.mechanicType}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={refreshPreview}
            className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)]
              hover:bg-[var(--bg-hover)] rounded-xl transition-colors"
            title="Обновить"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleCopyHtml}
            className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)]
              hover:bg-[var(--bg-hover)] rounded-xl transition-colors"
            title="Копировать HTML"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-600" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>

          <button
            onClick={handleOpenInNewTab}
            className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)]
              hover:bg-[var(--bg-hover)] rounded-xl transition-colors"
            title="Открыть в новой вкладке"
          >
            <ExternalLink className="w-4 h-4" />
          </button>

          {zipUrl && (
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className={`flex items-center gap-2 px-3 py-1.5 ml-2
                rounded-xl transition-colors font-sans text-sm font-medium ${
                  isDownloading
                    ? 'bg-[var(--bg-hover)] text-[var(--text-muted)] cursor-wait'
                    : 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]'
                }`}
            >
              {isDownloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>{isDownloading ? 'Загрузка...' : 'ZIP'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Color palette */}
      {palette && (
        <div className="flex items-center gap-2 px-4 py-2
          border-b border-[var(--border)] bg-[var(--bg-secondary)]/50">
          <span className="text-xs font-sans text-[var(--text-muted)] mr-2">Палитра:</span>
          {Object.entries(palette).map(([name, color]) => (
            <div
              key={name}
              className="w-6 h-6 rounded-full border border-[var(--border)] cursor-pointer
                hover:scale-110 transition-transform"
              style={{ backgroundColor: color }}
              title={`${name}: ${color}`}
            />
          ))}
        </div>
      )}

      {/* Preview iframe */}
      <div className="flex-1 overflow-auto flex items-start justify-center p-4
        bg-[var(--bg-tertiary)] relative">
        <div
          className={`bg-white rounded-2xl shadow-lg overflow-hidden transition-all duration-300 ${
            viewMode === 'mobile' ? 'border-4 border-gray-800 rounded-[40px]' : ''
          }`}
          style={{
            width: iframeWidth,
            height: viewMode === 'mobile' ? iframeHeight : 'calc(100% - 2rem)',
            maxHeight: viewMode === 'mobile' ? '844px' : undefined
          }}
        >
          <iframe
            ref={iframeRef}
            title="Landing Preview"
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin"
          />
        </div>

        {/* Rating panel - appears after generation completes */}
        {showRating && currentLandingId && !hasRated && (
          <div className="absolute bottom-4 right-4 w-80 z-10 animate-slide-up">
            <LandingRating
              landingId={currentLandingId}
              onRated={(rating) => {
                setHasRated(true);
                setShowRating(false);
              }}
            />
          </div>
        )}

        {/* Rating button (when rating panel is hidden but user can still rate) */}
        {generationState === 'complete' && currentLandingId && !showRating && !hasRated && (
          <button
            onClick={() => setShowRating(true)}
            className="absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2
              bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl
              text-sm font-medium text-[var(--text-secondary)]
              hover:bg-[var(--bg-hover)] transition-colors shadow-lg"
          >
            <Star className="w-4 h-4 text-yellow-400" />
            Оценить результат
          </button>
        )}
      </div>
    </div>
  );
}

export default LandingPreview;
