/**
 * MST CREO AI Logo Component
 * Кастомный SVG логотип с буквами MST и AI sparkles
 */
export function Logo({ size = 80, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {/* Gradient for background */}
        <linearGradient id="logoBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="50%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#4f46e5" />
        </linearGradient>

        {/* Gradient for sparkles */}
        <linearGradient id="sparkleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>

        {/* Glow filter */}
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Background rounded square */}
      <rect x="4" y="4" width="72" height="72" rx="18" fill="url(#logoBg)" />

      {/* Inner shadow/depth */}
      <rect
        x="8"
        y="8"
        width="64"
        height="64"
        rx="14"
        fill="none"
        stroke="white"
        strokeOpacity="0.1"
        strokeWidth="1"
      />

      {/* Letter M - stylized */}
      <path
        d="M18 54V28L30 44L42 28V54"
        stroke="white"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* AI Sparkle - main star */}
      <g filter="url(#glow)">
        <path
          d="M56 20L58 26L64 28L58 30L56 36L54 30L48 28L54 26L56 20Z"
          fill="url(#sparkleGrad)"
        />
      </g>

      {/* Small sparkles */}
      <circle cx="64" cy="18" r="2.5" fill="url(#sparkleGrad)" opacity="0.9" />
      <circle cx="68" cy="26" r="1.5" fill="url(#sparkleGrad)" opacity="0.7" />
      <circle cx="50" cy="22" r="1.5" fill="url(#sparkleGrad)" opacity="0.6" />

      {/* Creative accent line */}
      <path
        d="M48 54C54 50 60 44 64 36"
        stroke="url(#sparkleGrad)"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        opacity="0.85"
      />

      {/* Subtle "ST" hint below M */}
      <text
        x="46"
        y="56"
        fill="white"
        fillOpacity="0.4"
        fontSize="10"
        fontWeight="600"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        ST
      </text>
    </svg>
  );
}

/**
 * Animated version with pulse effect
 */
export function LogoAnimated({ size = 80, className = '' }) {
  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      {/* Glow background */}
      <div
        className="absolute inset-0 rounded-2xl bg-accent/30 blur-xl animate-pulse-gentle"
        style={{ transform: 'scale(1.2)' }}
      />
      {/* Logo */}
      <Logo size={size} className="relative z-10" />
    </div>
  );
}

export default Logo;
