/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Premium dark theme
        'bg-primary': '#0a0a0f',      // Почти чёрный
        'bg-secondary': '#12121a',    // Карточки
        'bg-chat': '#0d0d14',         // Область чата
        'bg-input': '#16161f',        // Поля ввода
        'bg-hover': '#1a1a25',        // Hover
        'bg-tertiary': '#1e1e28',     // Третий уровень
        'accent': '#8b5cf6',          // Фиолетовый
        'accent-hover': '#a78bfa',    // Hover
        'accent-pink': '#ec4899',     // Розовый акцент
        'text-primary': '#f8fafc',
        'text-secondary': '#94a3b8',
        'text-muted': '#64748b',
        'border': 'rgba(255, 255, 255, 0.06)',
        'border-light': 'rgba(255, 255, 255, 0.1)',
        'success': '#4ade80',
        'warning': '#fbbf24',
        'error': '#f87171',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
