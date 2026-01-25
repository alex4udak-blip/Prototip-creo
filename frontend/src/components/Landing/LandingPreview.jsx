import { useState, useEffect, useRef } from 'react';
import { Download, ExternalLink, Smartphone, Monitor, RefreshCw, Copy, Check, Loader2 } from 'lucide-react';
import { useLandingStore } from '../../hooks/useLanding';

/**
 * Landing Preview Component - Claude.ai Style
 * Shows live preview in iframe with device switching
 */
export function LandingPreview() {
  const { previewHtml, streamingHtml, isStreaming, zipUrl, generationState, analysis, palette } = useLandingStore();

  const [viewMode, setViewMode] = useState('desktop');
  const [copied, setCopied] = useState(false);
  const iframeRef = useRef(null);

  const iframeWidth = viewMode === 'mobile' ? 390 : '100%';
  const iframeHeight = viewMode === 'mobile' ? 844 : '100%';

  // Content to display: streaming HTML during generation, or final HTML when complete
  const displayHtml = streamingHtml || previewHtml;

  // Update iframe content (real-time streaming like Deepseek Artifacts)
  useEffect(() => {
    if (iframeRef.current && displayHtml) {
      const iframe = iframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;

      if (doc) {
        doc.open();
        doc.write(displayHtml);
        doc.close();
      }
    }
  }, [displayHtml]);

  const handleDownload = () => {
    if (zipUrl) {
      window.open(zipUrl, '_blank');
    }
  };

  const handleOpenInNewTab = () => {
    const htmlToOpen = previewHtml || streamingHtml;
    if (htmlToOpen) {
      const blob = new Blob([htmlToOpen], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    }
  };

  const handleCopyHtml = async () => {
    const htmlToCopy = previewHtml || streamingHtml;
    if (htmlToCopy) {
      await navigator.clipboard.writeText(htmlToCopy);
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
            <Monitor className="w-8 h-8 opacity-40" />
          </div>
          <p className="text-lg font-serif font-medium text-[var(--text-secondary)] mb-2">
            Предпросмотр лендинга
          </p>
          <p className="text-sm font-sans opacity-60">
            Здесь появится готовый лендинг после генерации
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
              className="flex items-center gap-2 px-3 py-1.5 ml-2
                bg-[var(--accent)] text-white rounded-xl
                hover:bg-[var(--accent-hover)] transition-colors font-sans text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              <span>ZIP</span>
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
        bg-[var(--bg-tertiary)]">
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
      </div>
    </div>
  );
}

export default LandingPreview;
