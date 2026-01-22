-- =====================================================
-- BannerGen / Prototip-creo - Initial Schema
-- =====================================================

-- Пользователи (вход по invite-ссылкам)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    invite_token VARCHAR(64) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Чаты (как у Claude - можно создавать новые)
CREATE TABLE IF NOT EXISTS chats (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) DEFAULT 'Новый чат',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Сообщения в чате
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    chat_id INT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT,
    image_urls TEXT[] DEFAULT '{}',           -- Массив URL сгенерированных картинок
    reference_url TEXT,                        -- URL референса от пользователя
    model_used VARCHAR(100),                   -- Какая модель использовалась
    generation_time_ms INT,                    -- Время генерации
    enhanced_prompt TEXT,                      -- Улучшенный промпт от Claude
    error_message TEXT,                        -- Сообщение об ошибке если failed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Пресеты размеров баннеров
CREATE TABLE IF NOT EXISTS size_presets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    width INT NOT NULL,
    height INT NOT NULL,
    category VARCHAR(50) NOT NULL,            -- 'social', 'display', 'mobile'
    is_active BOOLEAN DEFAULT true
);

-- Сохранённые стили (референсы)
CREATE TABLE IF NOT EXISTS saved_styles (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    reference_url TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Статистика генераций (для лимитов и аналитики)
CREATE TABLE IF NOT EXISTS generation_stats (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    count INT DEFAULT 0,
    total_time_ms BIGINT DEFAULT 0,
    UNIQUE(user_id, date)
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_chats_user ON chats(user_id);
CREATE INDEX IF NOT EXISTS idx_chats_updated ON chats(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_invite ON users(invite_token);
CREATE INDEX IF NOT EXISTS idx_generation_stats_user_date ON generation_stats(user_id, date);

-- Заполняем пресеты размеров
INSERT INTO size_presets (name, width, height, category) VALUES
    -- Social Media
    ('Facebook Feed', 1200, 628, 'social'),
    ('Instagram Square', 1080, 1080, 'social'),
    ('Instagram Story', 1080, 1920, 'social'),
    ('Twitter Post', 1200, 675, 'social'),
    ('LinkedIn Post', 1200, 627, 'social'),
    -- Display Ads
    ('Display Wide', 728, 90, 'display'),
    ('Display Skyscraper', 160, 600, 'display'),
    ('Display Rectangle', 300, 250, 'display'),
    ('Display Large Rectangle', 336, 280, 'display'),
    ('Display Leaderboard', 970, 250, 'display'),
    -- Mobile
    ('Mobile Banner', 320, 50, 'mobile'),
    ('Mobile Interstitial', 320, 480, 'mobile'),
    ('Mobile Large', 320, 100, 'mobile')
ON CONFLICT DO NOTHING;

-- Триггер для обновления updated_at в chats
CREATE OR REPLACE FUNCTION update_chat_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chats SET updated_at = NOW() WHERE id = NEW.chat_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_chat_timestamp ON messages;
CREATE TRIGGER trigger_update_chat_timestamp
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_chat_timestamp();

-- Триггер для обновления last_active_at пользователя
CREATE OR REPLACE FUNCTION update_user_activity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE users SET last_active_at = NOW()
    WHERE id = (SELECT user_id FROM chats WHERE id = NEW.chat_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_user_activity ON messages;
CREATE TRIGGER trigger_update_user_activity
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_user_activity();
