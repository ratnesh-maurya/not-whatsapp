package main

import (
	"database/sql"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/RatneshMaurya/not-whatsapp/backend/auth"
	"github.com/RatneshMaurya/not-whatsapp/backend/controllers"
	"github.com/RatneshMaurya/not-whatsapp/backend/migrations"
	"github.com/RatneshMaurya/not-whatsapp/backend/services"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Printf("Warning: .env file not found, using environment variables")
	}

	// Initialize database connection
	db, err := sql.Open("postgres", os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	// Test database connection
	if err := db.Ping(); err != nil {
		log.Fatalf("Database connection failed: %v", err)
	}
	log.Println("Database connected successfully")

	// Run database migrations
	if err := migrations.RunMigrations(db); err != nil {
		log.Fatalf("Error running migrations: %v", err)
	}
	log.Println("Database migrations completed")

	// Initialize services
	userService := services.NewUserService(db)
	messageService := services.NewMessageService(db)
	conversationService := services.NewConversationService(db)

	// Initialize controllers
	authController := controllers.NewAuthController(userService)
	userController := controllers.NewUserController(userService)
	conversationController := controllers.NewConversationController(conversationService, messageService)
	wsController := controllers.NewWebSocketController(db)

	// Set Gin mode based on environment
	if os.Getenv("GIN_MODE") != "" {
		gin.SetMode(os.Getenv("GIN_MODE"))
	} else {
		gin.SetMode(gin.ReleaseMode)
	}

	// Initialize Gin router
	r := gin.New()
	r.Use(gin.Logger())
	r.Use(gin.Recovery())

	// Simple request logging middleware
	r.Use(func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path

		c.Next()

		latency := time.Since(start)
		status := c.Writer.Status()

		log.Printf("Request: %s %s | Status: %d | Latency: %s",
			c.Request.Method, path, status, latency)
	})

	// Configure CORS
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD", "CONNECT", "TRACE"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Content-Length", "Accept-Encoding", "X-CSRF-Token", "Authorization", "Accept", "Cache-Control", "X-Requested-With", "Upgrade", "Connection", "Sec-WebSocket-Key", "Sec-WebSocket-Version", "Sec-WebSocket-Extensions", "Sec-WebSocket-Protocol"},
		ExposeHeaders:    []string{"Content-Length", "Content-Type", "Location", "Authorization", "Upgrade", "Connection", "Sec-WebSocket-Protocol", "Sec-WebSocket-Accept"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// WebSocket specific middleware - only handle OPTIONS preflight
	r.Use(func(c *gin.Context) {
		// Only handle WebSocket route OPTIONS requests
		if c.Request.URL.Path == "/ws" && c.Request.Method == "OPTIONS" {
			c.Writer.Header().Set("Access-Control-Max-Age", "86400")
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	})

	// Public routes
	r.GET("/api/v1/auth/google/login", authController.HandleGoogleLogin)
	r.GET("/api/v1/auth/google/callback", authController.HandleGoogleCallback)

	// WebSocket route
	r.GET("/ws", wsController.HandleWebSocket)

	// Protected routes
	api := r.Group("/api/v1")
	api.Use(auth.AuthMiddleware)
	{
		api.GET("/users/me", userController.GetCurrentUser)
		api.GET("/users", userController.GetUsers)
		api.GET("/conversations", conversationController.GetConversations)
		api.POST("/conversations", conversationController.CreateConversation)
		api.GET("/conversations/:id", conversationController.GetConversation)
		api.GET("/conversations/:id/messages", conversationController.GetConversationMessages)
	}

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
