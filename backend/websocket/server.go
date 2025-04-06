package websocket

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"time"

	"github.com/RatneshMaurya/not-whatsapp/backend/models"

	"github.com/dgrijalva/jwt-go"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		// Allow all origins during development
		if os.Getenv("GO_ENV") == "development" {
			return true
		}
		// In production, only allow specific origins
		origin := r.Header.Get("Origin")
		return origin == "http://localhost:3000" || origin == "https://localhost:3000"
	},
	ReadBufferSize:    1024,
	WriteBufferSize:   1024,
	HandshakeTimeout:  10 * time.Second,
	EnableCompression: true,
	Error: func(w http.ResponseWriter, r *http.Request, status int, reason error) {
		log.Printf("WebSocket upgrade error: %v", reason)
		http.Error(w, reason.Error(), status)
	},
}

type Message struct {
	ID          string    `json:"id"`
	Content     string    `json:"content"`
	Sender      User      `json:"sender"`
	RecipientID string    `json:"recipientId,omitempty"`
	Timestamp   time.Time `json:"timestamp"`
	Encrypted   bool      `json:"encrypted"`
}

type User struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	AvatarUrl string `json:"avatarUrl"`
	PublicKey string `json:"publicKey"`
}

type Client struct {
	conn   *websocket.Conn
	server *Server
	user   User
	send   chan Message
}

type Server struct {
	clients    map[string]*Client
	broadcast  chan Message
	register   chan *Client
	unregister chan *Client
	db         *models.DB
}

func NewServer(db *models.DB) *Server {
	return &Server{
		clients:    make(map[string]*Client),
		broadcast:  make(chan Message),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		db:         db,
	}
}

func (s *Server) Run() {
	for {
		select {
		case client := <-s.register:
			s.clients[client.user.ID] = client
			log.Printf("Client %s (%s) registered", client.user.ID, client.user.Name)
		case client := <-s.unregister:
			if _, ok := s.clients[client.user.ID]; ok {
				delete(s.clients, client.user.ID)
				close(client.send)
				log.Printf("Client %s (%s) unregistered", client.user.ID, client.user.Name)
			}
		case message := <-s.broadcast:
			// Broadcast to appropriate clients based on recipient
			if message.RecipientID != "" {
				// Direct message - send to recipient if online
				if recipient, ok := s.clients[message.RecipientID]; ok {
					select {
					case recipient.send <- message:
					default:
						close(recipient.send)
						delete(s.clients, recipient.user.ID)
					}
				}
				// Also send to sender for their own view
				if sender, ok := s.clients[message.Sender.ID]; ok {
					select {
					case sender.send <- message:
					default:
						close(sender.send)
						delete(s.clients, sender.user.ID)
					}
				}
			}
		}
	}
}

func (c *Client) readPump() {
	defer func() {
		c.server.unregister <- c
		c.conn.Close()
	}()

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket read error: %v", err)
			}
			break
		}

		log.Printf("Received WebSocket message: %s", string(message))

		var msg struct {
			Type           string `json:"type"`
			Content        string `json:"content"`
			ConversationID string `json:"conversation_id"`
			RecipientID    string `json:"recipient_id"`
			Encrypted      bool   `json:"encrypted"`
		}

		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("Error unmarshaling message: %v", err)
			continue
		}

		if msg.Type != "message" {
			log.Printf("Ignoring non-message type: %s", msg.Type)
			continue
		}

		// Create conversation if it doesn't exist
		conversationID := msg.ConversationID
		if conversationID == "" {
			conversationID = createConversationID(c.user.ID, msg.RecipientID)
			_, err = c.server.db.Exec(`
				INSERT INTO conversations (id, name, created_at)
				VALUES ($1, 'Direct Chat', NOW())
				ON CONFLICT (id) DO NOTHING
			`, conversationID)
			if err != nil {
				log.Printf("Error creating conversation: %v", err)
				continue
			}

			// Add participants if they don't exist
			_, err = c.server.db.Exec(`
				INSERT INTO conversation_participants (conversation_id, user_id, joined_at)
				VALUES ($1, $2, NOW()), ($1, $3, NOW())
				ON CONFLICT (conversation_id, user_id) DO NOTHING
			`, conversationID, c.user.ID, msg.RecipientID)
			if err != nil {
				log.Printf("Error adding participants: %v", err)
				continue
			}
		}

		// Create message in database
		dbMessage := models.Message{
			ID:             uuid.New().String(),
			ConversationID: conversationID,
			Content:        msg.Content,
			SenderID:       c.user.ID,
			Encrypted:      msg.Encrypted,
			MessageType:    "text",
			CreatedAt:      time.Now(),
			DeliveredAt:    time.Now(),
			ReadAt:         time.Time{},
		}

		log.Printf("Attempting to save message: ID=%s, ConversationID=%s, SenderID=%s",
			dbMessage.ID, dbMessage.ConversationID, dbMessage.SenderID)

		err = c.server.db.CreateMessage(&dbMessage)
		if err != nil {
			log.Printf("Failed to save message: %v", err)
			continue
		}

		log.Printf("Successfully saved message: ID=%s", dbMessage.ID)

		// Create response message
		response := Message{
			ID:      dbMessage.ID,
			Content: msg.Content,
			Sender: User{
				ID:        c.user.ID,
				Name:      c.user.Name,
				AvatarUrl: c.user.AvatarUrl,
				PublicKey: c.user.PublicKey,
			},
			RecipientID: msg.RecipientID,
			Timestamp:   time.Now(),
			Encrypted:   msg.Encrypted,
		}

		// Send message to appropriate clients
		if msg.RecipientID != "" {
			// Direct message - send to recipient if online
			if recipient, ok := c.server.clients[msg.RecipientID]; ok {
				select {
				case recipient.send <- response:
					log.Printf("Message sent to recipient: %s", msg.RecipientID)
				default:
					close(recipient.send)
					delete(c.server.clients, recipient.user.ID)
				}
			}
			// Also send to sender for their own view
			select {
			case c.send <- response:
				log.Printf("Message sent to sender: %s", c.user.ID)
			default:
				close(c.send)
				delete(c.server.clients, c.user.ID)
			}
		}
	}
}

