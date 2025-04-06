package controllers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

// WebSocketClient represents a connected client
type WebSocketClient struct {
	conn      *websocket.Conn
	userID    string
	userName  string
	send      chan []byte
	avatarURL string
}

// WebSocketController handles WebSocket connections
type WebSocketController struct {
	db         *sql.DB
	clients    map[string]*WebSocketClient
	register   chan *WebSocketClient
	unregister chan *WebSocketClient
	broadcast  chan []byte
	mu         sync.Mutex
}

// NewWebSocketController creates a new WebSocket controller
func NewWebSocketController(db *sql.DB) *WebSocketController {
	controller := &WebSocketController{
		db:         db,
		clients:    make(map[string]*WebSocketClient),
		register:   make(chan *WebSocketClient),
		unregister: make(chan *WebSocketClient),
		broadcast:  make(chan []byte),
	}

	// Start listening for channel events
	go controller.run()

	return controller
}

// Most basic upgrader with minimal configuration
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins
	},
}

// run processes websocket events
func (wc *WebSocketController) run() {
	for {
		select {
		case client := <-wc.register:
			wc.mu.Lock()
			// Check if a client with the same userID already exists
			if existingClient, ok := wc.clients[client.userID]; ok {
				log.Printf("Closing existing connection for user %s", client.userID)
				existingClient.conn.Close()
				delete(wc.clients, client.userID)
			}

			wc.clients[client.userID] = client
			wc.mu.Unlock()
			log.Printf("Client registered: %s (%s)", client.userID, client.userName)

		case client := <-wc.unregister:
			wc.mu.Lock()
			if _, ok := wc.clients[client.userID]; ok {
				log.Printf("Unregistering client: %s", client.userID)
				delete(wc.clients, client.userID)
				wc.mu.Unlock()

				func() {
					defer func() {
						if r := recover(); r != nil {
							log.Printf("Recovered from panic when closing channel: %v", r)
						}
					}()
					close(client.send)
				}()
			} else {
				wc.mu.Unlock()
			}

		case message := <-wc.broadcast:
			wc.mu.Lock()
			clients := make(map[string]*WebSocketClient, len(wc.clients))
			for userID, client := range wc.clients {
				clients[userID] = client
			}
			wc.mu.Unlock()

			// Broadcast to all clients (without holding the mutex)
			for userID, client := range clients {
				func(userID string, client *WebSocketClient) {
					defer func() {
						if r := recover(); r != nil {
							log.Printf("Recovered from panic in broadcast: %v", r)
						}
					}()

					select {
					case client.send <- message:
						// Message sent successfully
					default:
						// Failed to send, clean up client
						log.Printf("Failed to send message to client %s, unregistering", userID)
						client.conn.Close()

						wc.mu.Lock()
						delete(wc.clients, userID)
						wc.mu.Unlock()

						func() {
							defer func() {
								if r := recover(); r != nil {
									log.Printf("Recovered from panic closing channel: %v", r)
								}
							}()
							close(client.send)
						}()
					}
				}(userID, client)
			}
		}
	}
}

