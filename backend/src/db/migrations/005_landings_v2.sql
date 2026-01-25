-- =====================================================
-- Landing Generator v2 - Enhanced schema for new architecture
-- Supports: wheel, boxes, crash, board, scratch, loader, slot
-- Uses Claude as brain, Gemini for images, Runware for rembg
-- =====================================================

-- Drop old type constraint to allow more game types
ALTER TABLE landings DROP CONSTRAINT IF EXISTS landings_type_check;

-- Add new type constraint with all supported mechanics
ALTER TABLE landings ADD CONSTRAINT landings_type_check
    CHECK (type IN ('wheel', 'boxes', 'crash', 'board', 'scratch', 'loader', 'slot', 'custom'));

-- Add new columns for v2 architecture
ALTER TABLE landings ADD COLUMN IF NOT EXISTS landing_id UUID;
ALTER TABLE landings ADD COLUMN IF NOT EXISTS slot_name VARCHAR(255);
ALTER TABLE landings ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en';
ALTER TABLE landings ADD COLUMN IF NOT EXISTS offer_url TEXT;
ALTER TABLE landings ADD COLUMN IF NOT EXISTS prizes JSONB DEFAULT '[]';
ALTER TABLE landings ADD COLUMN IF NOT EXISTS palette JSONB DEFAULT '{}';
ALTER TABLE landings ADD COLUMN IF NOT EXISTS analysis JSONB DEFAULT '{}';
ALTER TABLE landings ADD COLUMN IF NOT EXISTS zip_path TEXT;
ALTER TABLE landings ADD COLUMN IF NOT EXISTS preview_path TEXT;
ALTER TABLE landings ADD COLUMN IF NOT EXISTS downloads_count INT DEFAULT 0;

-- Add unique index on landing_id for UUID-based lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_landings_landing_id ON landings(landing_id) WHERE landing_id IS NOT NULL;

-- Add index for slot_name searches
CREATE INDEX IF NOT EXISTS idx_landings_slot_name ON landings(slot_name);

-- Add index for language filtering
CREATE INDEX IF NOT EXISTS idx_landings_language ON landings(language);

-- Comment updates for documentation
COMMENT ON COLUMN landings.landing_id IS 'UUID for session-based identification';
COMMENT ON COLUMN landings.type IS 'Game mechanic type: wheel, boxes, crash, board, scratch, loader, slot, custom';
COMMENT ON COLUMN landings.slot_name IS 'Name of the slot game (e.g., Gates of Olympus)';
COMMENT ON COLUMN landings.language IS 'Target language code (en, de, es, ru, etc.)';
COMMENT ON COLUMN landings.offer_url IS 'Redirect URL after user wins';
COMMENT ON COLUMN landings.prizes IS 'Array of prize strings ["€500", "100 FS"]';
COMMENT ON COLUMN landings.palette IS 'Extracted color palette {primary, secondary, accent, background}';
COMMENT ON COLUMN landings.analysis IS 'Claude analysis results (slotName, mechanicType, theme, etc.)';
COMMENT ON COLUMN landings.zip_path IS 'Path to generated ZIP archive';
COMMENT ON COLUMN landings.preview_path IS 'Path to preview screenshot';
COMMENT ON COLUMN landings.downloads_count IS 'Number of times ZIP was downloaded';

-- =====================================================
-- Landing templates table for pre-built templates
-- =====================================================

CREATE TABLE IF NOT EXISTS landing_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('wheel', 'boxes', 'crash', 'board', 'scratch', 'loader', 'slot', 'custom')),
    description TEXT,
    thumbnail_url TEXT,
    html_template TEXT NOT NULL,
    default_config JSONB DEFAULT '{}',
    required_assets JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Unique name per type
CREATE UNIQUE INDEX IF NOT EXISTS idx_templates_name_type ON landing_templates(name, type);
CREATE INDEX IF NOT EXISTS idx_templates_type ON landing_templates(type);
CREATE INDEX IF NOT EXISTS idx_templates_active ON landing_templates(is_active) WHERE is_active = true;

