package services

import (
	"database/sql"
	"time"

	"github.com/RatneshMaurya/not-whatsapp/backend/models"
	"github.com/google/uuid"
)

type ConversationService struct {
	db *sql.DB
}

func NewConversationService(db *sql.DB) *ConversationService {
	return &ConversationService{db: db}
}

func (s *ConversationService) GetRecentConversations(userID string) ([]models.Conversation, error) {
	query := `
        SELECT 
            c.id,
            c.name,
            c.created_at,
            m.id as message_id,
            m.content,
            m.sender_id,
            m.created_at as message_created_at,
            u.id as participant_id,
            u.name as participant_name,
            u.email as participant_email,
            u.avatar_url as participant_avatar_url
        FROM conversations c
        JOIN conversation_participants cp ON c.id = cp.conversation_id
        JOIN users u ON cp.user_id = u.id
        LEFT JOIN LATERAL (
            SELECT id, content, sender_id, created_at
            FROM messages
            WHERE conversation_id = c.id
            ORDER BY created_at DESC
            LIMIT 1
        ) m ON true
        WHERE c.id IN (
            SELECT conversation_id
            FROM conversation_participants
            WHERE user_id = $1
        )
        AND u.id != $1
        ORDER BY m.created_at DESC NULLS LAST, c.created_at DESC
    `

	rows, err := s.db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	conversations := make(map[string]*models.Conversation)
	for rows.Next() {
		var (
			convID            string
			convName          string
			convCreatedAt     time.Time
			messageID         sql.NullString
			messageContent    sql.NullString
			messageSenderID   sql.NullString
			messageCreatedAt  sql.NullTime
			participantID     string
			participantName   string
			participantEmail  string
			participantAvatar string
		)

		err := rows.Scan(
			&convID, &convName, &convCreatedAt,
			&messageID, &messageContent, &messageSenderID, &messageCreatedAt,
			&participantID, &participantName, &participantEmail, &participantAvatar,
		)
		if err != nil {
			return nil, err
		}

		conv, exists := conversations[convID]
		if !exists {
			conv = &models.Conversation{
				ID:           convID,
				Name:         convName,
				CreatedAt:    convCreatedAt,
				Participants: make([]models.User, 0),
			}
			conversations[convID] = conv
		}

		participant := models.User{
			ID:        participantID,
			Name:      participantName,
			Email:     participantEmail,
			AvatarURL: participantAvatar,
		}
		conv.Participants = append(conv.Participants, participant)

		if messageID.Valid {
			conv.LastMessage = &models.Message{
				ID:        messageID.String,
				Content:   messageContent.String,
				SenderID:  messageSenderID.String,
				CreatedAt: messageCreatedAt.Time,
			}
		}
	}

	result := make([]models.Conversation, 0, len(conversations))
	for _, conv := range conversations {
		result = append(result, *conv)
	}

	return result, nil
}

func (s *ConversationService) CreateConversation(name string, participantIDs []string) (*models.Conversation, error) {
	// Check if a conversation already exists with these participants
	var existingConversationID string
	query := `
		SELECT c.id
		FROM conversations c
		JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
		JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
		WHERE cp1.user_id = $1 AND cp2.user_id = $2
		LIMIT 1
	`

	// For direct messages, we only need to check between two participants
	if len(participantIDs) == 2 {
		err := s.db.QueryRow(query, participantIDs[0], participantIDs[1]).Scan(&existingConversationID)
		if err == nil {
			// Conversation exists, return it
			return s.GetConversationByID(existingConversationID)
		}
	}

	// Start a transaction
	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// Create the conversation
	conversationID := uuid.New().String()
	_, err = tx.Exec(`
		INSERT INTO conversations (id, name, created_at)
		VALUES ($1, $2, NOW())
	`, conversationID, name)
	if err != nil {
		return nil, err
	}

	// Add participants
	for _, participantID := range participantIDs {
		_, err = tx.Exec(`
			INSERT INTO conversation_participants (conversation_id, user_id, joined_at)
			VALUES ($1, $2, NOW())
		`, conversationID, participantID)
		if err != nil {
			return nil, err
		}
	}

	// Commit the transaction
	if err := tx.Commit(); err != nil {
		return nil, err
	}

	// Return the created conversation
	return s.GetConversationByID(conversationID)
}

func (s *ConversationService) GetConversationByID(id string) (*models.Conversation, error) {
	query := `
		SELECT 
			c.id,
			c.name,
			c.created_at,
			u.id as participant_id,
			u.name as participant_name,
			u.email as participant_email,
			u.avatar_url as participant_avatar_url
		FROM conversations c
		JOIN conversation_participants cp ON c.id = cp.conversation_id
		JOIN users u ON cp.user_id = u.id
		WHERE c.id = $1
	`

	rows, err := s.db.Query(query, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	conversation := &models.Conversation{
		ID:           id,
		Participants: make([]models.User, 0),
	}

	for rows.Next() {
		var (
			convName          string
			convCreatedAt     time.Time
			participantID     string
			participantName   string
			participantEmail  string
			participantAvatar string
		)

		err := rows.Scan(
			&conversation.ID,
			&convName,
			&convCreatedAt,
			&participantID,
			&participantName,
			&participantEmail,
			&participantAvatar,
		)
		if err != nil {
			return nil, err
		}

		conversation.Name = convName
		conversation.CreatedAt = convCreatedAt

		participant := models.User{
			ID:        participantID,
			Name:      participantName,
			Email:     participantEmail,
			AvatarURL: participantAvatar,
		}
		conversation.Participants = append(conversation.Participants, participant)
	}

	return conversation, nil
}
