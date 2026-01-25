-- =====================================================
-- Landings table for interactive landing page generation
-- Types: wheel (fortune wheel), boxes (mystery boxes), crash (crash game)
-- =====================================================

-- Таблица лендингов
CREATE TABLE IF NOT EXISTS landings (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('wheel', 'boxes', 'crash')),
    theme VARCHAR(255) NOT NULL,
    config JSONB DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
    html_content TEXT,
    assets JSONB DEFAULT '{}',
    error_message TEXT,
    generation_time_ms INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы для производительности
CREATE INDEX IF NOT EXISTS idx_landings_user ON landings(user_id);
CREATE INDEX IF NOT EXISTS idx_landings_status ON landings(status);
CREATE INDEX IF NOT EXISTS idx_landings_type ON landings(type);
CREATE INDEX IF NOT EXISTS idx_landings_created ON landings(created_at DESC);

-- Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION update_landing_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_landing_timestamp ON landings;
CREATE TRIGGER trigger_update_landing_timestamp
    BEFORE UPDATE ON landings
    FOR EACH ROW
    EXECUTE FUNCTION update_landing_timestamp();
