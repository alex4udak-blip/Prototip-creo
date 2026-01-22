import winston from 'winston';
import { config } from '../config/env.js';

// Форматирование логов
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
    return `${timestamp} [${level.toUpperCase()}] ${message} ${metaStr}`;
  })
);

// Создаём логгер
export const logger = winston.createLogger({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  format: logFormat,
  transports: [
    // Консоль - всегда
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    })
  ]
});

// Обёртка для удобства
export const log = {
  info: (msg, meta = {}) => logger.info(msg, meta),
  error: (msg, meta = {}) => logger.error(msg, meta),
  warn: (msg, meta = {}) => logger.warn(msg, meta),
  debug: (msg, meta = {}) => logger.debug(msg, meta),

  // Логирование HTTP запросов
  request: (req, meta = {}) => {
    logger.info(`${req.method} ${req.url}`, {
      ip: req.ip,
      userId: req.user?.id,
      ...meta
    });
  },

  // Логирование генерации
  generation: (userId, model, time, meta = {}) => {
    logger.info(`Generation completed`, {
      userId,
      model,
      timeMs: time,
      ...meta
    });
  }
};
