package controllers

import (
	"log"
	"net/http"

	"github.com/RatneshMaurya/not-whatsapp/backend/services"
	"github.com/gin-gonic/gin"
)

type ConversationController struct {
	conversationService *services.ConversationService
	messageService      *services.MessageService
}

func NewConversationController(conversationService *services.ConversationService, messageService *services.MessageService) *ConversationController {
	return &ConversationController{
		conversationService: conversationService,
		messageService:      messageService,
	}
}

func (c *ConversationController) GetConversations(ctx *gin.Context) {
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	conversations, err := c.conversationService.GetRecentConversations(userID.(string))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get conversations"})
		return
	}
	ctx.JSON(http.StatusOK, conversations)
}

func (c *ConversationController) CreateConversation(ctx *gin.Context) {
	var request struct {
		ParticipantIDs []string `json:"participant_ids" binding:"required"`
	}

	if err := ctx.ShouldBindJSON(&request); err != nil {
		log.Printf("Invalid request body: %v", err)
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	userID, exists := ctx.Get("userID")
	if !exists {
		log.Printf("User not authenticated")
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Add current user to participants
	participants := append(request.ParticipantIDs, userID.(string))

	// Create conversation
	conversation, err := c.conversationService.CreateConversation("Direct Chat", participants)
	if err != nil {
		log.Printf("Failed to create conversation: %v", err)
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create conversation"})
		return
	}

	ctx.JSON(http.StatusOK, conversation)
}

func (c *ConversationController) GetConversation(ctx *gin.Context) {
	ctx.JSON(http.StatusOK, gin.H{"message": "Get conversation"})
}

func (c *ConversationController) GetConversationMessages(ctx *gin.Context) {
	conversationID := ctx.Param("id")
	messages, err := c.messageService.GetMessagesByConversation(conversationID, 50)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get messages"})
		return
	}
	ctx.JSON(http.StatusOK, messages)
}
