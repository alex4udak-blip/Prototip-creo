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

  // API Keys
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  runwareApiKey: process.env.RUNWARE_API_KEY,
  googleApiKey: process.env.GOOGLE_API_KEY,

  // Google Cloud / Vertex AI (Imagen 3 с Identity Lock)
  googleCloudProject: process.env.GOOGLE_CLOUD_PROJECT,
  googleCredentialsJson: process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON,

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

    // Предупреждения для API ключей
    if (!this.anthropicApiKey) {
      console.warn('⚠️  ANTHROPIC_API_KEY not set - prompt enhancement disabled');
    }
    if (!this.runwareApiKey) {
      console.warn('⚠️  RUNWARE_API_KEY not set - Runware generation disabled');
    }
    if (!this.googleCloudProject || !this.googleCredentialsJson) {
      console.warn('⚠️  Vertex AI not configured - GOOGLE_CLOUD_PROJECT and GOOGLE_APPLICATION_CREDENTIALS_JSON required for Imagen 3');
    }
    if (!this.googleApiKey) {
      console.warn('⚠️  GOOGLE_API_KEY not set - Google AI (Gemini) features disabled');
    }
  }
};

// Валидация при импорте
config.validate();
