package main

import (
	"log"
	"net/http"
	"os"
	"time"

	_ "github.com/RatneshMaurya/not-whatsapp/backend/docs"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"

	"github.com/RatneshMaurya/not-whatsapp/backend/auth"
	"github.com/RatneshMaurya/not-whatsapp/backend/config"
	"github.com/RatneshMaurya/not-whatsapp/backend/db"
	"github.com/RatneshMaurya/not-whatsapp/backend/models"
	"github.com/RatneshMaurya/not-whatsapp/backend/websocket"
	"github.com/google/uuid"
)

// @title NotWhatsApp API
// @version 1.0
// @description A secure messaging application
// @host localhost:8080
// @BasePath /api/v1
// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization
func main() {
	// Load environment variables
	err := godotenv.Load()
	if err != nil {
		log.Printf("Error loading .env file: %v", err)
	}

	// Check if we should run migrations
	if len(os.Args) > 1 && os.Args[1] == "migrate" {
		log.Println("Running database migrations...")
		database, err := db.NewDB(config.LoadConfig())
		if err != nil {
			log.Fatal(err)
		}
		defer database.Close()

		// Drop existing tables if they exist
		_, err = database.Exec(`
			DROP TABLE IF EXISTS conversation_participants;
			DROP TABLE IF EXISTS messages;
			DROP TABLE IF EXISTS conversations;
			DROP TABLE IF EXISTS users;
		`)
		if err != nil {
			log.Fatalf("Error dropping tables: %v", err)
		}

		// Read and execute migration files in order
		migrationFiles := []string{
			"migrations/000001_init_schema.up.sql",
			"migrations/000002_create_messages_table.up.sql",
			"migrations/000003_update_messages_table.up.sql",
		}

		for _, file := range migrationFiles {
			content, err := os.ReadFile(file)
			if err != nil {
				log.Fatalf("Error reading migration file %s: %v", file, err)
			}

			_, err = database.Exec(string(content))
			if err != nil {
				log.Fatalf("Error executing migration %s: %v", file, err)
			}
			log.Printf("Successfully executed migration: %s", file)
		}
		log.Println("Migrations completed successfully")
		return
	}

	// Initialize configuration
	cfg := config.LoadConfig()

	// Initialize database
	database, err := db.NewDB(cfg)
	if err != nil {
		log.Fatal(err)
	}
	defer database.Close()

	// Initialize models
	db := &models.DB{DB: database}

	// Initialize auth service
	authService := auth.NewAuthService(cfg, db)

	// Initialize WebSocket server
	wsServer := websocket.NewServer(db)
	go wsServer.Run()

	// Initialize Gin router
	router := gin.Default()

	// Set trusted proxies
	router.SetTrustedProxies([]string{"127.0.0.1", "::1"})

	// Configure CORS
	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		AllowCredentials: true,
		ExposeHeaders:    []string{"Content-Length"},
		MaxAge:           12 * time.Hour,
		AllowWebSockets:  true,
	}))

	// API routes
	v1 := router.Group("/api/v1")
	{
		// @Summary Health check endpoint
		// @Description Check if the API is running
		// @Tags health
		// @Produce json
		// @Success 200 {object} map[string]string
		// @Router /health [get]
		v1.GET("/health", func(c *gin.Context) {
			c.JSON(200, gin.H{"status": "ok"})
		})

		// @Summary Google OAuth login
		// @Description Redirects to Google OAuth login page
		// @Tags auth
		// @Router /auth/google/login [get]
		v1.GET("/auth/google/login", authService.HandleGoogleLogin)

		// @Summary Google OAuth callback
		// @Description Handles Google OAuth callback
		// @Tags auth
		// @Param code query string true "Authorization code"
		// @Success 200 {object} map[string]interface{}
		// @Router /auth/google/callback [get]
		v1.GET("/auth/google/callback", authService.HandleGoogleCallback)

		// @Summary WebSocket connection
		// @Description Establishes WebSocket connection
		// @Tags websocket
		// @Param token query string true "JWT token"
		// @Router /ws [get]
		router.GET("/ws", func(c *gin.Context) {
			wsServer.HandleWebSocket(c)
		})

		// Protected routes
		protected := v1.Group("")
		protected.Use(authService.AuthMiddleware())
		{
			// @Summary Get current user
			// @Description Get information about the currently authenticated user
			// @Tags users
			// @Security BearerAuth
			// @Success 200 {object} models.User
			// @Router /users/me [get]
			protected.GET("/users/me", func(c *gin.Context) {
				user, _ := c.Get("user")
				c.JSON(200, user)
			})

			// @Summary Get messages
			// @Description Get a list of messages
			// @Tags messages
			// @Security BearerAuth
			// @Success 200 {array} models.Message
			// @Router /messages [get]
			protected.GET("/messages", func(c *gin.Context) {
				messages, err := db.GetMessages(50)
				if err != nil {
					c.JSON(500, gin.H{"error": "Failed to get messages"})
					return
				}
				c.JSON(200, messages)
			})

			// @Summary Get conversations
			// @Description Get a list of conversations
			// @Tags conversations
			// @Security BearerAuth
			// @Success 200 {array} models.Conversation
			// @Router /conversations [get]
			protected.GET("/conversations", func(c *gin.Context) {
				userID, _ := c.Get("userID")
				conversations, err := db.GetRecentConversations(userID.(string))
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get conversations"})
					return
				}
				c.JSON(http.StatusOK, conversations)
			})

			// @Summary Create conversation
			// @Description Create a new conversation
			// @Tags conversations
			// @Security BearerAuth
			// @Success 200 {object} models.Conversation
			// @Router /conversations [post]
			protected.POST("/conversations", func(c *gin.Context) {
				var request struct {
					ParticipantIDs []string `json:"participant_ids" binding:"required"`
				}

				if err := c.ShouldBindJSON(&request); err != nil {
					log.Printf("Invalid request body: %v", err)
					c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
					return
				}

				// Get the current user's ID from the context
				userID, exists := c.Get("userID")
				if !exists {
					log.Printf("User not authenticated")
					c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
					return
				}

				// Create a new conversation
				conversationID := uuid.New().String()
				_, err := db.Exec(`
					INSERT INTO conversations (id, name, created_at)
					VALUES ($1, 'Direct Chat', NOW())
				`, conversationID)
				if err != nil {
					log.Printf("Failed to create conversation: %v", err)
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create conversation"})
					return
				}

				// Add participants to the conversation
				participants := append(request.ParticipantIDs, userID.(string))
				for _, participantID := range participants {
					_, err := db.Exec(`
						INSERT INTO conversation_participants (conversation_id, user_id, joined_at)
						VALUES ($1, $2, NOW())
						ON CONFLICT (conversation_id, user_id) DO NOTHING
					`, conversationID, participantID)
					if err != nil {
						log.Printf("Failed to add participant %s: %v", participantID, err)
						c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add participants"})
						return
					}
				}

				// Get the created conversation with participants
				var newConversation models.Conversation
				newConversation.LastMessage = &models.Message{} // Initialize LastMessage
				err = db.QueryRow(`
					SELECT c.id, c.name, c.created_at,
						COALESCE(
							(SELECT m.content
							FROM messages m
							WHERE m.conversation_id = c.id
							ORDER BY m.created_at DESC
							LIMIT 1),
							''
						) as last_message_content,
						COALESCE(
							(SELECT m.created_at
							FROM messages m
							WHERE m.conversation_id = c.id
							ORDER BY m.created_at DESC
							LIMIT 1),
							c.created_at
						) as last_message_time
					FROM conversations c
					WHERE c.id = $1
				`, conversationID).Scan(
					&newConversation.ID,
					&newConversation.Name,
					&newConversation.CreatedAt,
					&newConversation.LastMessage.Content,
					&newConversation.LastMessage.CreatedAt,
				)
				if err != nil {
					log.Printf("Failed to get conversation: %v", err)
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get conversation"})
					return
				}

				// Get participants for the conversation
				rows, err := db.Query(`
					SELECT u.id, u.name, u.avatar_url
					FROM users u
					JOIN conversation_participants cp ON cp.user_id = u.id
					WHERE cp.conversation_id = $1
				`, conversationID)
				if err != nil {
					log.Printf("Failed to get participants: %v", err)
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get participants"})
					return
				}
				defer rows.Close()

				var conversationParticipants []models.User
				for rows.Next() {
					var participant models.User
					if err := rows.Scan(&participant.ID, &participant.Name, &participant.AvatarURL); err != nil {
						log.Printf("Failed to scan participant: %v", err)
						continue
					}
					conversationParticipants = append(conversationParticipants, participant)
				}
				newConversation.Participants = conversationParticipants

				c.JSON(http.StatusOK, newConversation)
			})

			// @Summary Get conversation
			// @Description Get a specific conversation by ID
			// @Tags conversations
			// @Security BearerAuth
			// @Param id path string true "Conversation ID"
			// @Success 200 {object} models.Conversation
			// @Router /conversations/{id} [get]
			protected.GET("/conversations/:id", func(c *gin.Context) {
				c.JSON(200, gin.H{"message": "Get conversation"})
			})

			// @Summary Get all users
			// @Description Get a list of all users
			// @Tags users
			// @Security BearerAuth
			// @Success 200 {array} models.User
			// @Router /users [get]
			protected.GET("/users", func(c *gin.Context) {
				users, err := db.GetUsers()
				if err != nil {
					c.JSON(500, gin.H{"error": "Failed to get users"})
					return
				}
				c.JSON(200, users)
			})

			// Get conversation messages
			protected.GET("/conversations/:id/messages", func(c *gin.Context) {
				conversationID := c.Param("id")
				messages, err := db.GetMessagesByConversation(conversationID, 50)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get messages"})
					return
				}
				c.JSON(http.StatusOK, messages)
			})
		}
	}

	// Swagger documentation
	router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	router.Run(":" + port)
}