COMMENT ON TABLE landing_templates IS 'Pre-built landing page templates for quick generation';
COMMENT ON COLUMN landing_templates.required_assets IS 'Array of required asset keys [{key, description, dimensions}]';

-- Template timestamp trigger
DROP TRIGGER IF EXISTS trigger_update_template_timestamp ON landing_templates;
CREATE TRIGGER trigger_update_template_timestamp
    BEFORE UPDATE ON landing_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_landing_timestamp();

-- =====================================================
-- Landing assets table for tracking generated assets
-- =====================================================

CREATE TABLE IF NOT EXISTS landing_assets (
    id SERIAL PRIMARY KEY,
    landing_id INT NOT NULL REFERENCES landings(id) ON DELETE CASCADE,
    asset_key VARCHAR(100) NOT NULL,
    asset_type VARCHAR(50) NOT NULL CHECK (asset_type IN ('background', 'logo', 'character', 'element', 'sound', 'other')),
    file_path TEXT NOT NULL,
    file_url TEXT,
    mime_type VARCHAR(50),
    width INT,
    height INT,
    file_size INT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_landing ON landing_assets(landing_id);
CREATE INDEX IF NOT EXISTS idx_assets_type ON landing_assets(asset_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_landing_key ON landing_assets(landing_id, asset_key);

COMMENT ON TABLE landing_assets IS 'Individual assets generated for each landing';
COMMENT ON COLUMN landing_assets.asset_key IS 'Unique key within landing (e.g., background, logo, wheel)';
COMMENT ON COLUMN landing_assets.metadata IS 'Additional info like generation prompt, source, etc.';

-- =====================================================
-- Slot library table for caching slot information
-- =====================================================

CREATE TABLE IF NOT EXISTS slot_library (
    id SERIAL PRIMARY KEY,
    slot_name VARCHAR(255) NOT NULL,
    provider VARCHAR(100),
    theme VARCHAR(100),
    palette JSONB DEFAULT '{}',
    reference_url TEXT,
    thumbnail_url TEXT,
    metadata JSONB DEFAULT '{}',
    usage_count INT DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Case-insensitive unique slot name
CREATE UNIQUE INDEX IF NOT EXISTS idx_slot_library_name ON slot_library(LOWER(slot_name));
CREATE INDEX IF NOT EXISTS idx_slot_library_provider ON slot_library(provider);
CREATE INDEX IF NOT EXISTS idx_slot_library_usage ON slot_library(usage_count DESC);

COMMENT ON TABLE slot_library IS 'Cached slot game information for quick reuse';
COMMENT ON COLUMN slot_library.metadata IS 'RTP, features, release date, etc.';

-- Slot library timestamp trigger
DROP TRIGGER IF EXISTS trigger_update_slot_timestamp ON slot_library;
CREATE TRIGGER trigger_update_slot_timestamp
    BEFORE UPDATE ON slot_library
    FOR EACH ROW
    EXECUTE FUNCTION update_landing_timestamp();

-- =====================================================
-- Sound library table for bundled sounds
-- =====================================================

CREATE TABLE IF NOT EXISTS sound_library (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('spin', 'win', 'click', 'ambient', 'voice', 'effect')),
    theme VARCHAR(50),
    file_path TEXT NOT NULL,
    file_url TEXT,
    duration_ms INT,
    license VARCHAR(100),
    source VARCHAR(255),
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sounds_category ON sound_library(category);
CREATE INDEX IF NOT EXISTS idx_sounds_theme ON sound_library(theme);
CREATE INDEX IF NOT EXISTS idx_sounds_default ON sound_library(is_default) WHERE is_default = true;

COMMENT ON TABLE sound_library IS 'Pre-bundled sound effects for landing pages';
COMMENT ON COLUMN sound_library.duration_ms IS 'Sound duration in milliseconds for animation sync';
