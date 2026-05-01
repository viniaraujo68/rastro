package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"rastro/backend/services"
)

type ShareHandler struct {
	shareSvc *services.ShareService
}

func NewShareHandler(shareSvc *services.ShareService) *ShareHandler {
	return &ShareHandler{shareSvc: shareSvc}
}

// POST /api/v1/devices/:id/share
func (h *ShareHandler) Create(c *gin.Context) {
	userID, ok := c.MustGet("user_id").(uuid.UUID)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid user context"})
		return
	}

	deviceID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid device id"})
		return
	}

	var body struct {
		Hours int `json:"hours" binding:"required,min=1,max=720"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	link, err := h.shareSvc.Create(c.Request.Context(), deviceID, userID, body.Hours)
	if err != nil {
		if err == services.ErrForbidden {
			c.JSON(http.StatusForbidden, gin.H{"error": "only the device owner can create share links"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create share link"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"share_link": link})
}

// GET /api/v1/devices/:id/share
func (h *ShareHandler) List(c *gin.Context) {
	deviceID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid device id"})
		return
	}

	links, err := h.shareSvc.List(c.Request.Context(), deviceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list share links"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"share_links": links})
}

// DELETE /api/v1/share/:token
func (h *ShareHandler) Revoke(c *gin.Context) {
	userID, ok := c.MustGet("user_id").(uuid.UUID)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid user context"})
		return
	}

	token, err := uuid.Parse(c.Param("token"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid token"})
		return
	}

	if err := h.shareSvc.Revoke(c.Request.Context(), token, userID); err != nil {
		if err == services.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "share link not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to revoke share link"})
		return
	}

	c.Status(http.StatusNoContent)
}

// GET /api/v1/share/:token  (no auth required)
func (h *ShareHandler) Public(c *gin.Context) {
	token, err := uuid.Parse(c.Param("token"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid token"})
		return
	}

	device, loc, err := h.shareSvc.GetByToken(c.Request.Context(), token)
	if err != nil {
		if err == services.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "share link not found or expired"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch location"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"device":   gin.H{"id": device.ID, "name": device.Name},
		"location": loc,
	})
}
