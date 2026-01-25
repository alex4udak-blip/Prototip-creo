import { useState, useCallback } from 'react';
import { Star, ThumbsUp, ThumbsDown, Send, Loader2, CheckCircle } from 'lucide-react';
import { useLandingStore } from '../../hooks/useLanding';
import { apiClient } from '../../services/api';

/**
 * Landing Rating Component
 * Allows users to rate generated landings for the feedback/learning system
 *
 * This is KEY for the "smart" evolving system:
 * - User rates landing (1-5 stars)
 * - Rating stored in database
 * - High-rated landings become examples for future generations
 * - System continuously improves!
 */
export function LandingRating({ landingId, onRated }) {
  const [score, setScore] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [positiveAspects, setPositiveAspects] = useState([]);
  const [negativeAspects, setNegativeAspects] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState(null);

  // Aspect options for quick selection
  const aspectOptions = {
    positive: [
      { id: 'design', label: 'Дизайн' },
      { id: 'animations', label: 'Анимации' },
      { id: 'colors', label: 'Цвета' },
      { id: 'responsive', label: 'Адаптивность' },
      { id: 'code', label: 'Качество кода' },
      { id: 'speed', label: 'Скорость' }
    ],
    negative: [
      { id: 'bugs', label: 'Баги' },
      { id: 'slow', label: 'Тормозит' },
      { id: 'ugly', label: 'Некрасиво' },
      { id: 'wrong_theme', label: 'Не та тема' },
      { id: 'missing_elements', label: 'Не хватает элементов' },
      { id: 'bad_mobile', label: 'Плохо на мобилке' }
    ]
  };

  const toggleAspect = (type, aspectId) => {
    if (type === 'positive') {
      setPositiveAspects(prev =>
        prev.includes(aspectId)
          ? prev.filter(a => a !== aspectId)
          : [...prev, aspectId]
      );
    } else {
      setNegativeAspects(prev =>
        prev.includes(aspectId)
          ? prev.filter(a => a !== aspectId)
          : [...prev, aspectId]
      );
    }
  };

  const handleSubmit = async () => {
    if (score === 0) {
      setError('Выберите оценку от 1 до 5 звёзд');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await apiClient.post(`/landing/v2/${landingId}/rate`, {
        score,
        feedbackText: feedbackText || null,
        positiveAspects,
        negativeAspects
      });

      setIsSubmitted(true);
      if (onRated) {
        onRated({ score, feedbackText, positiveAspects, negativeAspects });
      }
    } catch (err) {
      console.error('Rating failed:', err);
      setError(err.message || 'Не удалось отправить оценку');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Already submitted state
  if (isSubmitted) {
    return (
      <div className="bg-[var(--bg-secondary)] rounded-2xl p-4 border border-[var(--border)]">
        <div className="flex items-center justify-center gap-2 text-green-500">
          <CheckCircle className="w-5 h-5" />
          <span className="font-medium">Спасибо за оценку!</span>
        </div>
        <p className="text-center text-sm text-[var(--text-muted)] mt-2">
          Ваш фидбек поможет улучшить качество генерации
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--bg-secondary)] rounded-2xl p-4 border border-[var(--border)]">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          Оцените результат
        </h3>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Ваша оценка помогает системе учиться и улучшаться
        </p>
      </div>

      {/* Star rating */}
      <div className="flex items-center justify-center gap-1 mb-4">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => setScore(star)}
            onMouseEnter={() => setHoveredStar(star)}
            onMouseLeave={() => setHoveredStar(0)}
            className="p-1 transition-transform hover:scale-110"
          >
            <Star
              className={`w-8 h-8 transition-colors ${
                star <= (hoveredStar || score)
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-gray-400'
              }`}
            />
          </button>
        ))}
      </div>

      {/* Score label */}
      {score > 0 && (
        <div className="text-center text-sm text-[var(--text-secondary)] mb-4">
          {score === 1 && 'Ужасно'}
          {score === 2 && 'Плохо'}
          {score === 3 && 'Нормально'}
          {score === 4 && 'Хорошо'}
          {score === 5 && 'Отлично!'}
        </div>
      )}

      {/* Quick aspects selection */}
      {score > 0 && (
        <>
          {/* Positive aspects (for good ratings) */}
          {score >= 3 && (
            <div className="mb-3">
              <div className="flex items-center gap-1.5 mb-2">
                <ThumbsUp className="w-4 h-4 text-green-500" />
                <span className="text-xs font-medium text-[var(--text-secondary)]">
                  Что понравилось?
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {aspectOptions.positive.map((aspect) => (
                  <button
                    key={aspect.id}
                    onClick={() => toggleAspect('positive', aspect.id)}
                    className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                      positiveAspects.includes(aspect.id)
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-[var(--bg-primary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                    }`}
                  >
                    {aspect.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Negative aspects (for all ratings, but especially important for low) */}
          <div className="mb-3">
            <div className="flex items-center gap-1.5 mb-2">
              <ThumbsDown className="w-4 h-4 text-red-500" />
              <span className="text-xs font-medium text-[var(--text-secondary)]">
                Что можно улучшить?
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {aspectOptions.negative.map((aspect) => (
                <button
                  key={aspect.id}
                  onClick={() => toggleAspect('negative', aspect.id)}
                  className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                    negativeAspects.includes(aspect.id)
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                      : 'bg-[var(--bg-primary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  {aspect.label}
                </button>
              ))}
            </div>
          </div>

          {/* Text feedback */}
          <div className="mb-3">
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Дополнительные комментарии (опционально)..."
              className="w-full px-3 py-2 text-sm bg-[var(--bg-primary)] border border-[var(--border)]
                rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-muted)]
                focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 resize-none"
              rows={2}
            />
          </div>
        </>
      )}

      {/* Error message */}
      {error && (
        <p className="text-xs text-red-500 mb-3">{error}</p>
      )}

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={score === 0 || isSubmitting}
        className={`w-full flex items-center justify-center gap-2 px-4 py-2
          rounded-xl font-medium text-sm transition-all ${
            score === 0 || isSubmitting
              ? 'bg-[var(--bg-primary)] text-[var(--text-muted)] cursor-not-allowed'
              : 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]'
          }`}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Отправка...
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            Отправить оценку
          </>
        )}
      </button>
    </div>
  );
}

export default LandingRating;
