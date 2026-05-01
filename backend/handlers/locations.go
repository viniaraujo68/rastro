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
	Latitude     string  `json:"latitude"      binding:"required"`
	Longitude    string  `json:"longitude"     binding:"required"`
	Address      *string `json:"address"`
	Altitude     string  `json:"altitude"`
	BatteryLevel string  `json:"battery_level"`
	Timestamp    string  `json:"timestamp"     binding:"required"`
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

	lat, err := strconv.ParseFloat(req.Latitude, 64)
	if err != nil || lat < -90 || lat > 90 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "latitude must be a number between -90 and 90"})
		return
	}
	lng, err := strconv.ParseFloat(req.Longitude, 64)
	if err != nil || lng < -180 || lng > 180 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "longitude must be a number between -180 and 180"})
		return
	}

	var altitude *float64
	if req.Altitude != "" {
		v, err := strconv.ParseFloat(req.Altitude, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "altitude must be a number"})
			return
		}
		altitude = &v
	}

	var batteryLevel *int
	if req.BatteryLevel != "" {
		v, err := strconv.Atoi(req.BatteryLevel)
		if err != nil || v < 0 || v > 100 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "battery_level must be an integer between 0 and 100"})
			return
		}
		batteryLevel = &v
	}

	ts, err := time.Parse(time.RFC3339, req.Timestamp)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "timestamp must be RFC3339 (ISO8601)"})
		return
	}

	loc := &models.Location{
		DeviceID:     deviceID,
		Latitude:     lat,
		Longitude:    lng,
		Address:      req.Address,
		Altitude:     altitude,
		BatteryLevel: batteryLevel,
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
