import { useState, useEffect } from 'react';
import {
  Send,
  SkipForward,
  Check,
  Zap,
  Brain,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Target,
  Sparkles,
  Loader2
} from 'lucide-react';
import { useChatStore } from '../../hooks/useChat';

/**
 * Компонент для отображения уточняющих вопросов - УЛУЧШЕННЫЙ
 *
 * Новые функции:
 * - Контекстные вопросы (разные для разных типов контента)
 * - Режим Deep Thinking
 * - Кнопка "Сгенерировать сразу"
 * - Показ процесса мышления AI
 * - Слайдеры для числовых значений
 */
export function ClarificationQuestions({ clarification, messageId }) {
  const {
    submitClarificationAnswers,
    skipClarification,
    quickGenerate,
    isGenerating,
    generationStatus
  } = useChatStore();

  const [answers, setAnswers] = useState({});
  const [customInputs, setCustomInputs] = useState({});
  const [showThinking, setShowThinking] = useState(false);
  const [deepThinkingEnabled, setDeepThinkingEnabled] = useState(false);
  const [sliderValues, setSliderValues] = useState({});

  // Сброс состояния при новых вопросах
  useEffect(() => {
    setAnswers({});
    setCustomInputs({});
    setSliderValues({});
  }, [clarification?.questions]);

  if (!clarification?.questions) return null;

  const { questions, summary, detected_context, thinking, known_info } = clarification;

  // Обработчики выбора
  const handleSelect = (questionId, value) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleMultiSelect = (questionId, value) => {
    const current = answers[questionId] || [];
    const newValue = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    setAnswers(prev => ({ ...prev, [questionId]: newValue }));
  };

  const handleCustomInput = (questionId, value) => {
    setCustomInputs(prev => ({ ...prev, [questionId]: value }));
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSliderChange = (questionId, value) => {
    setSliderValues(prev => ({ ...prev, [questionId]: value }));
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  // Отправка ответов
  const handleSubmit = () => {
    if (isGenerating) return;
    submitClarificationAnswers(answers, { deepThinking: deepThinkingEnabled });
  };

  // Пропустить вопросы
  const handleSkip = () => {
    if (isGenerating) return;
    skipClarification({ deepThinking: deepThinkingEnabled });
  };

  // Быстрая генерация без ответов
  const handleQuickGenerate = () => {
    if (isGenerating) return;
    quickGenerate({ deepThinking: deepThinkingEnabled });
  };

  // Проверки состояния
  const isAnswered = (questionId) => {
    const answer = answers[questionId];
    if (Array.isArray(answer)) return answer.length > 0;
    return !!answer;
  };

  const allAnswered = questions.every(q => isAnswered(q.id));
  const someAnswered = questions.some(q => isAnswered(q.id));

  // Получаем иконку и цвет для контекста
  const getContextInfo = (context) => {
    const contexts = {
      CASINO_GAMBLING: { icon: Sparkles, color: 'text-yellow-500', label: 'Казино/Гемблинг' },
      AFFILIATE: { icon: Target, color: 'text-green-500', label: 'Арбитраж' },
      BANNER_AD: { icon: Zap, color: 'text-blue-500', label: 'Баннер' },
      SOCIAL_MEDIA: { icon: Sparkles, color: 'text-pink-500', label: 'Соцсети' },
      PRODUCT: { icon: Target, color: 'text-purple-500', label: 'Продукт' },
      CHARACTER: { icon: Sparkles, color: 'text-orange-500', label: 'Персонаж' }
    };
    return contexts[context] || { icon: Lightbulb, color: 'text-accent', label: 'Креатив' };
  };

  const contextInfo = getContextInfo(detected_context);
  const ContextIcon = contextInfo.icon;

  return (
    <div className="bg-bg-secondary/50 rounded-xl border border-border overflow-hidden">
      {/* Заголовок с контекстом */}
      <div className="px-4 py-3 bg-bg-secondary/80 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ContextIcon className={`w-4 h-4 ${contextInfo.color}`} />
            <span className="text-xs font-medium text-text-secondary">
              {contextInfo.label}
            </span>
          </div>

          {/* Deep Thinking переключатель */}
          <button
            onClick={() => setDeepThinkingEnabled(!deepThinkingEnabled)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-all ${
              deepThinkingEnabled
                ? 'bg-accent/20 text-accent border border-accent/30'
                : 'bg-bg-primary text-text-muted hover:text-text-secondary border border-transparent'
            }`}
            title="Глубокий анализ - Claude думает дольше, но выдаёт лучший результат"
          >
            <Brain className="w-3.5 h-3.5" />
            Deep Thinking
          </button>
        </div>

        {/* Саммари */}
        <p className="mt-2 text-sm text-text-primary">{summary}</p>

        {/* Известная информация */}
        {known_info && Object.values(known_info).some(v => v) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Object.entries(known_info)
              .filter(([_, v]) => v)
              .map(([key, value]) => (
                <span
                  key={key}
                  className="px-2 py-0.5 text-xs bg-green-500/10 text-green-400 rounded-full"
                >
                  {key}: {value}
                </span>
              ))}
          </div>
        )}
      </div>

      {/* Вопросы */}
      <div className="p-4 space-y-4">
        {questions.map((question, idx) => (
          <QuestionBlock
            key={question.id}
            question={question}
            index={idx}
            answer={answers[question.id]}
            customInput={customInputs[question.id]}
            sliderValue={sliderValues[question.id]}
            isGenerating={isGenerating}
            onSelect={(value) => handleSelect(question.id, value)}
            onMultiSelect={(value) => handleMultiSelect(question.id, value)}
            onCustomInput={(value) => handleCustomInput(question.id, value)}
            onSliderChange={(value) => handleSliderChange(question.id, value)}
          />
        ))}
      </div>

      {/* AI Thinking (если есть) */}
      {thinking && (
        <div className="px-4 pb-2">
          <button
            onClick={() => setShowThinking(!showThinking)}
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            <Lightbulb className="w-3.5 h-3.5" />
            Почему эти вопросы?
            {showThinking ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>

          {showThinking && (
            <div className="mt-2 p-3 bg-bg-primary rounded-lg text-xs text-text-muted italic">
              {thinking}
            </div>
          )}
        </div>
      )}

      {/* Кнопки действий */}
      <div className="px-4 py-3 bg-bg-secondary/50 border-t border-border">
        <div className="flex flex-wrap items-center gap-2">
          {/* Основная кнопка - Сгенерировать с ответами */}
          <button
            onClick={handleSubmit}
            disabled={!allAnswered || isGenerating}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              allAnswered && !isGenerating
                ? 'bg-accent hover:bg-accent-hover text-white shadow-lg shadow-accent/25'
                : 'bg-bg-secondary text-text-muted cursor-not-allowed'
            }`}
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {deepThinkingEnabled ? 'Глубокий анализ' : 'Сгенерировать'}
          </button>

          {/* Быстрая генерация */}
          <button
            onClick={handleQuickGenerate}
            disabled={isGenerating}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              isGenerating
                ? 'bg-bg-secondary text-text-muted cursor-not-allowed'
                : 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 border border-yellow-500/30'
            }`}
            title="Сгенерировать сразу без ответов на вопросы"
          >
            <Zap className="w-4 h-4" />
            Сразу
          </button>

          {/* Пропустить */}
          <button
            onClick={handleSkip}
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            <SkipForward className="w-4 h-4" />
            Пропустить
          </button>

          {/* Индикатор прогресса */}
          {someAnswered && !allAnswered && (
            <span className="ml-auto text-xs text-text-muted">
              {questions.filter(q => isAnswered(q.id)).length} / {questions.length}
            </span>
          )}
        </div>

        {/* Подсказка про Deep Thinking */}
        {deepThinkingEnabled && (
          <p className="mt-2 text-xs text-accent/70 flex items-center gap-1.5">
            <Brain className="w-3.5 h-3.5" />
            Режим глубокого анализа: Claude проанализирует психологию, аудиторию и визуальную стратегию
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Блок одного вопроса
 */
function QuestionBlock({
  question,
  index,
  answer,
  customInput,
  sliderValue,
  isGenerating,
  onSelect,
  onMultiSelect,
  onCustomInput,
  onSliderChange
}) {
  const { id, question: questionText, type, options, why } = question;

  const isCustomSelected = answer && (
    answer === 'custom' ||
    answer === 'Другое' ||
    (typeof answer === 'string' && answer.includes('Другое'))
  );

  return (
    <div className="space-y-2">
      {/* Вопрос */}
      <div className="flex items-start gap-2">
        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent/20 text-accent text-xs flex items-center justify-center font-medium">
          {index + 1}
        </span>
        <div className="flex-1">
          <p className="text-sm font-medium text-text-primary">{questionText}</p>
          {why && (
            <p className="text-xs text-text-muted mt-0.5">{why}</p>
          )}
        </div>
      </div>

      {/* Варианты ответов */}
      <div className="ml-7">
        {/* Single Choice */}
        {type === 'single_choice' && options && (
          <div className="flex flex-wrap gap-2">
            {options.map(option => {
              const isSelected = answer === option.label || answer === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => onSelect(option.label)}
                  disabled={isGenerating}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-all ${
                    isSelected
                      ? 'bg-accent border-accent text-white'
                      : 'bg-bg-primary border-border hover:border-accent/50 text-text-secondary hover:text-text-primary'
                  } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isSelected && <Check className="w-3 h-3 inline mr-1" />}
                  {option.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Multiple Choice */}
        {type === 'multiple_choice' && options && (
          <div className="flex flex-wrap gap-2">
            {options.map(option => {
              const selected = Array.isArray(answer) && answer.includes(option.label);
              return (
                <button
                  key={option.value}
                  onClick={() => onMultiSelect(option.label)}
                  disabled={isGenerating}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-all ${
                    selected
                      ? 'bg-accent border-accent text-white'
                      : 'bg-bg-primary border-border hover:border-accent/50 text-text-secondary hover:text-text-primary'
                  } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {selected && <Check className="w-3 h-3 inline mr-1" />}
                  {option.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Text Input */}
        {type === 'text_input' && (
          <input
            type="text"
            value={customInput || ''}
            onChange={(e) => onCustomInput(e.target.value)}
            placeholder="Напишите свой ответ..."
            disabled={isGenerating}
            className="w-full px-3 py-2 text-sm bg-bg-primary border border-border rounded-lg focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30 transition-all"
          />
        )}

        {/* Slider */}
        {type === 'slider' && (
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={question.min || 1}
              max={question.max || 10}
              value={sliderValue || question.default || 5}
              onChange={(e) => onSliderChange(parseInt(e.target.value))}
              disabled={isGenerating}
              className="flex-1 h-2 bg-bg-primary rounded-lg appearance-none cursor-pointer accent-accent"
            />
            <span className="w-8 text-center text-sm font-medium text-accent">
              {sliderValue || question.default || 5}
            </span>
          </div>
        )}

        {/* Custom input для "Другое" */}
        {isCustomSelected && type !== 'text_input' && (
          <input
            type="text"
            value={customInput || ''}
            onChange={(e) => onCustomInput(e.target.value)}
            placeholder="Напишите свой вариант..."
            disabled={isGenerating}
            className="mt-2 w-full px-3 py-2 text-sm bg-bg-primary border border-border rounded-lg focus:border-accent focus:outline-none"
          />
        )}
      </div>
    </div>
  );
}

/**
 * Компонент для отображения процесса Deep Thinking
 */
export function DeepThinkingProgress({ thinking, stage, message }) {
  if (!thinking && !message) return null;

  return (
    <div className="bg-accent/5 border border-accent/20 rounded-xl p-4 space-y-3">
      {/* Заголовок */}
      <div className="flex items-center gap-2">
        <Brain className="w-5 h-5 text-accent animate-pulse" />
        <span className="text-sm font-medium text-accent">Deep Thinking</span>
        <span className="text-xs text-text-muted">
          {stage === 'analyzing' && 'Анализирую...'}
          {stage === 'thinking' && 'Размышляю...'}
          {stage === 'complete' && 'Готово'}
        </span>
      </div>

      {/* Сообщение */}
      {message && (
        <p className="text-sm text-text-secondary">{message}</p>
      )}

      {/* Процесс мышления */}
      {thinking && (
        <div className="p-3 bg-bg-secondary rounded-lg">
          <p className="text-xs text-text-muted font-mono whitespace-pre-wrap">
            {thinking}
          </p>
        </div>
      )}

      {/* Анимация загрузки */}
      {stage !== 'complete' && (
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-xs text-text-muted">Claude думает...</span>
        </div>
      )}
    </div>
  );
}

/**
 * Компонент для отображения результата Deep Analysis
 */
export function DeepAnalysisResult({ analysis }) {
  const [expanded, setExpanded] = useState(false);

  if (!analysis) return null;

  const {
    goal_understanding,
    target_audience,
    psychological_hooks,
    visual_strategy,
    recommendations,
    potential_issues
  } = analysis;

  return (
    <div className="bg-gradient-to-br from-accent/5 to-purple-500/5 border border-accent/20 rounded-xl overflow-hidden">
      {/* Заголовок */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-accent/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-accent" />
          <span className="text-sm font-medium text-text-primary">Глубокий анализ</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-text-muted" />
        ) : (
          <ChevronDown className="w-4 h-4 text-text-muted" />
        )}
      </button>

      {/* Контент */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Цель */}
          {goal_understanding && (
            <div>
              <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">
                Цель
              </h4>
              <p className="text-sm text-text-primary">{goal_understanding}</p>
            </div>
          )}

          {/* Аудитория */}
          {target_audience && (
            <div>
              <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">
                Целевая аудитория
              </h4>
              <p className="text-sm text-text-primary">{target_audience}</p>
            </div>
          )}

          {/* Психологические триггеры */}
          {psychological_hooks?.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">
                Психологические триггеры
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {psychological_hooks.map((hook, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 text-xs bg-purple-500/10 text-purple-400 rounded-full"
                  >
                    {hook}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Визуальная стратегия */}
          {visual_strategy && (
            <div>
              <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">
                Визуальная стратегия
              </h4>
              <p className="text-sm text-text-primary">{visual_strategy}</p>
            </div>
          )}

          {/* Рекомендации */}
          {recommendations?.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">
                Рекомендации
              </h4>
              <ul className="space-y-1">
                {recommendations.map((rec, i) => (
                  <li key={i} className="text-sm text-text-secondary flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Потенциальные проблемы */}
          {potential_issues?.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">
                На что обратить внимание
              </h4>
              <ul className="space-y-1">
                {potential_issues.map((issue, i) => (
                  <li key={i} className="text-sm text-yellow-500/80 flex items-start gap-2">
                    <Lightbulb className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ClarificationQuestions;
