package controllers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"time"

	"github.com/RatneshMaurya/not-whatsapp/backend/services"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

type AuthController struct {
	userService *services.UserService
	oauthConfig *oauth2.Config
}

func NewAuthController(userService *services.UserService) *AuthController {
	return &AuthController{
		userService: userService,
		oauthConfig: &oauth2.Config{
			ClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
			ClientSecret: os.Getenv("GOOGLE_SECRET"),
			RedirectURL:  "http://localhost:8080/api/v1/auth/google/callback",
			Scopes:       []string{"https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"},
			Endpoint:     google.Endpoint,
		},
	}
}

func (c *AuthController) HandleGoogleLogin(ctx *gin.Context) {
	// Generate a random state
	state := uuid.New().String()

	// Store state in cookie
	ctx.SetCookie("oauth_state", state, 3600, "/", "", false, true)

	// Get the redirect URL with state
	url := c.oauthConfig.AuthCodeURL(state, oauth2.AccessTypeOffline)
	log.Printf("Redirecting to Google OAuth URL: %s", url)

	ctx.Redirect(http.StatusTemporaryRedirect, url)
}

func (c *AuthController) HandleGoogleCallback(ctx *gin.Context) {
	// Verify state
	state := ctx.Query("state")
	storedState, _ := ctx.Cookie("oauth_state")
	if state == "" || state != storedState {
		log.Printf("Invalid OAuth state, expected %s, got %s", storedState, state)
		ctx.Redirect(http.StatusTemporaryRedirect, "http://localhost:3000/auth/error?error=Invalid+OAuth+state")
		return
	}

	code := ctx.Query("code")
	if code == "" {
		log.Printf("No code in callback")
		ctx.Redirect(http.StatusTemporaryRedirect, "http://localhost:3000/auth/error?error=No+authorization+code")
		return
	}

	token, err := c.oauthConfig.Exchange(ctx, code)
	if err != nil {
		log.Printf("Token exchange error: %v", err)
		ctx.Redirect(http.StatusTemporaryRedirect, "http://localhost:3000/auth/error?error=Failed+to+exchange+token")
		return
	}

	client := c.oauthConfig.Client(ctx, token)
	resp, err := client.Get("https://www.googleapis.com/oauth2/v2/userinfo")
	if err != nil {
		log.Printf("Failed to get user info: %v", err)
		ctx.Redirect(http.StatusTemporaryRedirect, "http://localhost:3000/auth/error?error=Failed+to+get+user+info")
		return
	}
	defer resp.Body.Close()

	var userInfo struct {
		ID        string `json:"id"`
		Email     string `json:"email"`
		Name      string `json:"name"`
		Picture   string `json:"picture"`
		PublicKey string `json:"public_key"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&userInfo); err != nil {
		log.Printf("Failed to decode user info: %v", err)
		ctx.Redirect(http.StatusTemporaryRedirect, "http://localhost:3000/auth/error?error=Failed+to+decode+user+info")
		return
	}

	log.Printf("Received user info: ID=%s, Email=%s, Name=%s", userInfo.ID, userInfo.Email, userInfo.Name)

	user, err := c.userService.CreateOrUpdateUser(userInfo.ID, userInfo.Email, userInfo.Name, userInfo.Picture, userInfo.PublicKey)
	if err != nil {
		log.Printf("Failed to create/update user: %v", err)
		ctx.Redirect(http.StatusTemporaryRedirect, "http://localhost:3000/auth/error?error=Failed+to+create+or+update+user")
		return
	}

	// Generate JWT token
	jwtToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":        user.ID,
		"name":       user.Name,
		"email":      user.Email,
		"avatar_url": user.AvatarURL,
		"exp":        time.Now().Add(24 * time.Hour).Unix(),
	})

	tokenString, err := jwtToken.SignedString([]byte(os.Getenv("JWT_SECRET")))
	if err != nil {
		log.Printf("Failed to generate token: %v", err)
		ctx.Redirect(http.StatusTemporaryRedirect, "http://localhost:3000/auth/error?error=Failed+to+generate+token")
		return
	}

	// Clear the oauth state cookie
	ctx.SetCookie("oauth_state", "", -1, "/", "", false, true)

	// Redirect to frontend with token
	redirectURL := fmt.Sprintf("http://localhost:3000/auth/callback?token=%s", url.QueryEscape(tokenString))
	log.Printf("Redirecting to frontend: %s", redirectURL)
	ctx.Redirect(http.StatusTemporaryRedirect, redirectURL)
}

func (c *AuthController) GetCurrentUser(ctx *gin.Context) {
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	user, err := c.userService.GetUserByID(userID.(string))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user"})
		return
	}

	ctx.JSON(http.StatusOK, user)
}