// HandleWebSocket upgrades HTTP connection to WebSocket
func (wc *WebSocketController) HandleWebSocket(c *gin.Context) {
	log.Printf("WebSocket connection request from %s", c.ClientIP())

	// Get token from query parameters
	tokenString := c.Query("token")
	if tokenString == "" {
		log.Printf("No token provided")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Missing token"})
		return
	}

	// Parse token with no validation (just extract claims)
	token, _ := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		// Always return the secret - we just want to extract claims
		return []byte("your-secret-key"), nil
	})

	// Extract claims directly without validation
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		log.Printf("Invalid token format")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token format"})
		return
	}

	// Extract user info from claims
	userID, _ := claims["sub"].(string)
	if userID == "" {
		log.Printf("No user ID in token")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "No user ID in token"})
		return
	}

	userName, _ := claims["name"].(string)
	if userName == "" {
		userName = "Anonymous"
	}

	avatarURL, _ := claims["avatar_url"].(string)

	log.Printf("Upgrading connection for user: %s (%s)", userID, userName)

	// Upgrade the HTTP connection to a websocket connection - minimal configuration
	upgrader.CheckOrigin = func(r *http.Request) bool { return true }
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Failed to upgrade connection: %v", err)
		return
	}

	// Connection succeeded
	log.Printf("WebSocket connection established for %s (%s)", userID, userName)

	// Create a new client
	client := &WebSocketClient{
		conn:      conn,
		userID:    userID,
		userName:  userName,
		send:      make(chan []byte, 256),
		avatarURL: avatarURL,
	}

	// Register the client
	wc.register <- client

	// Send welcome message directly (don't use channel to avoid potential deadlock)
	welcomeMsg := map[string]interface{}{
		"type":      "connected",
		"timestamp": time.Now(),
		"id":        uuid.New().String(),
	}

	welcomeJSON, _ := json.Marshal(welcomeMsg)
	conn.WriteMessage(websocket.TextMessage, welcomeJSON)

	// Start read/write routines
	go client.writePump()
	go client.readPump(wc)
}

// writePump pumps messages from the hub to the websocket connection
func (c *WebSocketClient) writePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		// Attempt to close connection gracefully
		err := c.conn.WriteControl(
			websocket.CloseMessage,
			websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""),
			time.Now().Add(time.Second),
		)
		if err != nil {
			log.Printf("Error sending close message: %v", err)
		}
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			if !ok {
				// Channel was closed, exit
				log.Printf("Send channel closed for client %s", c.userID)
				return
			}

			// Set a write deadline
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))

			// Try to write the message
			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				log.Printf("Error writing message: %v", err)
				return
			}

		case <-ticker.C:
			// Send ping
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				log.Printf("Error sending ping: %v", err)
				return
			}
		}
	}
}

// readPump pumps messages from the websocket connection to the hub
func (c *WebSocketClient) readPump(wc *WebSocketController) {
	defer func() {
		log.Printf("Client %s disconnected, cleaning up", c.userID)
		wc.unregister <- c
	}()

	// Set read parameters
	c.conn.SetReadLimit(4096)
	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		log.Printf("Received pong from client %s", c.userID)
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	// Set close handler
	c.conn.SetCloseHandler(func(code int, text string) error {
		log.Printf("Connection closed by client: %d %s", code, text)
		return nil
	})

	for {
		// Read message
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				log.Printf("WebSocket read error: %v", err)
			} else {
				log.Printf("Connection closed: %v", err)
			}
			break
		}

		log.Printf("Received message from %s: %s", c.userID, string(message))

		// Process message
		var data map[string]interface{}
		if err := json.Unmarshal(message, &data); err != nil {
			log.Printf("Invalid JSON received: %v", err)
			continue
		}

		// Handle different message types
		messageType, _ := data["type"].(string)
		if messageType == "" {
			log.Printf("Message has no type field")
			continue
		}

		switch messageType {
		case "ping":
			// Handle ping-pong for keepalive
			log.Printf("Ping received from %s", c.userID)
			pongResp := map[string]interface{}{
				"type":      "pong",
				"timestamp": time.Now(),
				"id":        uuid.New().String(),
			}
			pongJSON, _ := json.Marshal(pongResp)
			c.send <- pongJSON

		case "message":
			// Handle regular message
			log.Printf("Message received from %s", c.userID)

			// Add metadata
			data["id"] = uuid.New().String()
			data["timestamp"] = time.Now()
			data["sender"] = map[string]interface{}{
				"id":        c.userID,
				"name":      c.userName,
				"avatarUrl": c.avatarURL,
			}

			respJSON, _ := json.Marshal(data)
			wc.broadcast <- respJSON

			// Persist message to database if needed (just logging for now)
			content, _ := data["content"].(string)
			if content != "" {
				log.Printf("Message from %s: %s", c.userID, content)
			}

		default:
			log.Printf("Unknown message type: %s", messageType)
		}
	}
}
