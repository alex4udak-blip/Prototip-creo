import dotenv from 'dotenv';
dotenv.config();

// Конфигурация приложения
export const config = {
  // Сервер
  port: parseInt(process.env.PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  // База данных
  databaseUrl: process.env.DATABASE_URL,

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-prod',
  jwtExpiresIn: '7d',

  // Google AI API (Gemini 2.0 Flash с генерацией изображений)
  googleApiKey: process.env.GOOGLE_API_KEY,

  // Storage (Railway Volume)
  storagePath: process.env.STORAGE_PATH || './uploads',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE_MB || '10') * 1024 * 1024,

  // Лимиты
  maxGenerationsPerDay: parseInt(process.env.MAX_GENERATIONS_PER_DAY || '100'),

  // Проверка обязательных переменных
  validate() {
    const required = ['DATABASE_URL', 'JWT_SECRET'];
    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0 && this.nodeEnv === 'production') {
      throw new Error(`Missing required env variables: ${missing.join(', ')}`);
    }

    // Проверка Google API Key
    if (!this.googleApiKey) {
      console.warn('⚠️  GOOGLE_API_KEY not set - Gemini AI features disabled');
    }
  }
};

// Валидация при импорте
config.validate();
