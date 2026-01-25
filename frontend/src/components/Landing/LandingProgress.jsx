import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useLandingStore } from '../../hooks/useLanding';

/**
 * Landing Generation Progress - Claude.ai Style
 * Shows step-by-step progress during generation
 */
export function LandingProgress() {
  const { generationState, progress, progressMessage, error } = useLandingStore();

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
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        {isGenerating && (
          <>
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-light)]
              flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-[var(--accent)] animate-spin" />
            </div>
            <div>
              <h3 className="font-serif font-medium text-[var(--text-primary)]">
                Генерация лендинга
              </h3>
              <p className="text-sm font-sans text-[var(--text-muted)]">{progressMessage}</p>
            </div>
          </>
        )}

        {isComplete && (
          <>
            <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30
              flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-serif font-medium text-[var(--text-primary)]">Готово!</h3>
              <p className="text-sm font-sans text-[var(--text-muted)]">
                Лендинг успешно сгенерирован
              </p>
            </div>
          </>
        )}

        {isError && (
          <>
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30
              flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="font-serif font-medium text-[var(--text-primary)]">Ошибка</h3>
              <p className="text-sm font-sans text-red-600">{error}</p>
            </div>
          </>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-sans text-[var(--text-muted)]">Прогресс</span>
          <span className="text-sm font-sans font-medium text-[var(--text-primary)]">{progress}%</span>
        </div>
        <div className="h-2 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              isError ? 'bg-red-500' : isComplete ? 'bg-green-500' : 'bg-[var(--accent)]'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {steps.map((step, index) => {
          const status = getStepStatus(step.threshold);

          return (
            <div
              key={step.id}
              className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                status === 'active' ? 'bg-[var(--accent-light)] border border-[var(--accent)]/30' :
                status === 'complete' ? 'bg-green-50 dark:bg-green-900/20' :
                status === 'error' ? 'bg-red-50 dark:bg-red-900/20' :
                'bg-[var(--bg-secondary)]'
              }`}
            >
              {/* Step indicator */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                status === 'active' ? 'bg-[var(--accent)]' :
                status === 'complete' ? 'bg-green-500' :
                status === 'error' ? 'bg-red-500' :
                'bg-[var(--bg-tertiary)]'
              }`}>
                {status === 'active' && (
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                )}
                {status === 'complete' && (
                  <CheckCircle className="w-4 h-4 text-white" />
                )}
                {status === 'error' && (
                  <XCircle className="w-4 h-4 text-white" />
                )}
                {status === 'pending' && (
                  <span className="text-xs font-sans text-[var(--text-muted)]">{index + 1}</span>
                )}
              </div>

              {/* Step label */}
              <span className={`text-sm font-sans ${
                status === 'active' ? 'text-[var(--accent)] font-medium' :
                status === 'complete' ? 'text-green-600' :
                status === 'error' ? 'text-red-600' :
                'text-[var(--text-muted)]'
              }`}>
                {step.label}
              </span>

              {/* Active indicator */}
              {status === 'active' && (
                <div className="ml-auto flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce"
                    style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce"
                    style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce"
                    style={{ animationDelay: '300ms' }} />
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
