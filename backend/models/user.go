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
		INSERT INTO users (google_id, email, name, avatar_url, public_key, last_seen)
		VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
		ON CONFLICT (google_id) DO UPDATE
		SET email = $2, name = $3, avatar_url = $4, public_key = $5, last_seen = CURRENT_TIMESTAMP
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

func (db *DB) GetUsers() ([]User, error) {
	query := `
		SELECT id, email, name, avatar_url, public_key, created_at, last_seen
		FROM users
		ORDER BY name ASC
	`
	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var user User
		err := rows.Scan(
			&user.ID,
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
		users = append(users, user)
	}

	return users, nil
}
