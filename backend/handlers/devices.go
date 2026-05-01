package handlers

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"rastro/backend/models"
	"rastro/backend/services"
)

type DeviceHandler struct {
	deviceSvc *services.DeviceService
}

func NewDeviceHandler(deviceSvc *services.DeviceService) *DeviceHandler {
	return &DeviceHandler{deviceSvc: deviceSvc}
}

// GET /api/v1/devices
func (h *DeviceHandler) List(c *gin.Context) {
	userID := mustUserID(c)

	devices, err := h.deviceSvc.List(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list devices"})
		return
	}
	if devices == nil {
		devices = []models.Device{}
	}
	c.JSON(http.StatusOK, gin.H{"devices": devices})
}

// POST /api/v1/devices
func (h *DeviceHandler) Create(c *gin.Context) {
	userID := mustUserID(c)

	var req struct {
		Name string `json:"name" binding:"required,min=1,max=100"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	device, err := h.deviceSvc.Create(c.Request.Context(), userID, req.Name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create device"})
		return
	}

	// APIKey is included only on creation
	c.JSON(http.StatusCreated, gin.H{
		"id":         device.ID,
		"owner_id":   device.OwnerID,
		"name":       device.Name,
		"api_key":    device.APIKey,
		"is_active":  device.IsActive,
		"created_at": device.CreatedAt,
		"updated_at": device.UpdatedAt,
	})
}

// PUT /api/v1/devices/:id
func (h *DeviceHandler) Update(c *gin.Context) {
	userID := mustUserID(c)
	deviceID, ok := parseDeviceID(c)
	if !ok {
		return
	}

	var req struct {
		Name     string `json:"name"      binding:"required,min=1,max=100"`
		IsActive *bool  `json:"is_active" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	device, err := h.deviceSvc.Update(c.Request.Context(), userID, deviceID, req.Name, *req.IsActive)
	if err != nil {
		if errors.Is(err, services.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "device not found or access denied"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update device"})
		return
	}

	c.JSON(http.StatusOK, device)
}

// DELETE /api/v1/devices/:id
func (h *DeviceHandler) Delete(c *gin.Context) {
	userID := mustUserID(c)
	deviceID, ok := parseDeviceID(c)
	if !ok {
		return
	}

	if err := h.deviceSvc.Delete(c.Request.Context(), userID, deviceID); err != nil {
		if errors.Is(err, services.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "device not found or access denied"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete device"})
		return
	}

	c.Status(http.StatusNoContent)
}

// POST /api/v1/devices/:id/rotate-key
func (h *DeviceHandler) RotateKey(c *gin.Context) {
	userID := mustUserID(c)
	deviceID, ok := parseDeviceID(c)
	if !ok {
		return
	}

	newKey, err := h.deviceSvc.RotateKey(c.Request.Context(), userID, deviceID)
	if err != nil {
		if errors.Is(err, services.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "device not found or access denied"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to rotate key"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"device_id": deviceID,
		"api_key":   newKey,
	})
}

func mustUserID(c *gin.Context) uuid.UUID {
	return c.MustGet("user_id").(uuid.UUID)
}

func parseDeviceID(c *gin.Context) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid device id"})
		return uuid.UUID{}, false
	}
	return id, true
}
