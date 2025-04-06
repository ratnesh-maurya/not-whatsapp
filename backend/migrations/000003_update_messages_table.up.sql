-- Drop existing messages table if it exists
DROP TABLE IF EXISTS messages;

-- Create updated messages table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    encrypted BOOLEAN NOT NULL DEFAULT false,
    message_type TEXT NOT NULL CHECK (message_type IN ('text', 'image', 'file')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_messages_conversation_id') THEN
        CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_messages_sender_id') THEN
        CREATE INDEX idx_messages_sender_id ON messages(sender_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_messages_created_at') THEN
        CREATE INDEX idx_messages_created_at ON messages(created_at);
    END IF;
END $$; 