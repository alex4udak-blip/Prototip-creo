import { Router } from 'express';
import { db } from '../db/client.js';
import { generateToken, authMiddleware } from '../middleware/auth.middleware.js';
import { log } from '../utils/logger.js';

const router = Router();

/**
 * GET /api/auth/invite/:token
 * Вход по invite-ссылке — возвращает JWT токен
 */
router.get('/invite/:token', async (req, res) => {
  try {
    const { token } = req.params;

    if (!token || token.length < 32) {
      return res.status(400).json({ error: 'Невалидный токен' });
    }

    // Ищем пользователя по токену
    const user = await db.getOne(
      'SELECT id, name, is_active, created_at FROM users WHERE invite_token = $1',
      [token]
    );

    if (!user) {
      log.warn('Invalid invite token used', { token: token.substring(0, 8) + '...' });
      return res.status(404).json({
        error: 'Ссылка недействительна',
        message: 'Попроси администратора выслать новую invite-ссылку'
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        error: 'Аккаунт деактивирован',
        message: 'Обратись к администратору'
      });
    }

    // Обновляем last_active_at
    await db.query(
      'UPDATE users SET last_active_at = NOW() WHERE id = $1',
      [user.id]
    );

    // Генерируем JWT токен
    const jwtToken = generateToken(user);

    log.info('User logged in via invite', { userId: user.id, name: user.name });

    res.json({
      token: jwtToken,
      user: {
        id: user.id,
        name: user.name,
        createdAt: user.created_at
      }
    });

  } catch (error) {
    log.error('Invite login error', { error: error.message });
    res.status(500).json({ error: 'Ошибка входа' });
  }
});

/**
 * GET /api/auth/me
 * Получить данные текущего пользователя
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await db.getOne(
      `SELECT u.id, u.name, u.created_at, u.last_active_at,
              COUNT(DISTINCT c.id) as chats_count,
              COALESCE(gs.count, 0) as generations_today
       FROM users u
       LEFT JOIN chats c ON c.user_id = u.id
       LEFT JOIN generation_stats gs ON gs.user_id = u.id AND gs.date = CURRENT_DATE
       WHERE u.id = $1
       GROUP BY u.id, gs.count`,
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json({
      id: user.id,
      name: user.name,
      createdAt: user.created_at,
      lastActiveAt: user.last_active_at,
      stats: {
        chatsCount: parseInt(user.chats_count) || 0,
        generationsToday: parseInt(user.generations_today) || 0
      }
    });

  } catch (error) {
    log.error('Get current user error', { error: error.message });
    res.status(500).json({ error: 'Ошибка получения данных' });
  }
});

/**
 * GET /api/auth/invites
 * Получить все invite-ссылки (для админа)
 * Секретный endpoint — доступ по ?secret=mstcreo2026
 */
router.get('/invites', async (req, res) => {
  try {
    const { secret } = req.query;

    // Простая защита
    if (secret !== 'mstcreo2026') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Получаем всех пользователей с токенами
    const users = await db.query(
      'SELECT name, invite_token FROM users WHERE invite_token IS NOT NULL ORDER BY name'
    );

    // Определяем базовый URL
    const baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : (process.env.FRONTEND_URL || 'http://localhost:5173');

    const invites = users.rows.map(u => ({
      name: u.name,
      url: `${baseUrl}/invite/${u.invite_token}`
    }));

    res.json({
      baseUrl,
      invites
    });

  } catch (error) {
    log.error('Get invites error', { error: error.message });
    res.status(500).json({ error: 'Ошибка получения ссылок' });
  }
});

/**
 * POST /api/auth/refresh
 * Обновить токен (если скоро истечёт)
 */
router.post('/refresh', authMiddleware, async (req, res) => {
  try {
    const user = await db.getOne(
      'SELECT id, name, is_active FROM users WHERE id = $1',
      [req.user.id]
    );

    if (!user || !user.is_active) {
      return res.status(403).json({ error: 'Аккаунт недоступен' });
    }

    const newToken = generateToken(user);

    res.json({ token: newToken });

  } catch (error) {
    log.error('Token refresh error', { error: error.message });
    res.status(500).json({ error: 'Ошибка обновления токена' });
  }
});

export default router;
