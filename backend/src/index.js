import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';

import { config } from './config/env.js';
import { testConnection } from './db/client.js';
import { initWebSocket, getConnectionStats } from './websocket/handler.js';
import { log } from './utils/logger.js';

// Routes
import authRoutes from './routes/auth.routes.js';
import chatRoutes from './routes/chat.routes.js';
import generateRoutes from './routes/generate.routes.js';
import landingV2Routes from './routes/landing.v2.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Создаём Express приложение
const app = express();

// ===========================================
// Middleware
// ===========================================

// CORS
app.use(cors({
  origin: config.nodeEnv === 'production'
    ? [config.frontendUrl, /\.railway\.app$/]
    : true,
  credentials: true
}));

// JSON body parser
app.use(express.json({ limit: '10mb' }));

// Статические файлы (uploads)
const uploadsPath = path.resolve(config.storagePath);
app.use('/uploads', express.static(uploadsPath));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (!req.url.startsWith('/uploads') && !req.url.includes('health')) {
      log.debug(`${req.method} ${req.url} ${res.statusCode} ${duration}ms`);
    }
  });
  next();
});

// ===========================================
// API Routes
// ===========================================

// Health check — returns 503 if database is down
app.get('/api/health', async (req, res) => {
  const dbOk = await testConnection().catch(() => false);
  const wsStats = getConnectionStats();

  const status = dbOk ? 'healthy' : 'degraded';
  const httpStatus = dbOk ? 200 : 503;

  res.status(httpStatus).json({
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbOk ? 'connected' : 'disconnected',
    websocket: wsStats,
    environment: config.nodeEnv,
    apis: {
      gemini: !!config.googleApiKey,
      claude: !!config.anthropicApiKey,
      runware: !!config.runwareApiKey,
      serper: !!config.serperApiKey
    }
  });
});

// Auth routes
app.use('/api/auth', authRoutes);

// Chat routes
app.use('/api/chats', chatRoutes);

// Generate routes
app.use('/api/generate', generateRoutes);

// Landing routes v2
app.use('/api/landing/v2', landingV2Routes);

// ===========================================
// Static Frontend (Production)
// ===========================================

if (config.nodeEnv === 'production') {
  const frontendPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendPath));

  // SPA fallback
  app.get('*', (req, res) => {
    if (!req.url.startsWith('/api')) {
      res.sendFile(path.join(frontendPath, 'index.html'));
    }
  });
}

// ===========================================
// Error Handler
// ===========================================

app.use((err, req, res, next) => {
  log.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    url: req.url
  });

  res.status(500).json({
    error: 'Внутренняя ошибка сервера',
    message: config.nodeEnv === 'development' ? err.message : undefined
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint не найден' });
});

// ===========================================
// Start Server
// ===========================================

const server = createServer(app);

// Инициализируем WebSocket
initWebSocket(server);

// Запускаем сервер
server.listen(config.port, async () => {
  log.info(`🚀 Server started on port ${config.port}`);
  log.info(`📦 Environment: ${config.nodeEnv}`);
  log.info(`📁 Uploads path: ${uploadsPath}`);

  // Проверяем подключение к БД
  const dbOk = await testConnection();
  if (!dbOk) {
    log.warn('⚠️  Database connection failed - some features may not work');
  }

  // Логируем доступные API
  log.info('API Keys status:', {
    gemini: !!config.googleApiKey,
    claude: !!config.anthropicApiKey,
    runware: !!config.runwareApiKey,
    serper: !!config.serperApiKey
  });

  if (config.nodeEnv === 'development') {
    log.info(`\n🔗 Local URL: http://localhost:${config.port}`);
    log.info(`📊 Health: http://localhost:${config.port}/api/health\n`);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  log.info('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    log.info('Server closed');
    process.exit(0);
  });
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled Rejection at:', {
    promise: String(promise),
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception:', {
    error: error.message,
    stack: error.stack
  });
  // Exit after logging
  process.exit(1);
});

export default app;
