import { useState, useRef, useMemo } from 'react';
import { ArrowUp, Image, Loader2, X, Globe, Gift, Link2, Settings, TrendingUp, Zap } from 'lucide-react';
import { useLandingStore } from '../../hooks/useLanding';

/**
 * Detect mechanic type from prompt to show appropriate reward hints
 * Returns: 'crash' | 'wheel' | 'boxes' | 'scratch' | 'loader' | 'slot'
 */
function detectMechanic(prompt) {
  const lowerPrompt = prompt.toLowerCase();

  // Crash-like games (use multipliers: x2, x5, x10)
  if (lowerPrompt.includes('crash') || lowerPrompt.includes('краш') ||
      lowerPrompt.includes('chicken') || lowerPrompt.includes('курица') || lowerPrompt.includes('чикен') ||
      lowerPrompt.includes('aviator') || lowerPrompt.includes('авиатор') ||
      lowerPrompt.includes('mines') || lowerPrompt.includes('мины') ||
      lowerPrompt.includes('plinko') || lowerPrompt.includes('плинко') ||
      lowerPrompt.includes('road') || lowerPrompt.includes('роуд') ||
      lowerPrompt.includes('tower') || lowerPrompt.includes('башн')) {
    return 'crash';
  }

  // Wheel games (use prizes: €500, 100 FS)
  if (lowerPrompt.includes('wheel') || lowerPrompt.includes('колес') ||
      lowerPrompt.includes('fortun') || lowerPrompt.includes('фортун') ||
      lowerPrompt.includes('spin') || lowerPrompt.includes('спин')) {
    return 'wheel';
  }

  // Box games (use prizes)
  if (lowerPrompt.includes('box') || lowerPrompt.includes('коробк') ||
      lowerPrompt.includes('chest') || lowerPrompt.includes('сундук')) {
    return 'boxes';
  }

  // Scratch cards (use prizes)
  if (lowerPrompt.includes('scratch') || lowerPrompt.includes('скретч') ||
      lowerPrompt.includes('скрэтч') || lowerPrompt.includes('карт')) {
    return 'scratch';
  }

  // Slot games
  if (lowerPrompt.includes('slot') || lowerPrompt.includes('слот') ||
      lowerPrompt.includes('gates') || lowerPrompt.includes('bonanz') ||
      lowerPrompt.includes('olymp') || lowerPrompt.includes('sugar') ||
      lowerPrompt.includes('dog') || lowerPrompt.includes('book')) {
    return 'slot';
  }

  return 'auto'; // Let Claude decide
}

/**
 * Get reward type hint based on mechanic
 */
function getRewardHint(mechanic) {
  switch (mechanic) {
    case 'crash':
      return { type: 'multipliers', hint: '💡 Crash-игра: укажите множители (x2, x5, x10)', placeholder: 'x5' };
    case 'wheel':
    case 'boxes':
      return { type: 'prizes', hint: '💡 Колесо/коробки: укажите призы (€500, 100 FS)', placeholder: '€500' };
    case 'scratch':
      return { type: 'prizes', hint: '💡 Скретч-карта: укажите призы', placeholder: '€1000' };
    case 'slot':
      return { type: 'prizes', hint: '💡 Слот: укажите призы или фриспины', placeholder: '500 FS' };
    default:
      return { type: 'rewards', hint: '💡 Награды: €, FS, x-множители', placeholder: '€500' };
  }
}

/**
 * Landing Input Area - Claude.ai Style
 * Natural language input + options for landing generation
 */
