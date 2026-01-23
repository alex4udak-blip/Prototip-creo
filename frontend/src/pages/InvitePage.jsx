import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Sparkles, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuthStore } from '../hooks/useAuth';

export function InvitePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { loginWithInvite, isAuthenticated } = useAuthStore();

  const [status, setStatus] = useState('loading'); // loading, success, error
  const [error, setError] = useState('');

  useEffect(() => {
    // Если уже авторизован — переходим в чат
    if (isAuthenticated()) {
      navigate('/chat');
      return;
    }

    // Пытаемся войти по токену
    const login = async () => {
      if (!token) {
        setStatus('error');
        setError('Токен не указан');
        return;
      }

      try {
        await loginWithInvite(token);
        setStatus('success');

        // Переходим в чат через секунду
        setTimeout(() => {
          navigate('/chat');
        }, 1500);

      } catch (err) {
        setStatus('error');
        setError(err.message || 'Ошибка входа');
      }
    };

    login();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-accent to-accent-hover flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gradient">MST CREO AI</h1>
          <p className="text-text-muted text-sm mt-1">AI Генератор Баннеров</p>
        </div>

        {/* Status card */}
        <div className="card text-center">
          {status === 'loading' && (
            <>
              <Loader2 className="w-12 h-12 text-accent mx-auto mb-4 animate-spin" />
              <h2 className="text-lg font-medium mb-2">Проверяем приглашение...</h2>
              <p className="text-text-muted text-sm">Подождите немного</p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="w-12 h-12 text-success mx-auto mb-4" />
              <h2 className="text-lg font-medium mb-2">Добро пожаловать!</h2>
              <p className="text-text-muted text-sm">Перенаправляем в приложение...</p>
            </>
          )}

          {status === 'error' && (
            <>
              <AlertCircle className="w-12 h-12 text-error mx-auto mb-4" />
              <h2 className="text-lg font-medium mb-2">Ошибка входа</h2>
              <p className="text-error text-sm mb-4">{error}</p>
              <p className="text-text-muted text-sm">
                Попросите администратора выслать новую ссылку-приглашение
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-text-muted text-xs mt-8">
          © 2026 MST CREO AI • Все права защищены
        </p>
      </div>
    </div>
  );
}

export default InvitePage;
