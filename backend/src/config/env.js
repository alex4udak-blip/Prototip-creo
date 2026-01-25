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

  // Runware API (Fallback для заблокированного контента + Background Removal)
  runwareApiKey: process.env.RUNWARE_API_KEY,
  runware: {
    // Juggernaut Pro FLUX — фотореализм, меньше цензуры, $0.0066/1024x1024
    model: process.env.RUNWARE_MODEL || 'rundiffusion:130@100',
    enabled: !!process.env.RUNWARE_API_KEY
  },

  // Anthropic Claude API (Landing generator brain)
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,

  // Claude Model Settings
  claude: {
    model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929',
    maxTokens: parseInt(process.env.CLAUDE_MAX_TOKENS || '8192'),
    thinkingBudget: parseInt(process.env.CLAUDE_THINKING_BUDGET || '2048')
  },

  // Landing Generator Settings
  landing: {
    sessionTtl: parseInt(process.env.LANDING_SESSION_TTL || String(2 * 60 * 60 * 1000)), // 2 hours
    maxSessionsPerUser: parseInt(process.env.LANDING_MAX_SESSIONS_PER_USER || '10'),
    defaultPalette: {
      primary: process.env.LANDING_DEFAULT_PRIMARY || '#FFD700',
      secondary: process.env.LANDING_DEFAULT_SECONDARY || '#1E3A5F',
      accent: process.env.LANDING_DEFAULT_ACCENT || '#FF6B6B',
      background: process.env.LANDING_DEFAULT_BACKGROUND || '#0D1117'
    }
  },

  // Serper.dev API (Image search for slot references)
  serperApiKey: process.env.SERPER_API_KEY,

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

    // Проверка Anthropic API Key
    if (!this.anthropicApiKey) {
      console.warn('⚠️  ANTHROPIC_API_KEY not set - Landing generator disabled');
    } else {
      console.log('✅ Anthropic Claude API enabled');
    }

    // Проверка Serper API Key
    if (!this.serperApiKey) {
      console.warn('⚠️  SERPER_API_KEY not set - Slot image search disabled');
    } else {
      console.log('✅ Serper image search enabled');
    }
  }
};

// Валидация при импорте
config.validate();
