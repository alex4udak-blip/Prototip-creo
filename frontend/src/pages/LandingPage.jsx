import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Wand2, Image, Zap, Lock } from 'lucide-react';
import { useAuthStore } from '../hooks/useAuth';

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
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        {/* Logo */}
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-accent to-accent-hover flex items-center justify-center shadow-lg glow">
          <Sparkles className="w-10 h-10 text-white" />
        </div>

        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          <span className="text-gradient">BannerGen</span>
        </h1>

        <p className="text-xl text-text-secondary mb-8 max-w-2xl mx-auto">
          AI-генератор рекламных баннеров для арбитража трафика.
          Создавайте креативы за секунды.
        </p>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 text-left">
          <div className="card">
            <Wand2 className="w-8 h-8 text-accent mb-3" />
            <h3 className="font-semibold text-lg mb-2">Умные промпты</h3>
            <p className="text-text-muted text-sm">
              Пишите на русском — Claude AI улучшит ваш запрос и выберет лучшую модель
            </p>
          </div>

          <div className="card">
            <Image className="w-8 h-8 text-accent mb-3" />
            <h3 className="font-semibold text-lg mb-2">Референсы</h3>
            <p className="text-text-muted text-sm">
              Перетащите картинку для стилизации. FLUX Kontext сохранит стиль оригинала
            </p>
          </div>

          <div className="card">
            <Zap className="w-8 h-8 text-accent mb-3" />
            <h3 className="font-semibold text-lg mb-2">Три AI модели</h3>
            <p className="text-text-muted text-sm">
              FLUX Dev для качества, Schnell для скорости, Nano Banana для текста
            </p>
          </div>
        </div>

        {/* Invite only notice */}
        <div className="mt-16 card max-w-md mx-auto">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Lock className="w-6 h-6 text-warning" />
            <span className="font-semibold">Закрытый доступ</span>
          </div>
          <p className="text-text-muted text-sm">
            BannerGen работает по приглашениям.
            Если у вас есть invite-ссылка — используйте её для входа.
          </p>
        </div>

        {/* Sample images */}
        <div className="mt-16">
          <p className="text-text-muted text-sm mb-6">Примеры сгенерированных баннеров</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div
                key={i}
                className="aspect-video bg-bg-secondary rounded-lg shimmer"
              />
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center text-text-muted text-sm">
        <p>© 2026 BannerGen • Powered by Claude, FLUX, Nano Banana</p>
      </footer>
    </div>
  );
}

export default LandingPage;
