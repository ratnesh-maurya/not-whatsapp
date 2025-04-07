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

			// Extract message data
			content, _ := data["content"].(string)
			conversationID, _ := data["conversation_id"].(string)
			recipientID, _ := data["recipient_id"].(string)
			tempID, _ := data["temp_id"].(string)

			if content == "" || (conversationID == "" && recipientID == "") {
				log.Printf("Invalid message data: missing required fields")
				continue
			}

			// Generate a new message ID
			messageID := uuid.New().String()

			// Create database message
			// First ensure we have a valid conversation ID
			if conversationID == "" && recipientID != "" {
				// Create consistent conversation ID for direct messages
				conversationID = createConversationID(c.userID, recipientID)
				log.Printf("Created conversation ID %s for users %s and %s",
					conversationID, c.userID, recipientID)
			}

			// Save message to database
			currentTime := time.Now()
			_, err := wc.db.Exec(`
				INSERT INTO messages (
					id, conversation_id, sender_id, content, 
					created_at, delivered_at, message_type, encrypted
				)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			`,
				messageID, conversationID, c.userID, content,
				currentTime, currentTime, "text", false,
			)

			if err != nil {
				log.Printf("Failed to save message to database: %v", err)
				// Send error response to client
				errorResp := map[string]interface{}{
					"type":    "error",
					"message": "Failed to save message",
					"temp_id": tempID,
					"id":      uuid.New().String(),
				}
				errorJSON, _ := json.Marshal(errorResp)
				c.send <- errorJSON
				continue
			}

			log.Printf("Message saved to database with ID: %s", messageID)

			// Add metadata
			data["id"] = messageID
			data["timestamp"] = currentTime
			data["sender"] = map[string]interface{}{
				"id":        c.userID,
				"name":      c.userName,
				"avatarUrl": c.avatarURL,
			}
			data["conversation_id"] = conversationID

			respJSON, _ := json.Marshal(data)

			// Directly send the message to the relevant clients
			// instead of broadcasting to all clients
			if recipientID != "" {
				// Send to the recipient if they're connected
				wc.mu.Lock()
				sentToRecipient := false
				if recipient, ok := wc.clients[recipientID]; ok {
					log.Printf("Sending message directly to recipient: %s", recipientID)
					select {
					case recipient.send <- respJSON:
						log.Printf("Message sent to recipient %s successfully", recipientID)
						sentToRecipient = true
					default:
						log.Printf("Failed to send message to recipient %s, channel might be full", recipientID)
					}
				} else {
					log.Printf("Recipient %s is not currently connected, message will be delivered when they connect", recipientID)
				}

				// Debug info about current connections
				connectedClients := make([]string, 0, len(wc.clients))
				for clientID := range wc.clients {
					connectedClients = append(connectedClients, clientID)
				}
				log.Printf("Current connected clients: %v", connectedClients)

				// Store message delivery status in database
				_, err = wc.db.Exec(`
					UPDATE messages 
					SET delivered = $1, delivered_at = $2
					WHERE id = $3
				`, sentToRecipient, currentTime, messageID)

				if err != nil {
					log.Printf("Failed to update message delivery status: %v", err)
				}

				wc.mu.Unlock()

				// Always send confirmation back to the sender
				select {
				case c.send <- respJSON:
					log.Printf("Message confirmation sent to sender %s", c.userID)
				default:
					log.Printf("Failed to send confirmation to sender %s", c.userID)
				}
			} else {
				// If no specific recipient (group chat), broadcast to all
				log.Printf("Broadcasting message to all clients (group chat)")
				wc.broadcast <- respJSON
			}

		default:
			log.Printf("Unknown message type: %s", messageType)
		}
	}
}

// Helper function to create consistent conversation IDs for direct messages
func createConversationID(userID1, userID2 string) string {
	// Sort IDs to ensure consistent conversation ID regardless of order
	if userID1 > userID2 {
		userID1, userID2 = userID2, userID1
	}
	// Create a deterministic UUID from the two user IDs
	return uuid.NewSHA1(uuid.Nil, []byte(userID1+userID2)).String()
}
