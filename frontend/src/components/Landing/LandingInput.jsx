import { useState, useRef, useMemo } from 'react';
import { ArrowUp, Image, Loader2, X, Globe, Gift, Link2, Settings, TrendingUp } from 'lucide-react';
import { useLandingStore } from '../../hooks/useLanding';

/**
 * Mechanic types that use multipliers instead of prizes
 */
const MULTIPLIER_MECHANICS = ['crash', 'aviator', 'mines', 'plinko'];

/**
 * Detect mechanic type from prompt
 */
function detectMechanic(prompt) {
  const lowerPrompt = prompt.toLowerCase();

  // Crash-like games
  if (lowerPrompt.includes('crash') || lowerPrompt.includes('краш') ||
      lowerPrompt.includes('chicken') || lowerPrompt.includes('курица') || lowerPrompt.includes('чикен') ||
      lowerPrompt.includes('aviator') || lowerPrompt.includes('авиатор') ||
      lowerPrompt.includes('mines') || lowerPrompt.includes('мины') ||
      lowerPrompt.includes('plinko') || lowerPrompt.includes('плинко') ||
      lowerPrompt.includes('road') || lowerPrompt.includes('роуд')) {
    return 'crash';
  }

  // Wheel games
  if (lowerPrompt.includes('wheel') || lowerPrompt.includes('колес') ||
      lowerPrompt.includes('fortun') || lowerPrompt.includes('фортун') ||
      lowerPrompt.includes('spin') || lowerPrompt.includes('спин')) {
    return 'wheel';
  }

  // Box games
  if (lowerPrompt.includes('box') || lowerPrompt.includes('коробк') ||
      lowerPrompt.includes('chest') || lowerPrompt.includes('сундук')) {
    return 'boxes';
  }

  // Scratch cards
  if (lowerPrompt.includes('scratch') || lowerPrompt.includes('скретч') ||
      lowerPrompt.includes('скрэтч') || lowerPrompt.includes('карт')) {
    return 'scratch';
  }

  return 'wheel'; // default
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
  const [options, setOptions] = useState({
    prizes: ['€500', '€200', '100 FS'],
    multipliers: ['x2', 'x5', 'x10', 'x50'],
    offerUrl: '',
    language: 'en'
  });

  // Detect mechanic type from prompt to show relevant options
  const detectedMechanic = useMemo(() => detectMechanic(prompt), [prompt]);
  const useMultipliers = MULTIPLIER_MECHANICS.includes(detectedMechanic);

  const fileInputRef = useRef(null);
  const isGenerating = generationState === 'generating';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;

    try {
      // Use multipliers for crash-like games, prizes for wheel/boxes
      const rewardValues = useMultipliers
        ? options.multipliers.filter(m => m.trim())
        : options.prizes.filter(p => p.trim());

      await generateLanding({
        prompt: prompt.trim(),
        screenshot,
        prizes: rewardValues, // backend will handle both prizes and multipliers
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

  const updatePrize = (index, value) => {
    const newPrizes = [...options.prizes];
    newPrizes[index] = value;
    setOptions({ ...options, prizes: newPrizes });
  };

  const addPrize = () => {
    if (options.prizes.length < 8) {
      setOptions({ ...options, prizes: [...options.prizes, ''] });
    }
  };

  const removePrize = (index) => {
    if (options.prizes.length > 1) {
      setOptions({
        ...options,
        prizes: options.prizes.filter((_, i) => i !== index)
      });
    }
  };

  // Multiplier handlers for crash-like games
  const updateMultiplier = (index, value) => {
    const newMultipliers = [...options.multipliers];
    newMultipliers[index] = value;
    setOptions({ ...options, multipliers: newMultipliers });
  };

  const addMultiplier = () => {
    if (options.multipliers.length < 8) {
      setOptions({ ...options, multipliers: [...options.multipliers, ''] });
    }
  };

  const removeMultiplier = (index) => {
    if (options.multipliers.length > 1) {
      setOptions({
        ...options,
        multipliers: options.multipliers.filter((_, i) => i !== index)
      });
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
          {/* Prizes or Multipliers based on mechanic */}
          <div>
            {useMultipliers ? (
              <>
                <label className="flex items-center gap-2 text-sm font-sans font-medium
                  text-[var(--text-secondary)] mb-2">
                  <TrendingUp className="w-4 h-4" />
                  Множители (для crash/aviator/mines)
                </label>
                <div className="flex flex-wrap gap-2">
                  {options.multipliers.map((mult, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <input
                        type="text"
                        value={mult}
                        onChange={(e) => updateMultiplier(i, e.target.value)}
                        placeholder={`x${(i + 1) * 5}`}
                        className="w-20 px-2 py-1.5 text-sm font-sans bg-[var(--bg-primary)]
                          border border-[var(--border)] rounded-lg
                          focus:border-[var(--accent)] focus:outline-none"
                      />
                      {options.multipliers.length > 1 && (
                        <button
                          onClick={() => removeMultiplier(i)}
                          className="p-1 text-[var(--text-muted)] hover:text-red-500 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                  {options.multipliers.length < 8 && (
                    <button
                      onClick={addMultiplier}
                      className="px-2 py-1.5 text-sm font-sans text-[var(--accent)]
                        hover:bg-[var(--accent-light)] rounded-lg transition-colors"
                    >
                      + Добавить
                    </button>
                  )}
                </div>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  💡 Обнаружена crash-механика. Укажите множители выигрыша.
                </p>
              </>
            ) : (
              <>
                <label className="flex items-center gap-2 text-sm font-sans font-medium
                  text-[var(--text-secondary)] mb-2">
                  <Gift className="w-4 h-4" />
                  Призы (на колесе/коробках)
                </label>
                <div className="flex flex-wrap gap-2">
                  {options.prizes.map((prize, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <input
                        type="text"
                        value={prize}
                        onChange={(e) => updatePrize(i, e.target.value)}
                        placeholder={`Приз ${i + 1}`}
                        className="w-24 px-2 py-1.5 text-sm font-sans bg-[var(--bg-primary)]
                          border border-[var(--border)] rounded-lg
                          focus:border-[var(--accent)] focus:outline-none"
                      />
                      {options.prizes.length > 1 && (
                        <button
                          onClick={() => removePrize(i)}
                          className="p-1 text-[var(--text-muted)] hover:text-red-500 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                  {options.prizes.length < 8 && (
                    <button
                      onClick={addPrize}
                      className="px-2 py-1.5 text-sm font-sans text-[var(--accent)]
                        hover:bg-[var(--accent-light)] rounded-lg transition-colors"
                    >
                      + Добавить
                    </button>
                  )}
                </div>
              </>
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
