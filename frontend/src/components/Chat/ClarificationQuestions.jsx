import { useState } from 'react';
import { Send, SkipForward, Check } from 'lucide-react';
import { useChatStore } from '../../hooks/useChat';

/**
 * Компонент для отображения уточняющих вопросов
 * Похож на Genspark UI
 */
export function ClarificationQuestions({ clarification }) {
  const { submitClarificationAnswers, skipClarification, isGenerating } = useChatStore();
  const [answers, setAnswers] = useState({});
  const [customInputs, setCustomInputs] = useState({});

  if (!clarification?.questions) return null;

  const handleSelect = (questionId, value) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleCustomInput = (questionId, value) => {
    setCustomInputs(prev => ({ ...prev, [questionId]: value }));
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = () => {
    if (isGenerating) return;
    submitClarificationAnswers(answers);
  };

  const handleSkip = () => {
    if (isGenerating) return;
    skipClarification();
  };

  const isAnswered = (questionId) => !!answers[questionId];
  const allAnswered = clarification.questions.every(q => isAnswered(q.id));

  return (
    <div className="bg-bg-secondary/50 rounded-xl p-4 space-y-4 border border-border">
      {/* Заголовок */}
      <p className="text-sm text-text-secondary">{clarification.summary}</p>

      {/* Вопросы */}
      <div className="space-y-4">
        {clarification.questions.map((question, idx) => (
          <div key={question.id} className="space-y-2">
            <p className="text-sm font-medium text-text-primary">
              {idx + 1}. {question.question}
            </p>

            {/* Варианты ответов */}
            {question.type === 'single_choice' && (
              <div className="flex flex-wrap gap-2">
                {question.options.map(option => (
                  <button
                    key={option.value}
                    onClick={() => handleSelect(question.id, option.label)}
                    disabled={isGenerating}
                    className={`px-3 py-2 text-sm rounded-lg border transition-all ${
                      answers[question.id] === option.label
                        ? 'bg-accent border-accent text-white'
                        : 'bg-bg-primary border-border hover:border-accent/50 text-text-secondary hover:text-text-primary'
                    } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {answers[question.id] === option.label && (
                      <Check className="w-3 h-3 inline mr-1" />
                    )}
                    {option.label}
                  </button>
                ))}
              </div>
            )}

            {/* Текстовый ввод (если выбрано "Другое" или тип text_input) */}
            {(question.type === 'text_input' ||
              (answers[question.id] && answers[question.id].includes('Другое'))) && (
              <input
                type="text"
                value={customInputs[question.id] || ''}
                onChange={(e) => handleCustomInput(question.id, e.target.value)}
                placeholder="Напишите свой вариант..."
                disabled={isGenerating}
                className="w-full px-3 py-2 text-sm bg-bg-primary border border-border rounded-lg focus:border-accent focus:outline-none"
              />
            )}

            {/* Множественный выбор */}
            {question.type === 'multiple_choice' && (
              <div className="flex flex-wrap gap-2">
                {question.options.map(option => {
                  const selected = (answers[question.id] || []).includes(option.label);
                  return (
                    <button
                      key={option.value}
                      onClick={() => {
                        const current = answers[question.id] || [];
                        const newValue = selected
                          ? current.filter(v => v !== option.label)
                          : [...current, option.label];
                        handleSelect(question.id, newValue);
                      }}
                      disabled={isGenerating}
                      className={`px-3 py-2 text-sm rounded-lg border transition-all ${
                        selected
                          ? 'bg-accent border-accent text-white'
                          : 'bg-bg-primary border-border hover:border-accent/50 text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {selected && <Check className="w-3 h-3 inline mr-1" />}
                      {option.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Кнопки действий */}
      <div className="flex items-center gap-3 pt-2 border-t border-border">
        <button
          onClick={handleSubmit}
          disabled={!allAnswered || isGenerating}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
            allAnswered && !isGenerating
              ? 'bg-accent hover:bg-accent-hover text-white'
              : 'bg-bg-secondary text-text-muted cursor-not-allowed'
          }`}
        >
          <Send className="w-4 h-4" />
          Сгенерировать
        </button>

        <button
          onClick={handleSkip}
          disabled={isGenerating}
          className="flex items-center gap-2 px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <SkipForward className="w-4 h-4" />
          Пропустить вопросы
        </button>
      </div>
    </div>
  );
}

export default ClarificationQuestions;
