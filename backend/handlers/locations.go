package handlers

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

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
		log.Warn().Err(err).Str("device_id", deviceID.String()).Msg("ingest: bind failed")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	log.Debug().
		Str("device_id", deviceID.String()).
		Str("latitude", req.Latitude).
		Str("longitude", req.Longitude).
		Str("altitude", req.Altitude).
		Str("battery_level", req.BatteryLevel).
		Str("timestamp", req.Timestamp).
		Msg("ingest: received")

	lat, err := strconv.ParseFloat(normalizeDecimal(req.Latitude), 64)
	if err != nil || lat < -90 || lat > 90 {
		log.Warn().Str("value", req.Latitude).Msg("ingest: invalid latitude")
		c.JSON(http.StatusBadRequest, gin.H{"error": "latitude must be a number between -90 and 90"})
		return
	}
	lng, err := strconv.ParseFloat(normalizeDecimal(req.Longitude), 64)
	if err != nil || lng < -180 || lng > 180 {
		log.Warn().Str("value", req.Longitude).Msg("ingest: invalid longitude")
		c.JSON(http.StatusBadRequest, gin.H{"error": "longitude must be a number between -180 and 180"})
		return
	}

	var altitude *float64
	if req.Altitude != "" {
		v, err := strconv.ParseFloat(normalizeDecimal(req.Altitude), 64)
		if err != nil {
			log.Warn().Str("value", req.Altitude).Msg("ingest: invalid altitude")
			c.JSON(http.StatusBadRequest, gin.H{"error": "altitude must be a number"})
			return
		}
		altitude = &v
	}

	var batteryLevel *int
	if req.BatteryLevel != "" {
		f, err := strconv.ParseFloat(normalizeDecimal(req.BatteryLevel), 64)
		v := int(f)
		if err != nil || v < 0 || v > 100 {
			log.Warn().Str("value", req.BatteryLevel).Msg("ingest: invalid battery_level")
			c.JSON(http.StatusBadRequest, gin.H{"error": "battery_level must be an integer between 0 and 100"})
			return
		}
		batteryLevel = &v
	}

	ts, err := time.Parse(time.RFC3339, req.Timestamp)
	if err != nil {
		log.Warn().Str("value", req.Timestamp).Msg("ingest: invalid timestamp")
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

// normalizeDecimal replaces comma decimal separators with periods (iOS locale issue).
func normalizeDecimal(s string) string {
	return strings.ReplaceAll(s, ",", ".")
}
