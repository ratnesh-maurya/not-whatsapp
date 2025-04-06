package models

import (
	"time"
)

type Message struct {
	ID        string    `json:"id"`
	Content   string    `json:"content"`
	SenderID  string    `json:"sender_id"`
	Encrypted bool      `json:"encrypted"`
	CreatedAt time.Time `json:"created_at"`
}

func (db *DB) CreateMessage(message *Message) error {
	query := `
		INSERT INTO messages (id, content, sender_id, encrypted, created_at)
		VALUES ($1, $2, $3, $4, $5)
	`
	_, err := db.Exec(query, message.ID, message.Content, message.SenderID, message.Encrypted, message.CreatedAt)
	return err
}

func (db *DB) GetMessages(limit int) ([]Message, error) {
	query := `
		SELECT id, content, sender_id, encrypted, created_at
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
		err := rows.Scan(&msg.ID, &msg.Content, &msg.SenderID, &msg.Encrypted, &msg.CreatedAt)
		if err != nil {
			return nil, err
		}
		messages = append(messages, msg)
	}

	return messages, nil
}

func (db *DB) GetMessageByID(id string) (*Message, error) {
	query := `
		SELECT id, content, sender_id, encrypted, created_at
		FROM messages
		WHERE id = $1
	`
	var msg Message
	err := db.QueryRow(query, id).Scan(&msg.ID, &msg.Content, &msg.SenderID, &msg.Encrypted, &msg.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &msg, nil
}