func (c *Client) writePump() {
	defer func() {
		log.Printf("Stopping writePump for client %s", c.user.ID)
		c.conn.Close()
	}()

	log.Printf("Starting writePump for client %s (%s)", c.user.ID, c.user.Name)

	// Set write deadline to detect stale connections
	c.conn.SetWriteDeadline(time.Now().Add(60 * time.Second))

	for {
		message, ok := <-c.send
		if !ok {
			log.Printf("Send channel closed for client %s", c.user.ID)
			c.conn.WriteMessage(websocket.CloseMessage, []byte{})
			return
		}

		// Reset write deadline
		c.conn.SetWriteDeadline(time.Now().Add(60 * time.Second))

		w, err := c.conn.NextWriter(websocket.TextMessage)
		if err != nil {
			log.Printf("Error getting writer for client %s: %v", c.user.ID, err)
			return
		}

		if err := json.NewEncoder(w).Encode(message); err != nil {
			log.Printf("Error encoding message for client %s: %v", c.user.ID, err)
			return
		}

		if err := w.Close(); err != nil {
			log.Printf("Error closing writer for client %s: %v", c.user.ID, err)
			return
		}

		log.Printf("Message sent to client %s", c.user.ID)
	}
}

func (s *Server) HandleWebSocket(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Error upgrading connection: %v", err)
		return
	}

	tokenString := c.Query("token")
	if tokenString == "" {
		log.Printf("No token provided")
		conn.Close()
		return
	}

	// Parse JWT token
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(os.Getenv("JWT_SECRET")), nil
	})

	if err != nil || !token.Valid {
		log.Printf("Invalid token: %v", err)
		conn.Close()
		return
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		log.Printf("Invalid token claims")
		conn.Close()
		return
	}

	userID, ok := claims["sub"].(string)
	if !ok {
		log.Printf("Missing user ID in token")
		conn.Close()
		return
	}

	// Safely extract claims with defaults
	name, _ := claims["name"].(string)
	if name == "" {
		name = "Anonymous User"
	}

	avatarURL, _ := claims["avatar_url"].(string)
	if avatarURL == "" {
		avatarURL = "https://ui-avatars.com/api/?name=" + url.QueryEscape(name)
	}

	// Create client
	client := &Client{
		conn:   conn,
		server: s,
		user: User{
			ID:        userID,
			Name:      name,
			AvatarUrl: avatarURL,
		},
		send: make(chan Message, 256),
	}

	s.register <- client
	go client.writePump()
	go client.readPump()
}

func generateMessageID() string {
	return time.Now().Format("20060102150405.000000")
}

func (s *Server) handleMessage(client *Client, message []byte) {
	var msg struct {
		Content     string `json:"content"`
		RecipientID string `json:"recipientId,omitempty"`
		Encrypted   bool   `json:"encrypted"`
	}

	if err := json.Unmarshal(message, &msg); err != nil {
		log.Printf("Error unmarshaling message: %v", err)
		return
	}

	// Determine conversation ID
	conversationID := createConversationID(client.user.ID, msg.RecipientID)

	// Create message in database
	dbMessage := models.Message{
		ID:             uuid.New().String(),
		ConversationID: conversationID,
		Content:        msg.Content,
		SenderID:       client.user.ID,
		Encrypted:      msg.Encrypted,
		MessageType:    "text",
		CreatedAt:      time.Now(),
		DeliveredAt:    time.Now(),
		ReadAt:         time.Time{},
	}

	err := s.db.CreateMessage(&dbMessage)
	if err != nil {
		log.Printf("Error persisting message: %v", err)
		return
	}

	// Get sender's user information
	var senderName, senderAvatarUrl string
	err = s.db.QueryRow(`
		SELECT name, avatar_url 
		FROM users 
		WHERE id = $1
	`, client.user.ID).Scan(&senderName, &senderAvatarUrl)
	if err != nil {
		log.Printf("Error getting sender info: %v", err)
		return
	}

	// Create response message
	response := Message{
		ID:      dbMessage.ID,
		Content: msg.Content,
		Sender: User{
			ID:        client.user.ID,
			Name:      senderName,
			AvatarUrl: senderAvatarUrl,
		},
		RecipientID: msg.RecipientID,
		Timestamp:   time.Now(),
		Encrypted:   msg.Encrypted,
	}

	// Broadcast message to appropriate clients
	if msg.RecipientID != "" {
		// Direct message - send only to recipient
		if recipient, ok := s.clients[msg.RecipientID]; ok {
			select {
			case recipient.send <- response:
			default:
				close(recipient.send)
				delete(s.clients, recipient.user.ID)
			}
		}
		// Also send to sender for their own view
		select {
		case client.send <- response:
		default:
			close(client.send)
			delete(s.clients, client.user.ID)
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
