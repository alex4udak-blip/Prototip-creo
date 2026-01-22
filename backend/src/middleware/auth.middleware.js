import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { db } from '../db/client.js';
import { log } from '../utils/logger.js';

/**
 * Middleware для проверки JWT токена
 */
export function authMiddleware(req, res, next) {
  try {
    // Получаем токен из заголовка
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Токен не предоставлен' });
    }

    const token = authHeader.split(' ')[1];

    // Верифицируем токен
    const decoded = jwt.verify(token, config.jwtSecret);

    // Добавляем данные пользователя в request
    req.user = {
      id: decoded.userId,
      name: decoded.name
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Токен истёк' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Невалидный токен' });
    }
    log.error('Auth middleware error', { error: error.message });
    return res.status(500).json({ error: 'Ошибка авторизации' });
  }
}

/**
 * Генерация JWT токена для пользователя
 */
export function generateToken(user) {
  return jwt.sign(
    { userId: user.id, name: user.name },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

/**
 * Проверка лимита генераций за день
 */
export async function checkGenerationLimit(req, res, next) {
  try {
    const userId = req.user.id;

    // Получаем статистику за сегодня
    const stats = await db.getOne(
      'SELECT count FROM generation_stats WHERE user_id = $1 AND date = CURRENT_DATE',
      [userId]
    );

    const currentCount = stats?.count || 0;

    if (currentCount >= config.maxGenerationsPerDay) {
      return res.status(429).json({
        error: 'Лимит генераций исчерпан',
        message: `Максимум ${config.maxGenerationsPerDay} генераций в день. Попробуй завтра!`,
        current: currentCount,
        limit: config.maxGenerationsPerDay
      });
    }

    // Добавляем инфу в request для отслеживания
    req.generationStats = {
      current: currentCount,
      limit: config.maxGenerationsPerDay,
      remaining: config.maxGenerationsPerDay - currentCount - 1
    };

    next();
  } catch (error) {
    log.error('Check generation limit error', { error: error.message });
    next(); // Пропускаем при ошибке, чтобы не блокировать
  }
}

/**
 * Обновление статистики генераций
 */
export async function incrementGenerationStats(userId, timeMs) {
  try {
    await db.query(`
      INSERT INTO generation_stats (user_id, date, count, total_time_ms)
      VALUES ($1, CURRENT_DATE, 1, $2)
      ON CONFLICT (user_id, date)
      DO UPDATE SET
        count = generation_stats.count + 1,
        total_time_ms = generation_stats.total_time_ms + $2
    `, [userId, timeMs]);
  } catch (error) {
    log.error('Increment generation stats error', { error: error.message });
  }
}
