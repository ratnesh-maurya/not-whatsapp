package services

import (
	"database/sql"

	"github.com/RatneshMaurya/not-whatsapp/backend/models"
)

type UserService struct {
	db *sql.DB
}

func NewUserService(db *sql.DB) *UserService {
	return &UserService{db: db}
}

func (s *UserService) CreateOrUpdateUser(googleID, email, name, avatarURL, publicKey string) (*models.User, error) {
	query := `
		INSERT INTO users (google_id, email, name, avatar_url, public_key, last_seen)
		VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
		ON CONFLICT (google_id) DO UPDATE
		SET email = $2, name = $3, avatar_url = $4, public_key = $5, last_seen = CURRENT_TIMESTAMP
		RETURNING id, google_id, email, name, avatar_url, public_key, created_at, last_seen
	`

	user := &models.User{}
	err := s.db.QueryRow(query, googleID, email, name, avatarURL, publicKey).Scan(
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

func (s *UserService) GetUserByID(id string) (*models.User, error) {
	query := `
		SELECT id, google_id, email, name, avatar_url, public_key, created_at, last_seen
		FROM users
		WHERE id = $1
	`

	user := &models.User{}
	err := s.db.QueryRow(query, id).Scan(
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

func (s *UserService) UpdateLastSeen(userID string) error {
	query := `
		UPDATE users
		SET last_seen = CURRENT_TIMESTAMP
		WHERE id = $1
	`

	_, err := s.db.Exec(query, userID)
	return err
}

func (s *UserService) GetUsers() ([]models.User, error) {
	query := `
		SELECT id, email, name, avatar_url, public_key, created_at, last_seen
		FROM users
		ORDER BY name ASC
	`
	rows, err := s.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var user models.User
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
