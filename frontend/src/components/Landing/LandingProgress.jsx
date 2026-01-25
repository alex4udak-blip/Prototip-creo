import { Loader2, CheckCircle, XCircle, MessageSquare, Brain } from 'lucide-react';
import { useLandingStore } from '../../hooks/useLanding';

/**
 * Landing Generation Progress - Claude.ai Style
 * Shows step-by-step progress during generation with thinking log
 */
export function LandingProgress() {
  const { generationState, progress, progressMessage, error, currentPrompt, thinkingLog, analysis } = useLandingStore();

  if (generationState === 'idle') {
    return null;
  }

  const isComplete = generationState === 'complete';
  const isError = generationState === 'error';
  const isGenerating = generationState === 'generating';

  // Step indicators
  const steps = [
    { id: 'analyzing', label: 'Анализ запроса', threshold: 10 },
    { id: 'reference', label: 'Поиск референсов', threshold: 20 },
    { id: 'palette', label: 'Извлечение палитры', threshold: 30 },
    { id: 'assets', label: 'Генерация ассетов', threshold: 60 },
    { id: 'code', label: 'Генерация кода', threshold: 80 },
    { id: 'assembly', label: 'Сборка ZIP', threshold: 95 }
  ];

  const getStepStatus = (threshold) => {
    if (isError) return 'error';
    if (isComplete) return 'complete';
    if (progress >= threshold) return 'complete';
    if (progress >= threshold - 15) return 'active';
    return 'pending';
  };

  return (
    <div className="p-4 space-y-4 max-h-full overflow-y-auto">
      {/* User's prompt */}
      {currentPrompt && (
        <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
          <div className="flex items-start gap-2 mb-2">
            <MessageSquare className="w-4 h-4 text-[var(--accent)] mt-0.5 flex-shrink-0" />
            <span className="text-xs font-sans font-medium text-[var(--text-muted)]">Твой запрос:</span>
          </div>
          <p className="text-sm font-serif text-[var(--text-primary)] pl-6">
            {currentPrompt}
          </p>
        </div>
      )}

      {/* Header with status */}
      <div className="flex items-center gap-3">
        {isGenerating && (
          <>
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-light)] flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-[var(--accent)] animate-spin" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-serif font-medium text-sm text-[var(--text-primary)]">
                Генерация лендинга
              </h3>
              <p className="text-xs font-sans text-[var(--text-muted)] truncate">{progressMessage}</p>
            </div>
          </>
        )}

        {isComplete && (
          <>
            <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <h3 className="font-serif font-medium text-sm text-[var(--text-primary)]">Готово!</h3>
              <p className="text-xs font-sans text-[var(--text-muted)]">Лендинг сгенерирован</p>
            </div>
          </>
        )}

        {isError && (
          <>
            <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <XCircle className="w-4 h-4 text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-serif font-medium text-sm text-[var(--text-primary)]">Ошибка</h3>
              <p className="text-xs font-sans text-red-600 truncate">{error}</p>
            </div>
          </>
        )}
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-sans text-[var(--text-muted)]">Прогресс</span>
          <span className="text-xs font-sans font-medium text-[var(--text-primary)]">{progress}%</span>
        </div>
        <div className="h-1.5 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              isError ? 'bg-red-500' : isComplete ? 'bg-green-500' : 'bg-[var(--accent)]'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Thinking log (Claude's thoughts) */}
      {thinkingLog.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="w-4 h-4 text-[var(--accent)]" />
            <span className="text-xs font-sans font-medium text-[var(--text-muted)]">Что делает Claude:</span>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {thinkingLog.map((log, i) => (
              <div
                key={i}
                className={`text-xs font-sans pl-6 py-1 ${
                  i === thinkingLog.length - 1
                    ? 'text-[var(--text-primary)]'
                    : 'text-[var(--text-muted)]'
                }`}
              >
                {log.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analysis result preview */}
      {analysis && (
        <div className="p-3 rounded-xl bg-[var(--accent-light)] border border-[var(--accent)]/20">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="w-4 h-4 text-[var(--accent)]" />
            <span className="text-xs font-sans font-medium text-[var(--accent)]">Анализ Claude:</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs font-sans">
            {analysis.slotName && (
              <div>
                <span className="text-[var(--text-muted)]">Слот: </span>
                <span className="text-[var(--text-primary)]">{analysis.slotName}</span>
              </div>
            )}
            {analysis.mechanicType && (
              <div>
                <span className="text-[var(--text-muted)]">Механика: </span>
                <span className="text-[var(--text-primary)] capitalize">{analysis.mechanicType}</span>
              </div>
            )}
            {analysis.language && (
              <div>
                <span className="text-[var(--text-muted)]">Язык: </span>
                <span className="text-[var(--text-primary)] uppercase">{analysis.language}</span>
              </div>
            )}
            {analysis.confidence && (
              <div>
                <span className="text-[var(--text-muted)]">Уверенность: </span>
                <span className="text-[var(--text-primary)]">{analysis.confidence}%</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Steps */}
      <div className="space-y-1">
        {steps.map((step, index) => {
          const status = getStepStatus(step.threshold);

          return (
            <div
              key={step.id}
              className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
                status === 'active' ? 'bg-[var(--accent-light)]' :
                status === 'complete' ? 'bg-green-50 dark:bg-green-900/10' :
                status === 'error' ? 'bg-red-50 dark:bg-red-900/10' :
                ''
              }`}
            >
              {/* Step indicator */}
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                status === 'active' ? 'bg-[var(--accent)] text-white' :
                status === 'complete' ? 'bg-green-500 text-white' :
                status === 'error' ? 'bg-red-500 text-white' :
                'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
              }`}>
                {status === 'active' && <Loader2 className="w-3 h-3 animate-spin" />}
                {status === 'complete' && <CheckCircle className="w-3 h-3" />}
                {status === 'error' && <XCircle className="w-3 h-3" />}
                {status === 'pending' && <span>{index + 1}</span>}
              </div>

              {/* Step label */}
              <span className={`text-xs font-sans ${
                status === 'active' ? 'text-[var(--accent)] font-medium' :
                status === 'complete' ? 'text-green-600' :
                status === 'error' ? 'text-red-600' :
                'text-[var(--text-muted)]'
              }`}>
                {step.label}
              </span>

              {/* Active indicator */}
              {status === 'active' && (
                <div className="ml-auto flex gap-0.5">
                  <span className="w-1 h-1 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-1 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-1 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default LandingProgress;
