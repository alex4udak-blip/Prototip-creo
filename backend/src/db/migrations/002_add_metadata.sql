-- =====================================================
-- Add metadata column to messages table
-- For storing clarification questions and other structured data
-- =====================================================

ALTER TABLE messages
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT NULL;

-- Index for JSON queries if needed
CREATE INDEX IF NOT EXISTS idx_messages_metadata ON messages USING GIN (metadata) WHERE metadata IS NOT NULL;
