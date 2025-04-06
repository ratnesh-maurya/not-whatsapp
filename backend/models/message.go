package models

import (
	"time"
)

type Message struct {
	ID             string    `json:"id"`
	ConversationID string    `json:"conversation_id"`
	Content        string    `json:"content"`
	SenderID       string    `json:"sender_id"`
	Encrypted      bool      `json:"encrypted"`
	MessageType    string    `json:"message_type"`
	CreatedAt      time.Time `json:"created_at"`
	DeliveredAt    time.Time `json:"delivered_at"`
	ReadAt         time.Time `json:"read_at"`
	Sender         User      `json:"sender"`
}

func (db *DB) CreateMessage(message *Message) error {
	query := `
		INSERT INTO messages (id, conversation_id, content, sender_id, encrypted, message_type, created_at, delivered_at, read_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`
	_, err := db.Exec(query,
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

func (db *DB) GetMessages(limit int) ([]Message, error) {
	query := `
		SELECT id, conversation_id, content, sender_id, encrypted, message_type, created_at, delivered_at, read_at
		FROM messages
		ORDER BY created_at DESC
		LIMIT $1
	`
	rows, err := db.Query(query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var messages []Message
	for rows.Next() {
		var msg Message
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

func (db *DB) GetMessageByID(id string) (*Message, error) {
	query := `
		SELECT id, conversation_id, content, sender_id, encrypted, message_type, created_at, delivered_at, read_at
		FROM messages
		WHERE id = $1
	`
	var msg Message
	err := db.QueryRow(query, id).Scan(
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

func (db *DB) GetMessagesByConversation(conversationID string, limit int) ([]Message, error) {
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

	rows, err := db.Query(query, conversationID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var messages []Message
	for rows.Next() {
		var msg Message
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

		msg.Sender = User{
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
