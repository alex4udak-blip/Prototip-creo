import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wand2, Image, Zap, Lock } from 'lucide-react';
import { useAuthStore } from '../hooks/useAuth';
import { LogoAnimated } from '../components/UI/Logo';

// Примеры баннеров - используем placeholder сервис с реалистичными размерами
const EXAMPLE_BANNERS = [
  {
    id: 1,
    title: 'Casino Bonus',
    gradient: 'from-purple-600 to-pink-500',
    text: 'BONUS 1500€',
    subtext: 'First Deposit'
  },
  {
    id: 2,
    title: 'Betting Promo',
    gradient: 'from-green-500 to-emerald-600',
    text: 'FREE BET',
    subtext: '100€ Welcome'
  },
  {
    id: 3,
    title: 'Crypto Trading',
    gradient: 'from-orange-500 to-amber-500',
    text: 'TRADE NOW',
    subtext: '0% Commission'
  },
  {
    id: 4,
    title: 'Mobile App',
    gradient: 'from-blue-500 to-cyan-500',
    text: 'GET APP',
    subtext: 'Win Big Today'
  }
];

function BannerExample({ banner }) {
  return (
    <div className={`
      aspect-[4/5] rounded-xl overflow-hidden relative
      bg-gradient-to-br ${banner.gradient}
      shadow-lg hover:shadow-xl transition-all duration-300
      hover:scale-[1.02] cursor-pointer group
    `}>
      {/* Overlay pattern */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/20 rounded-full translate-y-1/2 -translate-x-1/2" />
      </div>

      {/* Content */}
      <div className="relative h-full flex flex-col items-center justify-center p-4 text-white text-center">
        <span className="text-xs uppercase tracking-wider opacity-80 mb-2">
          {banner.subtext}
        </span>
        <span className="text-2xl md:text-3xl font-black tracking-tight">
          {banner.text}
        </span>
        <div className="mt-4 px-4 py-1.5 bg-white/20 backdrop-blur rounded-full text-xs font-medium">
          {banner.title}
        </div>
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
    </div>
  );
}

export function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  // Если уже авторизован — переходим в чат
  useEffect(() => {
    if (isAuthenticated()) {
      navigate('/chat');
    }
  }, []);

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Hero */}
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <LogoAnimated size={88} />
        </div>

        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          <span className="text-gradient">MST CREO AI</span>
        </h1>

        <p className="text-xl text-text-secondary mb-8 max-w-2xl mx-auto">
          AI-генератор рекламных баннеров для арбитража трафика.
          Создавайте креативы за секунды.
        </p>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 text-left">
          <div className="card glass hover:border-accent/30 transition-colors">
            <Wand2 className="w-8 h-8 text-accent mb-3" />
            <h3 className="font-semibold text-lg mb-2">Умные промпты</h3>
            <p className="text-text-muted text-sm">
              Пишите на русском — AI сам улучшит ваш запрос для генерации
            </p>
          </div>

          <div className="card glass hover:border-accent/30 transition-colors">
            <Image className="w-8 h-8 text-accent mb-3" />
            <h3 className="font-semibold text-lg mb-2">Референсы</h3>
            <p className="text-text-muted text-sm">
              Перетащите до 14 картинок — AI сохранит стиль и создаст вариации
            </p>
          </div>

          <div className="card glass hover:border-accent/30 transition-colors">
            <Zap className="w-8 h-8 text-accent mb-3" />
            <h3 className="font-semibold text-lg mb-2">Nano Banana Pro</h3>
            <p className="text-text-muted text-sm">
              Gemini модель с генерацией текста на баннерах за секунды
            </p>
          </div>
        </div>

        {/* Invite only notice */}
        <div className="mt-12 card glass max-w-md mx-auto border-warning/20">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Lock className="w-6 h-6 text-warning" />
            <span className="font-semibold">Закрытый доступ</span>
          </div>
          <p className="text-text-muted text-sm">
            MST CREO AI работает по приглашениям.
            Если у вас есть invite-ссылка — используйте её для входа.
          </p>
        </div>

        {/* Sample banners */}
        <div className="mt-16">
          <p className="text-text-muted text-sm mb-6">Примеры сгенерированных баннеров</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {EXAMPLE_BANNERS.map(banner => (
              <BannerExample key={banner.id} banner={banner} />
            ))}
          </div>
          <p className="text-text-muted text-xs mt-4 opacity-60">
            Реальные примеры созданные с помощью MST CREO AI
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center text-text-muted text-sm">
        <p>© 2026 MST CREO AI • Powered by Gemini Nano Banana Pro</p>
      </footer>
    </div>
  );
}

export default LandingPage;
