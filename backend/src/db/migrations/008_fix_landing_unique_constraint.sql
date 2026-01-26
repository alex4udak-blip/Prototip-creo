-- =====================================================
-- Fix landing_id unique constraint for ON CONFLICT
-- The partial index (WHERE IS NOT NULL) doesn't work with ON CONFLICT
-- Need a proper UNIQUE CONSTRAINT
-- =====================================================

-- Drop the partial index that doesn't work with ON CONFLICT
DROP INDEX IF EXISTS idx_landings_landing_id;

-- First, handle any NULL values by setting them to a generated UUID
-- (This shouldn't happen often, but just in case)
UPDATE landings SET landing_id = gen_random_uuid() WHERE landing_id IS NULL;

-- Now make landing_id NOT NULL and add proper UNIQUE CONSTRAINT
ALTER TABLE landings ALTER COLUMN landing_id SET NOT NULL;
ALTER TABLE landings ADD CONSTRAINT uk_landings_landing_id UNIQUE (landing_id);

-- Also add index for fast lookups (the constraint creates one, but explicit is clearer)
CREATE INDEX IF NOT EXISTS idx_landings_landing_id_lookup ON landings(landing_id);

COMMENT ON CONSTRAINT uk_landings_landing_id ON landings IS 'Unique constraint for ON CONFLICT upsert support';
