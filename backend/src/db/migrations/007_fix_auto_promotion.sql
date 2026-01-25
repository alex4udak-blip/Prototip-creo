-- =====================================================
-- Fix auto-promotion trigger - add missing generated_html column
-- The trigger was referencing generated_html which didn't exist
-- =====================================================

-- Add missing column for storing generated HTML
ALTER TABLE landings ADD COLUMN IF NOT EXISTS generated_html TEXT;

-- Add column for features (extracted from analysis)
ALTER TABLE landings ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]';

COMMENT ON COLUMN landings.generated_html IS 'Generated HTML content for auto-promotion to examples';
COMMENT ON COLUMN landings.features IS 'Extracted features list for example matching';

-- =====================================================
-- Update promote_landing_to_example function
-- to handle case where generated_html might be null
-- =====================================================

CREATE OR REPLACE FUNCTION promote_landing_to_example()
RETURNS TRIGGER AS $$
DECLARE
    avg_score DECIMAL(3,2);
    rating_cnt INT;
    landing_record RECORD;
BEGIN
    -- Calculate average score for this landing
    SELECT AVG(score)::DECIMAL(3,2), COUNT(*)
    INTO avg_score, rating_cnt
    FROM landing_ratings
    WHERE landing_id = NEW.landing_id;

    -- If avg score >= 4.5 and at least 3 ratings, consider for promotion
    IF avg_score >= 4.5 AND rating_cnt >= 3 THEN
        -- Get landing details
        SELECT * INTO landing_record FROM landings WHERE id = NEW.landing_id;

        -- Only promote if we have the HTML content
        IF landing_record.generated_html IS NOT NULL AND LENGTH(landing_record.generated_html) > 100 THEN
            -- Check if not already an example
            IF NOT EXISTS (SELECT 1 FROM landing_examples WHERE landing_id = NEW.landing_id) THEN
                -- Auto-promote to examples
                INSERT INTO landing_examples (
                    landing_id,
                    name,
                    mechanic_type,
                    language,
                    html_code,
                    features,
                    avg_rating,
                    rating_count,
                    is_curated
                ) VALUES (
                    NEW.landing_id,
                    COALESCE(landing_record.slot_name, 'Auto-promoted ' || landing_record.type),
                    landing_record.type,
                    COALESCE(landing_record.language, 'en'),
                    landing_record.generated_html,
                    COALESCE(landing_record.features, '[]'),
                    avg_score,
                    rating_cnt,
                    false  -- Not curated, auto-promoted
                );

                RAISE NOTICE 'Landing % auto-promoted to examples with avg score %', NEW.landing_id, avg_score;
            ELSE
                -- Update existing example
                UPDATE landing_examples
                SET avg_rating = avg_score, rating_count = rating_cnt, updated_at = NOW()
                WHERE landing_id = NEW.landing_id;
            END IF;
        ELSE
            RAISE NOTICE 'Landing % has high rating but no HTML content for promotion', NEW.landing_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
DROP TRIGGER IF EXISTS trigger_auto_promote_landing ON landing_ratings;
CREATE TRIGGER trigger_auto_promote_landing
    AFTER INSERT OR UPDATE ON landing_ratings
    FOR EACH ROW
    EXECUTE FUNCTION promote_landing_to_example();

COMMENT ON FUNCTION promote_landing_to_example() IS 'Auto-promotes landings with 4.5+ avg rating to examples (requires generated_html)';
