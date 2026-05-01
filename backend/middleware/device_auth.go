package middleware

import (
	"context"
	"errors"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"

	"rastro/backend/models"
)

const rateLimitInterval = 10 * time.Second

type rateLimiter struct {
	mu   sync.Mutex
	last map[string]time.Time
}

func newRateLimiter() *rateLimiter {
	rl := &rateLimiter{last: make(map[string]time.Time)}
	// periodic cleanup to avoid unbounded growth
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		for range ticker.C {
			rl.mu.Lock()
			cutoff := time.Now().Add(-rateLimitInterval * 2)
			for id, t := range rl.last {
				if t.Before(cutoff) {
					delete(rl.last, id)
				}
			}
			rl.mu.Unlock()
		}
	}()
	return rl
}

// allow returns true if the device is allowed to proceed (not rate-limited).
func (rl *rateLimiter) allow(deviceID string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	if t, ok := rl.last[deviceID]; ok && time.Since(t) < rateLimitInterval {
		return false
	}
	rl.last[deviceID] = time.Now()
	return true
}

var defaultRateLimiter = newRateLimiter()

// DeviceAuth validates the X-Device-Key header, loads the device from the DB,
// enforces rate limiting, and injects device_id into the Gin context.
func DeviceAuth(db *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		apiKey := c.GetHeader("X-Device-Key")
		if apiKey == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing X-Device-Key header"})
			return
		}

		device, err := fetchDeviceByAPIKey(c.Request.Context(), db, apiKey)
		if err != nil {
			log.Error().Err(err).Msg("device_auth: db error")
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
			return
		}
		if device == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid API key"})
			return
		}
		if !device.IsActive {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "device is inactive"})
			return
		}

		deviceID := device.ID.String()
		if !defaultRateLimiter.allow(deviceID) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error":       "rate limit exceeded",
				"retry_after": rateLimitInterval.Seconds(),
			})
			return
		}

		c.Set("device_id", device.ID)
		c.Next()
	}
}

func fetchDeviceByAPIKey(ctx context.Context, db *pgxpool.Pool, apiKey string) (*models.Device, error) {
	const q = `
		SELECT id, owner_id, name, is_active, created_at, updated_at
		FROM devices
		WHERE api_key = $1
		LIMIT 1`

	row := db.QueryRow(ctx, q, apiKey)
	var d models.Device
	err := row.Scan(&d.ID, &d.OwnerID, &d.Name, &d.IsActive, &d.CreatedAt, &d.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &d, nil
}
