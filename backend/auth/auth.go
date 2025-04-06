package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/RatneshMaurya/not-whatsapp/backend/config"
	"github.com/RatneshMaurya/not-whatsapp/backend/crypto"
	"github.com/RatneshMaurya/not-whatsapp/backend/models"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

type AuthService struct {
	config *oauth2.Config
	db     *models.DB
	jwtKey []byte
}

func NewAuthService(cfg *config.Config, db *models.DB) *AuthService {
	return &AuthService{
		config: &oauth2.Config{
			ClientID:     cfg.GoogleClientID,
			ClientSecret: cfg.GoogleSecret,
			RedirectURL:  "http://localhost:8080/api/v1/auth/google/callback",
			Scopes: []string{
				"https://www.googleapis.com/auth/userinfo.email",
				"https://www.googleapis.com/auth/userinfo.profile",
			},
			Endpoint: google.Endpoint,
		},
		db:     db,
		jwtKey: []byte(cfg.JWTSecret),
	}
}

// HandleGoogleLogin initiates the Google OAuth flow
func (s *AuthService) HandleGoogleLogin(c *gin.Context) {
	url := s.config.AuthCodeURL("state", oauth2.AccessTypeOffline)
	c.Redirect(http.StatusTemporaryRedirect, url)
}

// HandleGoogleCallback processes the OAuth callback
func (s *AuthService) HandleGoogleCallback(c *gin.Context) {
	code := c.Query("code")
	state := c.Query("state")

	log.Printf("Received OAuth callback with code: %s, state: %s", code, state)

	// Verify state parameter
	if state != "state" {
		log.Printf("Invalid state parameter: %s", state)
		c.Redirect(http.StatusTemporaryRedirect, "http://localhost:3000/login?error=invalid_state")
		return
	}

	token, err := s.config.Exchange(context.Background(), code)
	if err != nil {
		log.Printf("Failed to exchange token: %v", err)
		c.Redirect(http.StatusTemporaryRedirect, "http://localhost:3000/login?error=failed_to_exchange_token")
		return
	}
	log.Printf("Successfully exchanged token")

	// Get user info from Google
	client := s.config.Client(context.Background(), token)
	resp, err := client.Get("https://www.googleapis.com/oauth2/v2/userinfo")
	if err != nil {
		log.Printf("Failed to get user info: %v", err)
		c.Redirect(http.StatusTemporaryRedirect, "http://localhost:3000/login?error=failed_to_get_user_info")
		return
	}
	defer resp.Body.Close()
	log.Printf("Successfully got user info from Google")

	var userInfo struct {
		ID      string `json:"id"`
		Email   string `json:"email"`
		Name    string `json:"name"`
		Picture string `json:"picture"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&userInfo); err != nil {
		log.Printf("Failed to decode user info: %v", err)
		c.Redirect(http.StatusTemporaryRedirect, "http://localhost:3000/login?error=failed_to_decode_user_info")
		return
	}
	log.Printf("Successfully decoded user info: %+v", userInfo)

	// Generate a new public/private key pair for the user
	_, publicKey, err := crypto.GenerateKeyPair()
	if err != nil {
		log.Printf("Failed to generate encryption keys: %v", err)
		c.Redirect(http.StatusTemporaryRedirect, "http://localhost:3000/login?error=failed_to_generate_keys")
		return
	}
	log.Printf("Successfully generated encryption keys")

	// Create or update user in database
	user, err := s.db.CreateOrUpdateUser(userInfo.ID, userInfo.Email, userInfo.Name, userInfo.Picture, publicKey)
	if err != nil {
		log.Printf("Failed to create/update user: %v", err)
		c.Redirect(http.StatusTemporaryRedirect, "http://localhost:3000/login?error=failed_to_create_user")
		return
	}
	log.Printf("Successfully created/updated user in database: %+v", user)

	// Generate JWT token
	jwtToken, err := s.generateJWT(user)
	if err != nil {
		log.Printf("Failed to generate JWT: %v", err)
		c.Redirect(http.StatusTemporaryRedirect, "http://localhost:3000/login?error=failed_to_generate_token")
		return
	}
	log.Printf("Successfully generated JWT token")

	// Redirect back to frontend with token and user data
	redirectURL := fmt.Sprintf(
		"http://localhost:3000/login/callback?token=%s&id=%s&email=%s&name=%s&avatarUrl=%s",
		url.QueryEscape(jwtToken),
		url.QueryEscape(user.ID),
		url.QueryEscape(user.Email),
		url.QueryEscape(user.Name),
		url.QueryEscape(user.AvatarURL),
	)
	log.Printf("Redirecting to: %s", redirectURL)
	c.Redirect(http.StatusTemporaryRedirect, redirectURL)
}

func (s *AuthService) generateJWT(user *models.User) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":        user.ID,
		"name":       user.Name,
		"avatar_url": user.AvatarURL,
		"exp":        time.Now().Add(time.Hour * 24).Unix(),
	})

	return token.SignedString(s.jwtKey)
}

// Middleware to verify JWT token
func (s *AuthService) AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header is required"})
			c.Abort()
			return
		}

		// Split the header to get the token part
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid authorization header format"})
			c.Abort()
			return
		}

		tokenString := parts[1]
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return s.jwtKey, nil
		})

		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			c.Abort()
			return
		}

		if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
			c.Set("userID", claims["sub"])
			c.Next()
		} else {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token claims"})
			c.Abort()
		}
	}
}
