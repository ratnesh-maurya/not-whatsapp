package main

import (
	"log"
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
	_ "github.com/your-org/not-whatsapp/backend/docs"

	"github.com/your-org/not-whatsapp/backend/auth"
	"github.com/your-org/not-whatsapp/backend/config"
	"github.com/your-org/not-whatsapp/backend/db"
	"github.com/your-org/not-whatsapp/backend/models"
	"github.com/your-org/not-whatsapp/backend/websocket"
)

// @title Not-WhatsApp API
// @version 1.0
// @description A secure messaging application
// @host localhost:8080
// @BasePath /api/v1
func main() {
	// Load environment variables
	err := godotenv.Load()
	if err != nil {
		log.Printf("Error loading .env file: %v", err)
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

	// Configure CORS
	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		AllowCredentials: true,
	}))

	// API routes
	v1 := router.Group("/api/v1")
	{
		// Health check
		v1.GET("/health", func(c *gin.Context) {
			c.JSON(200, gin.H{"status": "ok"})
		})

		// Auth routes
		v1.GET("/auth/google/login", authService.HandleGoogleLogin)
		v1.GET("/auth/google/callback", authService.HandleGoogleCallback)

		// WebSocket endpoint
		v1.GET("/ws", wsServer.HandleWebSocket)

		// Protected routes
		protected := v1.Group("")
		protected.Use(authService.AuthMiddleware())
		{
			// User routes
			protected.GET("/users/me", func(c *gin.Context) {
				user, _ := c.Get("user")
				c.JSON(200, user)
			})

			// Message routes
			protected.GET("/messages", func(c *gin.Context) {
				messages, err := db.GetMessages(50)
				if err != nil {
					c.JSON(500, gin.H{"error": "Failed to get messages"})
					return
				}
				c.JSON(200, messages)
			})

			// Conversation routes
			protected.GET("/conversations", func(c *gin.Context) {
				c.JSON(200, gin.H{"message": "List conversations"})
			})
			protected.POST("/conversations", func(c *gin.Context) {
				c.JSON(200, gin.H{"message": "Create conversation"})
			})
			protected.GET("/conversations/:id", func(c *gin.Context) {
				c.JSON(200, gin.H{"message": "Get conversation"})
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
