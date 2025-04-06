package models

import (
	"database/sql"
	"time"
)

type Conversation struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	CreatedAt    time.Time `json:"created_at"`
	LastMessage  *Message  `json:"last_message,omitempty"`
	Participants []User    `json:"participants"`
}

func (db *DB) GetRecentConversations(userID string) ([]Conversation, error) {
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

	rows, err := db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	conversations := make(map[string]*Conversation)
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
			conv = &Conversation{
				ID:           convID,
				Name:         convName,
				CreatedAt:    convCreatedAt,
				Participants: make([]User, 0),
			}
			conversations[convID] = conv
		}

		participant := User{
			ID:        participantID,
			Name:      participantName,
			Email:     participantEmail,
			AvatarURL: participantAvatar,
		}
		conv.Participants = append(conv.Participants, participant)

		if messageID.Valid {
			conv.LastMessage = &Message{
				ID:        messageID.String,
				Content:   messageContent.String,
				SenderID:  messageSenderID.String,
				CreatedAt: messageCreatedAt.Time,
			}
		}
	}

	result := make([]Conversation, 0, len(conversations))
	for _, conv := range conversations {
		result = append(result, *conv)
	}

	return result, nil
}
