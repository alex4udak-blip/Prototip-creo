-- =====================================================
-- Landing Ratings & Feedback System
-- Enables "learning" through human feedback (RLHF-style)
-- High-rated landings become examples for future generations
-- =====================================================

-- Landing ratings table
CREATE TABLE IF NOT EXISTS landing_ratings (
    id SERIAL PRIMARY KEY,
    landing_id INT NOT NULL REFERENCES landings(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,

    -- Rating (1-5 stars)
    score INT NOT NULL CHECK (score >= 1 AND score <= 5),

    -- Detailed feedback
    feedback_text TEXT,

    -- Aspect ratings (optional, for detailed feedback)
    design_score INT CHECK (design_score >= 1 AND design_score <= 5),
    code_quality_score INT CHECK (code_quality_score >= 1 AND code_quality_score <= 5),
    animation_score INT CHECK (animation_score >= 1 AND animation_score <= 5),
    relevance_score INT CHECK (relevance_score >= 1 AND relevance_score <= 5),

    -- What was good/bad (for learning)
    positive_aspects JSONB DEFAULT '[]',  -- ["animations", "colors", "layout"]
    negative_aspects JSONB DEFAULT '[]',  -- ["slow loading", "bad fonts"]

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Only one rating per user per landing
CREATE UNIQUE INDEX IF NOT EXISTS idx_ratings_user_landing
    ON landing_ratings(user_id, landing_id) WHERE user_id IS NOT NULL;

-- Index for finding top-rated landings
CREATE INDEX IF NOT EXISTS idx_ratings_score ON landing_ratings(score DESC);
CREATE INDEX IF NOT EXISTS idx_ratings_landing ON landing_ratings(landing_id);

-- =====================================================
-- Landing examples table - stores "golden" examples
-- These are either manually curated or auto-promoted from high ratings
-- =====================================================

CREATE TABLE IF NOT EXISTS landing_examples (
    id SERIAL PRIMARY KEY,
    landing_id INT REFERENCES landings(id) ON DELETE SET NULL,

    -- Example identification
    name VARCHAR(255) NOT NULL,
    mechanic_type VARCHAR(50) NOT NULL,
    language VARCHAR(10) DEFAULT 'en',

    -- The actual code (for fast retrieval)
    html_code TEXT NOT NULL,

    -- Extracted sections (cached)
    css_code TEXT,
    js_code TEXT,
    config_code TEXT,

    -- Features this example demonstrates
    features JSONB DEFAULT '[]',  -- ["loader", "modal", "sounds", "confetti"]

    -- Quality metrics
    avg_rating DECIMAL(3,2) DEFAULT 0,
    rating_count INT DEFAULT 0,

    -- Is this a curated example (manual) or auto-promoted?
    is_curated BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,

    -- Usage tracking
    usage_count INT DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_examples_mechanic ON landing_examples(mechanic_type);
CREATE INDEX IF NOT EXISTS idx_examples_rating ON landing_examples(avg_rating DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_examples_active ON landing_examples(is_active) WHERE is_active = true;

-- =====================================================
-- Generation feedback - tracks what worked and what didn't
-- This is the "memory" that helps the system improve
-- =====================================================

CREATE TABLE IF NOT EXISTS generation_feedback (
    id SERIAL PRIMARY KEY,

    -- Link to the generation
    landing_id INT REFERENCES landings(id) ON DELETE CASCADE,

    -- The original request (for pattern matching)
    original_prompt TEXT,
    mechanic_type VARCHAR(50),
    slot_name VARCHAR(255),
    language VARCHAR(10),

    -- The examples that were used (for correlation)
    examples_used JSONB DEFAULT '[]',  -- [example_id, example_id]

    -- Result quality
    final_score DECIMAL(3,2),

    -- What patterns worked well?
    successful_patterns JSONB DEFAULT '[]',
    failed_patterns JSONB DEFAULT '[]',

    -- Token usage (for optimization)
    prompt_tokens INT,
    completion_tokens INT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_mechanic ON generation_feedback(mechanic_type);
CREATE INDEX IF NOT EXISTS idx_feedback_score ON generation_feedback(final_score DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_slot ON generation_feedback(slot_name);

-- =====================================================
-- Helper function to auto-promote high-rated landings
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
                COALESCE(landing_record.analysis->'features', '[]'),
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
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-promote after each rating
DROP TRIGGER IF EXISTS trigger_auto_promote_landing ON landing_ratings;
CREATE TRIGGER trigger_auto_promote_landing
    AFTER INSERT OR UPDATE ON landing_ratings
    FOR EACH ROW
    EXECUTE FUNCTION promote_landing_to_example();

-- =====================================================
-- Function to get best examples for a mechanic type
-- Used by Claude service during generation
-- =====================================================

CREATE OR REPLACE FUNCTION get_best_examples(
    p_mechanic_type VARCHAR(50),
    p_limit INT DEFAULT 3
)
RETURNS TABLE (
    id INT,
    name VARCHAR(255),
    html_code TEXT,
    features JSONB,
    avg_rating DECIMAL(3,2),
    usage_count INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        le.id,
        le.name,
        le.html_code,
        le.features,
        le.avg_rating,
        le.usage_count
    FROM landing_examples le
    WHERE le.is_active = true
      AND (le.mechanic_type = p_mechanic_type OR p_mechanic_type IS NULL)
    ORDER BY
        le.is_curated DESC,  -- Curated first
        le.avg_rating DESC,  -- Then by rating
        le.usage_count DESC  -- Then by popularity
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Timestamp update trigger for ratings
-- =====================================================

CREATE OR REPLACE FUNCTION update_rating_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_rating_timestamp ON landing_ratings;
CREATE TRIGGER trigger_update_rating_timestamp
    BEFORE UPDATE ON landing_ratings
    FOR EACH ROW
    EXECUTE FUNCTION update_rating_timestamp();

DROP TRIGGER IF EXISTS trigger_update_example_timestamp ON landing_examples;
CREATE TRIGGER trigger_update_example_timestamp
    BEFORE UPDATE ON landing_examples
    FOR EACH ROW
    EXECUTE FUNCTION update_rating_timestamp();

-- =====================================================
-- Comments for documentation
-- =====================================================

COMMENT ON TABLE landing_ratings IS 'User ratings for generated landings - enables RLHF-style learning';
COMMENT ON TABLE landing_examples IS 'Golden examples for few-shot learning - curated or auto-promoted';
COMMENT ON TABLE generation_feedback IS 'Tracks generation patterns and their success rates';
COMMENT ON FUNCTION promote_landing_to_example() IS 'Auto-promotes landings with 4.5+ avg rating to examples';
COMMENT ON FUNCTION get_best_examples(VARCHAR, INT) IS 'Gets top examples for a mechanic type, ordered by quality';
