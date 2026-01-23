-- =====================================================
-- Migration 003: Multiple References Support
-- До 14 референсов как в Genspark
-- =====================================================

-- Переименовываем reference_url в reference_urls (массив)
DO $$
BEGIN
    -- Проверяем есть ли старое поле reference_url
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'messages' AND column_name = 'reference_url'
    ) THEN
        -- Добавляем новое поле reference_urls если его нет
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'messages' AND column_name = 'reference_urls'
        ) THEN
            -- Добавляем новое поле
            ALTER TABLE messages ADD COLUMN reference_urls TEXT[] DEFAULT '{}';

            -- Копируем данные из старого поля в новое
            UPDATE messages
            SET reference_urls = ARRAY[reference_url]
            WHERE reference_url IS NOT NULL AND reference_url != '';

            -- Удаляем старое поле
            ALTER TABLE messages DROP COLUMN reference_url;
        END IF;
    END IF;

    -- Если оба поля отсутствуют, создаём reference_urls
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'messages' AND column_name = 'reference_urls'
    ) THEN
        ALTER TABLE messages ADD COLUMN reference_urls TEXT[] DEFAULT '{}';
    END IF;
END $$;
