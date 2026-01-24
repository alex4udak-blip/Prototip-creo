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

  // Google AI API (Gemini)
  googleApiKey: process.env.GOOGLE_API_KEY,

  // Gemini Model Settings
  gemini: {
    model: process.env.GEMINI_MODEL || 'gemini-3-pro-image-preview',
    thinkingBudget: parseInt(process.env.GEMINI_THINKING_BUDGET || '2048'),
    safetyThreshold: process.env.GEMINI_SAFETY_THRESHOLD || 'BLOCK_ONLY_HIGH'
  },

  // Runware API (Fallback для заблокированного контента)
  runwareApiKey: process.env.RUNWARE_API_KEY,
  runware: {
    model: process.env.RUNWARE_MODEL || 'runware:100@1', // FLUX Schnell по умолчанию
    enabled: !!process.env.RUNWARE_API_KEY
  },

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

    // Проверка Runware API Key
    if (!this.runwareApiKey) {
      console.warn('⚠️  RUNWARE_API_KEY not set - Runware fallback disabled');
    } else {
      console.log('✅ Runware API fallback enabled');
    }
  }
};

// Валидация при импорте
config.validate();
