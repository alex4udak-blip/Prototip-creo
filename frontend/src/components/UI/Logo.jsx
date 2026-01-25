/**
 * MST CREO Logo Component
 * Claude.ai inspired minimalist design
 */

export function Logo({ size = 'md', showText = true, className = '' }) {
  const sizes = {
    sm: { icon: 24, text: 'text-base' },
    md: { icon: 32, text: 'text-lg' },
    lg: { icon: 40, text: 'text-xl' },
  };

  const { icon, text } = sizes[size];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Icon - стилизованная M + искра креатива */}
      <svg
        width={icon}
        height={icon}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Буква M */}
        <path
          d="M4 24V8L10 16L16 8L22 16L28 8V24"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Искра креатива */}
        <circle cx="26" cy="6" r="3" fill="var(--accent, #DA7756)" />
      </svg>

      {showText && (
        <span className={`font-serif font-semibold text-[var(--text-primary)] ${text}`}>
          MST <span className="text-[var(--accent)]">CREO</span>
        </span>
      )}
    </div>
  );
}

/**
 * Только иконка логотипа
 */
export function LogoIcon({ size = 32, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 24V8L10 16L16 8L22 16L28 8V24"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="26" cy="6" r="3" fill="var(--accent, #DA7756)" />
    </svg>
  );
}

/**
 * Animated version with subtle pulse
 */
export function LogoAnimated({ size = 'md', showText = true, className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <Logo size={size} showText={showText} className="animate-fade-in" />
    </div>
  );
}

export default Logo;
