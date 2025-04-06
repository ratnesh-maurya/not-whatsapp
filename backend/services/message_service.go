package services

import (
	"database/sql"

	"github.com/RatneshMaurya/not-whatsapp/backend/models"
)

type MessageService struct {
	db *sql.DB
}

func NewMessageService(db *sql.DB) *MessageService {
	return &MessageService{db: db}
}

func (s *MessageService) CreateMessage(message *models.Message) error {
	query := `
		INSERT INTO messages (id, conversation_id, content, sender_id, encrypted, message_type, created_at, delivered_at, read_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`
	_, err := s.db.Exec(query,
		message.ID,
		message.ConversationID,
		message.Content,
		message.SenderID,
		message.Encrypted,
		message.MessageType,
		message.CreatedAt,
		message.DeliveredAt,
		message.ReadAt,
	)
	return err
}

func (s *MessageService) GetMessages(limit int) ([]models.Message, error) {
	query := `
		SELECT id, conversation_id, content, sender_id, encrypted, message_type, created_at, delivered_at, read_at
		FROM messages
		ORDER BY created_at DESC
		LIMIT $1
	`
	rows, err := s.db.Query(query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var messages []models.Message
	for rows.Next() {
		var msg models.Message
		err := rows.Scan(
			&msg.ID,
			&msg.ConversationID,
			&msg.Content,
			&msg.SenderID,
			&msg.Encrypted,
			&msg.MessageType,
			&msg.CreatedAt,
			&msg.DeliveredAt,
			&msg.ReadAt,
		)
		if err != nil {
			return nil, err
		}
		messages = append(messages, msg)
	}

	return messages, nil
}

func (s *MessageService) GetMessageByID(id string) (*models.Message, error) {
	query := `
		SELECT id, conversation_id, content, sender_id, encrypted, message_type, created_at, delivered_at, read_at
		FROM messages
		WHERE id = $1
	`
	var msg models.Message
	err := s.db.QueryRow(query, id).Scan(
		&msg.ID,
		&msg.ConversationID,
		&msg.Content,
		&msg.SenderID,
		&msg.Encrypted,
		&msg.MessageType,
		&msg.CreatedAt,
		&msg.DeliveredAt,
		&msg.ReadAt,
	)
	if err != nil {
		return nil, err
	}
	return &msg, nil
}

func (s *MessageService) GetMessagesByConversation(conversationID string, limit int) ([]models.Message, error) {
	query := `
		SELECT 
			m.id,
			m.content,
			m.sender_id,
			m.created_at,
			u.name as sender_name,
			u.avatar_url as sender_avatar_url
		FROM messages m
		JOIN users u ON m.sender_id = u.id
		WHERE m.conversation_id = $1
		ORDER BY m.created_at DESC
		LIMIT $2
	`

	rows, err := s.db.Query(query, conversationID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var messages []models.Message
	for rows.Next() {
		var msg models.Message
		var senderName, senderAvatarURL string
		err := rows.Scan(
			&msg.ID,
			&msg.Content,
			&msg.SenderID,
			&msg.CreatedAt,
			&senderName,
			&senderAvatarURL,
		)
		if err != nil {
			return nil, err
		}

		msg.Sender = models.User{
			ID:        msg.SenderID,
			Name:      senderName,
			AvatarURL: senderAvatarURL,
		}
		messages = append(messages, msg)
	}

	// Reverse the messages to show oldest first
	for i, j := 0, len(messages)-1; i < j; i, j = i+1, j-1 {
		messages[i], messages[j] = messages[j], messages[i]
	}

	return messages, nil
}
