package handlers

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"rastro/backend/services"
)

type PermissionHandler struct {
	permissionSvc *services.PermissionService
}

func NewPermissionHandler(permissionSvc *services.PermissionService) *PermissionHandler {
	return &PermissionHandler{permissionSvc: permissionSvc}
}

// GET /api/v1/devices/:id/permissions
func (h *PermissionHandler) List(c *gin.Context) {
	ownerID := mustUserID(c)
	deviceID, ok := parseDeviceID(c)
	if !ok {
		return
	}

	entries, err := h.permissionSvc.List(c.Request.Context(), ownerID, deviceID)
	if err != nil {
		if errors.Is(err, services.ErrForbidden) {
			c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list permissions"})
		return
	}
	if entries == nil {
		entries = []services.PermissionEntry{}
	}
	c.JSON(http.StatusOK, gin.H{"permissions": entries})
}

// POST /api/v1/devices/:id/permissions
func (h *PermissionHandler) Grant(c *gin.Context) {
	ownerID := mustUserID(c)
	deviceID, ok := parseDeviceID(c)
	if !ok {
		return
	}

	var req struct {
		Email      string `json:"email"      binding:"required,email"`
		Permission string `json:"permission" binding:"required,oneof=view admin"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	entry, err := h.permissionSvc.Grant(c.Request.Context(), ownerID, deviceID, req.Email, req.Permission)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrForbidden):
			c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
		case errors.Is(err, services.ErrNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "device not found"})
		case errors.Is(err, services.ErrUserNotFound):
			c.JSON(http.StatusBadRequest, gin.H{
				"error": fmt.Sprintf("user with email %q not found — they must create an account first", req.Email),
			})
		case errors.Is(err, services.ErrSelfGrant):
			c.JSON(http.StatusBadRequest, gin.H{"error": "cannot grant permission to yourself"})
		case errors.Is(err, services.ErrInvalidPermission):
			c.JSON(http.StatusBadRequest, gin.H{"error": "permission must be 'view' or 'admin'"})
		default:
			// Never surface driver/query internals to the client.
			log.Error().Err(err).
				Str("device_id", deviceID.String()).
				Msg("grant permission failed")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to grant permission"})
		}
		return
	}

	c.JSON(http.StatusCreated, entry)
}

// DELETE /api/v1/devices/:id/permissions/:user_id
func (h *PermissionHandler) Revoke(c *gin.Context) {
	ownerID := mustUserID(c)
	deviceID, ok := parseDeviceID(c)
	if !ok {
		return
	}

	targetUserID, err := uuid.Parse(c.Param("user_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user_id"})
		return
	}

	if err := h.permissionSvc.Revoke(c.Request.Context(), ownerID, deviceID, targetUserID); err != nil {
		if errors.Is(err, services.ErrForbidden) {
			c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
			return
		}
		if errors.Is(err, services.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "permission not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to revoke permission"})
		return
	}

	c.Status(http.StatusNoContent)
}
