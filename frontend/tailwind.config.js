/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Тёмная тема как у Claude
        'bg-primary': '#1a1a2e',
        'bg-secondary': '#16213e',
        'bg-chat': '#0f0f23',
        'bg-input': '#1e1e3f',
        'bg-hover': '#252550',
        'accent': '#e94560',
        'accent-hover': '#ff6b6b',
        'accent-dim': '#e94560/20',
        'text-primary': '#eaeaea',
        'text-secondary': '#a0a0a0',
        'text-muted': '#6b6b8a',
        'border': '#2a2a4a',
        'border-light': '#3a3a5a',
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
