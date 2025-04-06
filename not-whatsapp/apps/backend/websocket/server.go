package websocket

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/your-org/not-whatsapp/backend/crypto"
	"github.com/your-org/not-whatsapp/backend/models"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // In production, implement proper origin checking
	},
}

type Message struct {
	ID        string    `json:"id"`
	Content   string    `json:"content"`
	Sender    User      `json:"sender"`
	Timestamp time.Time `json:"timestamp"`
	Encrypted bool      `json:"encrypted"`
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
	clients    map[*Client]bool
	broadcast  chan Message
	register   chan *Client
	unregister chan *Client
	db         *models.DB
}

func NewServer(db *models.DB) *Server {
	return &Server{
		clients:    make(map[*Client]bool),
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
			s.clients[client] = true
		case client := <-s.unregister:
			if _, ok := s.clients[client]; ok {
				delete(s.clients, client)
				close(client.send)
			}
		case message := <-s.broadcast:
			// Persist message to database
			dbMessage := &models.Message{
				ID:        message.ID,
				Content:   message.Content,
				SenderID:  message.Sender.ID,
				Encrypted: message.Encrypted,
				CreatedAt: message.Timestamp,
			}
			if err := s.db.CreateMessage(dbMessage); err != nil {
				log.Printf("error persisting message: %v", err)
			}

			for client := range s.clients {
				if message.Encrypted && client.user.ID != message.Sender.ID {
					continue
				}
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(s.clients, client)
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
				log.Printf("error: %v", err)
			}
			break
		}

		var msg Message
		if err := json.Unmarshal(message, &msg); err != nil {
			log.Printf("error unmarshaling message: %v", err)
			continue
		}

		msg.ID = generateMessageID()
		msg.Timestamp = time.Now()
		msg.Sender = c.user

		if msg.Encrypted {
			// In a real implementation, you would verify the encryption here
			// For now, we'll just pass it through
		}

		c.server.broadcast <- msg
	}
}

func (c *Client) writePump() {
	defer func() {
		c.conn.Close()
	}()

	for {
		message, ok := <-c.send
		if !ok {
			c.conn.WriteMessage(websocket.CloseMessage, []byte{})
			return
		}

		w, err := c.conn.NextWriter(websocket.TextMessage)
		if err != nil {
			return
		}

		json.NewEncoder(w).Encode(message)
		w.Close()
	}
}

func (s *Server) HandleWebSocket(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("error upgrading connection: %v", err)
		return
	}

	tokenString := c.Query("token")
	if tokenString == "" {
		conn.Close()
		return
	}

	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		return []byte("your-secret-key"), nil // In production, use a proper secret key
	})

	if err != nil || !token.Valid {
		conn.Close()
		return
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		conn.Close()
		return
	}

	_, publicKey, err := crypto.GenerateKeyPair()
	if err != nil {
		log.Printf("error generating key pair: %v", err)
		conn.Close()
		return
	}

	user := User{
		ID:        claims["sub"].(string),
		Name:      claims["name"].(string),
		AvatarUrl: claims["avatar_url"].(string),
		PublicKey: publicKey,
	}

	client := &Client{
		conn:   conn,
		server: s,
		user:   user,
		send:   make(chan Message, 256),
	}

	client.server.register <- client

	go client.writePump()
	go client.readPump()
}

func generateMessageID() string {
	return time.Now().Format("20060102150405.000000")
}