export function LandingInput({ onGenerate }) {
  const { generateLanding, generationState } = useLandingStore();

  const [prompt, setPrompt] = useState('');
  const [screenshot, setScreenshot] = useState(null);
  const [showOptions, setShowOptions] = useState(false);
  // Universal rewards - can be prizes (€500) or multipliers (x5)
  const [options, setOptions] = useState({
    rewards: ['€500', '€200', '100 FS'],
    offerUrl: '',
    language: 'en'
  });

  // Detect mechanic type from prompt for hints
  const detectedMechanic = useMemo(() => detectMechanic(prompt), [prompt]);
  const rewardHint = useMemo(() => getRewardHint(detectedMechanic), [detectedMechanic]);

  const fileInputRef = useRef(null);
  const isGenerating = generationState === 'generating';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;

    try {
      await generateLanding({
        prompt: prompt.trim(),
        screenshot,
        prizes: options.rewards.filter(r => r.trim()), // Universal rewards
        offerUrl: options.offerUrl,
        language: options.language
      });

      if (onGenerate) onGenerate();
    } catch (error) {
      console.error('Generation failed:', error);
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      setScreenshot(base64);
    };
    reader.readAsDataURL(file);
  };

  const removeScreenshot = () => {
    setScreenshot(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Universal reward handlers
  const updateReward = (index, value) => {
    const newRewards = [...options.rewards];
    newRewards[index] = value;
    setOptions({ ...options, rewards: newRewards });
  };

  const addReward = () => {
    if (options.rewards.length < 8) {
      setOptions({ ...options, rewards: [...options.rewards, ''] });
    }
  };

  const removeReward = (index) => {
    if (options.rewards.length > 1) {
      setOptions({
        ...options,
        rewards: options.rewards.filter((_, i) => i !== index)
      });
    }
  };

  // Auto-update rewards when mechanic changes
  const setDefaultRewards = (mechanic) => {
    if (mechanic === 'crash') {
      setOptions(prev => ({ ...prev, rewards: ['x2', 'x5', 'x10', 'x50'] }));
    } else if (['wheel', 'boxes', 'scratch'].includes(mechanic)) {
      setOptions(prev => ({ ...prev, rewards: ['€500', '€200', '100 FS'] }));
    }
  };

  return (
    <div className="border-t border-[var(--border)] bg-[var(--bg-primary)] p-4">
      {/* Screenshot preview */}
      {screenshot && (
        <div className="mb-3 relative inline-block">
          <img
            src={`data:image/png;base64,${screenshot}`}
            alt="Reference"
            className="h-20 rounded-xl border border-[var(--border)]"
          />
          <button
            onClick={removeScreenshot}
            className="absolute -top-2 -right-2 p-1 bg-red-500 rounded-full
              hover:bg-red-600 transition-colors shadow-sm"
            aria-label="Remove screenshot"
          >
            <X className="w-3 h-3 text-white" />
          </button>
        </div>
      )}

      {/* Options panel */}
      {showOptions && (
        <div className="mb-4 p-4 bg-[var(--bg-secondary)] rounded-2xl
          border border-[var(--border)] space-y-4">
          {/* Universal Rewards - works for all mechanics */}
          <div>
            <label className="flex items-center gap-2 text-sm font-sans font-medium
              text-[var(--text-secondary)] mb-2">
              {detectedMechanic === 'crash' ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <Gift className="w-4 h-4" />
              )}
              Награды
            </label>
            <div className="flex flex-wrap gap-2">
              {options.rewards.map((reward, i) => (
                <div key={i} className="flex items-center gap-1">
                  <input
                    type="text"
                    value={reward}
                    onChange={(e) => updateReward(i, e.target.value)}
                    placeholder={rewardHint.placeholder}
                    className="w-24 px-2 py-1.5 text-sm font-sans bg-[var(--bg-primary)]
                      border border-[var(--border)] rounded-lg
                      focus:border-[var(--accent)] focus:outline-none"
                  />
                  {options.rewards.length > 1 && (
                    <button
                      onClick={() => removeReward(i)}
                      className="p-1 text-[var(--text-muted)] hover:text-red-500 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
              {options.rewards.length < 8 && (
                <button
                  onClick={addReward}
                  className="px-2 py-1.5 text-sm font-sans text-[var(--accent)]
                    hover:bg-[var(--accent-light)] rounded-lg transition-colors"
                >
                  + Добавить
                </button>
              )}
            </div>
            {prompt.trim() && (
              <p className="mt-1.5 text-xs text-[var(--text-muted)]">
                {rewardHint.hint}
              </p>
            )}
          </div>

          {/* Offer URL */}
          <div>
            <label className="flex items-center gap-2 text-sm font-sans font-medium
              text-[var(--text-secondary)] mb-2">
              <Link2 className="w-4 h-4" />
              Offer URL (редирект после выигрыша)
            </label>
            <input
              type="url"
              value={options.offerUrl}
              onChange={(e) => setOptions({ ...options, offerUrl: e.target.value })}
              placeholder="https://casino.com/offer..."
              className="w-full px-3 py-2 font-sans bg-[var(--bg-primary)]
                border border-[var(--border)] rounded-xl
                focus:border-[var(--accent)] focus:outline-none"
            />
          </div>

          {/* Language */}
          <div>
            <label className="flex items-center gap-2 text-sm font-sans font-medium
              text-[var(--text-secondary)] mb-2">
              <Globe className="w-4 h-4" />
              Язык
            </label>
            <select
              value={options.language}
              onChange={(e) => setOptions({ ...options, language: e.target.value })}
              className="px-3 py-2 font-sans bg-[var(--bg-primary)]
                border border-[var(--border)] rounded-xl
                focus:border-[var(--accent)] focus:outline-none"
            >
              <option value="en">English</option>
              <option value="de">Deutsch</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
              <option value="it">Italiano</option>
              <option value="pt">Português</option>
              <option value="ru">Русский</option>
              <option value="pl">Polski</option>
              <option value="tr">Türkçe</option>
            </select>
          </div>
        </div>
      )}

      {/* Input form - Claude style */}
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <div className="flex-1 relative bg-[var(--bg-primary)] rounded-[20px]
          border border-[var(--border)]
          shadow-[var(--shadow-input)]
          hover:shadow-[0_0.25rem_1.5rem_rgba(0,0,0,0.06)]
          focus-within:shadow-[0_0.25rem_1.5rem_rgba(0,0,0,0.08)]
          focus-within:border-[var(--accent)]
          transition-all duration-200">

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Опишите лендинг: 'Gates of Olympus колесо фортуны' или 'Crash game про курицу'..."
            disabled={isGenerating}
            rows={2}
            className="w-full px-5 py-4 pr-28 bg-transparent text-[var(--text-primary)]
              placeholder-[var(--text-muted)] font-serif resize-none
              focus:outline-none disabled:opacity-50 rounded-[20px]"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />

          {/* Action buttons inside input */}
          <div className="absolute right-3 bottom-3 flex items-center gap-1">
            {/* Screenshot button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)]
                hover:bg-[var(--bg-hover)] rounded-xl transition-colors"
              title="Добавить референс"
            >
              <Image className="w-5 h-5" />
            </button>

            {/* Options button */}
            <button
              type="button"
              onClick={() => setShowOptions(!showOptions)}
              className={`p-2 rounded-xl transition-colors ${
                showOptions
                  ? 'text-[var(--accent)] bg-[var(--accent-light)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
              }`}
              title="Настройки"
            >
              <Settings className="w-5 h-5" />
            </button>

            {/* Submit button */}
            <button
              type="submit"
              disabled={!prompt.trim() || isGenerating}
              className={`p-2.5 rounded-xl transition-all ${
                !prompt.trim() || isGenerating
                  ? 'bg-[var(--bg-hover)] text-[var(--text-muted)] cursor-not-allowed'
                  : 'bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white shadow-sm'
              }`}
            >
              {isGenerating ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <ArrowUp className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}

export default LandingInput;
