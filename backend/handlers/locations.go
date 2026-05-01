package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"rastro/backend/models"
	"rastro/backend/services"
)

type LocationHandler struct {
	locationSvc *services.LocationService
	deviceSvc   *services.DeviceService
}

func NewLocationHandler(locationSvc *services.LocationService, deviceSvc *services.DeviceService) *LocationHandler {
	return &LocationHandler{locationSvc: locationSvc, deviceSvc: deviceSvc}
}

// --- POST /api/v1/location ---

type ingestLocationRequest struct {
	Latitude     float64  `json:"latitude"      binding:"required,min=-90,max=90"`
	Longitude    float64  `json:"longitude"     binding:"required,min=-180,max=180"`
	Address      *string  `json:"address"`
	Accuracy     *float64 `json:"accuracy"      binding:"omitempty,min=0"`
	Altitude     *float64 `json:"altitude"`
	Speed        *float64 `json:"speed"         binding:"omitempty,min=0"`
	BatteryLevel *int     `json:"battery_level" binding:"omitempty,min=0,max=100"`
	Timestamp    string   `json:"timestamp"     binding:"required"`
}

func (h *LocationHandler) Ingest(c *gin.Context) {
	deviceID, ok := c.MustGet("device_id").(uuid.UUID)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid device context"})
		return
	}

	var req ingestLocationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ts, err := time.Parse(time.RFC3339, req.Timestamp)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "timestamp must be RFC3339 (ISO8601)"})
		return
	}

	loc := &models.Location{
		DeviceID:     deviceID,
		Latitude:     req.Latitude,
		Longitude:    req.Longitude,
		Address:      req.Address,
		Accuracy:     req.Accuracy,
		Altitude:     req.Altitude,
		Speed:        req.Speed,
		BatteryLevel: req.BatteryLevel,
		Timestamp:    ts,
	}

	id, err := h.locationSvc.Insert(c.Request.Context(), deviceID, loc)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to store location"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":   "Location stored",
		"id":        id,
		"device_id": deviceID,
		"timestamp": ts,
	})
}

// --- GET /api/v1/locations ---

func (h *LocationHandler) List(c *gin.Context) {
	userID, deviceID, ok := h.resolveAccess(c)
	if !ok {
		return
	}
	_ = userID

	now := time.Now().UTC()
	from := now.Add(-24 * time.Hour)
	to := now
	limit := 1000

	if v := c.Query("from"); v != "" {
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "from must be RFC3339"})
			return
		}
		from = t
	}
	if v := c.Query("to"); v != "" {
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "to must be RFC3339"})
			return
		}
		to = t
	}
	if v := c.Query("limit"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 || n > 10000 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "limit must be an integer between 1 and 10000"})
			return
		}
		limit = n
	}

	device, err := h.deviceSvc.Get(c.Request.Context(), deviceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch device"})
		return
	}

	locations, err := h.locationSvc.List(c.Request.Context(), deviceID, from, to, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch locations"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"device": gin.H{
			"id":   device.ID,
			"name": device.Name,
		},
		"locations": locations,
		"meta": gin.H{
			"count": len(locations),
			"from":  from,
			"to":    to,
		},
	})
}

// --- GET /api/v1/locations/latest ---

func (h *LocationHandler) Latest(c *gin.Context) {
	userID, deviceID, ok := h.resolveAccess(c)
	if !ok {
		return
	}
	_ = userID

	device, err := h.deviceSvc.Get(c.Request.Context(), deviceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch device"})
		return
	}

	loc, err := h.locationSvc.Latest(c.Request.Context(), deviceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch latest location"})
		return
	}
	if loc == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "no locations found for this device"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"device": gin.H{
			"id":   device.ID,
			"name": device.Name,
		},
		"location": loc,
	})
}

// resolveAccess parses device_id from query, validates JWT user access, returns (userID, deviceID, ok).
func (h *LocationHandler) resolveAccess(c *gin.Context) (uuid.UUID, uuid.UUID, bool) {
	userID, ok := c.MustGet("user_id").(uuid.UUID)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid user context"})
		return uuid.UUID{}, uuid.UUID{}, false
	}

	deviceIDStr := c.Query("device_id")
	if deviceIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "device_id is required"})
		return uuid.UUID{}, uuid.UUID{}, false
	}
	deviceID, err := uuid.Parse(deviceIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "device_id must be a valid UUID"})
		return uuid.UUID{}, uuid.UUID{}, false
	}

	hasAccess, err := h.deviceSvc.HasAccess(c.Request.Context(), userID, deviceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check permissions"})
		return uuid.UUID{}, uuid.UUID{}, false
	}
	if !hasAccess {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
		return uuid.UUID{}, uuid.UUID{}, false
	}

	return userID, deviceID, true
}
