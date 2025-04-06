-- Drop indexes
DROP INDEX IF EXISTS idx_messages_conversation_id;
DROP INDEX IF EXISTS idx_messages_sender_id;
DROP INDEX IF EXISTS idx_conversation_participants_user_id;

-- Drop tables in reverse order of creation
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS conversation_participants;
DROP TABLE IF EXISTS conversations;
DROP TABLE IF EXISTS users;

-- Drop UUID extension
DROP EXTENSION IF EXISTS "uuid-ossp"; 