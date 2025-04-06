-- Add joined_at column to conversation_participants table
ALTER TABLE conversation_participants 
ADD COLUMN IF NOT EXISTS joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Update existing records to have current timestamp
UPDATE conversation_participants 
SET joined_at = CURRENT_TIMESTAMP 
WHERE joined_at IS NULL; 