package models

import (
	"database/sql"
	"time"
)

type User struct {
	ID        string    `json:"id"`
	GoogleID  string    `json:"googleId"`
	Email     string    `json:"email"`
	Name      string    `json:"name"`
	AvatarURL string    `json:"avatarUrl"`
	PublicKey string    `json:"publicKey"`
	CreatedAt time.Time `json:"createdAt"`
	LastSeen  time.Time `json:"lastSeen"`
}

type DB struct {
	*sql.DB
}

func (db *DB) CreateOrUpdateUser(googleID, email, name, avatarURL, publicKey string) (*User, error) {
	query := `
		INSERT INTO users (google_id, email, name, avatar_url, public_key)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (google_id) DO UPDATE
		SET email = $2, name = $3, avatar_url = $4, public_key = $5
		RETURNING id, google_id, email, name, avatar_url, public_key, created_at, last_seen
	`

	user := &User{}
	err := db.QueryRow(query, googleID, email, name, avatarURL, publicKey).Scan(
		&user.ID,
		&user.GoogleID,
		&user.Email,
		&user.Name,
		&user.AvatarURL,
		&user.PublicKey,
		&user.CreatedAt,
		&user.LastSeen,
	)

	if err != nil {
		return nil, err
	}

	return user, nil
}

func (db *DB) GetUserByID(id string) (*User, error) {
	query := `
		SELECT id, google_id, email, name, avatar_url, public_key, created_at, last_seen
		FROM users
		WHERE id = $1
	`

	user := &User{}
	err := db.QueryRow(query, id).Scan(
		&user.ID,
		&user.GoogleID,
		&user.Email,
		&user.Name,
		&user.AvatarURL,
		&user.PublicKey,
		&user.CreatedAt,
		&user.LastSeen,
	)

	if err != nil {
		return nil, err
	}

	return user, nil
}

func (db *DB) UpdateLastSeen(userID string) error {
	query := `
		UPDATE users
		SET last_seen = CURRENT_TIMESTAMP
		WHERE id = $1
	`

	_, err := db.Exec(query, userID)
	return err
}
