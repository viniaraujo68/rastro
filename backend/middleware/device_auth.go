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
	"rastro/backend/services"
)

// Per-device: burst of 10 absorbs buffered points replayed after a
// connectivity gap; sustained rate stays at 1 request / 10s.
const (
	deviceBurst      = 10
	deviceRefillEach = 10 * time.Second
)

// Per-IP, applied before the key lookup so invalid keys can't drive
// unbounded DB queries: burst 30, sustained 1 request / 2s.
const (
	ipBurst      = 30
	ipRefillEach = 2 * time.Second
)

type bucket struct {
	tokens float64
	last   time.Time
}

// tokenBucketLimiter is a simple in-memory token bucket per key.
type tokenBucketLimiter struct {
	mu         sync.Mutex
	buckets    map[string]*bucket
	capacity   float64
	refillEach time.Duration
}

func newTokenBucketLimiter(capacity int, refillEach time.Duration) *tokenBucketLimiter {
	l := &tokenBucketLimiter{
		buckets:    make(map[string]*bucket),
		capacity:   float64(capacity),
		refillEach: refillEach,
	}
	// periodic cleanup to avoid unbounded growth
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		for range ticker.C {
			l.mu.Lock()
			cutoff := time.Now().Add(-10 * time.Minute)
			for id, b := range l.buckets {
				if b.last.Before(cutoff) {
					delete(l.buckets, id)
				}
			}
			l.mu.Unlock()
		}
	}()
	return l
}

// allow returns true if the key may proceed, consuming one token.
func (l *tokenBucketLimiter) allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	b, ok := l.buckets[key]
	if !ok {
		b = &bucket{tokens: l.capacity, last: now}
		l.buckets[key] = b
	}
	b.tokens = min(l.capacity, b.tokens+now.Sub(b.last).Seconds()/l.refillEach.Seconds())
	b.last = now
	if b.tokens < 1 {
		return false
	}
	b.tokens--
	return true
}

var (
	deviceLimiter = newTokenBucketLimiter(deviceBurst, deviceRefillEach)
	ipLimiter     = newTokenBucketLimiter(ipBurst, ipRefillEach)
)

// DeviceAuth validates the X-Device-Key header, loads the device from the DB,
// enforces rate limiting, and injects device_id into the Gin context.
func DeviceAuth(db *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !ipLimiter.allow(c.ClientIP()) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error":       "rate limit exceeded",
				"retry_after": ipRefillEach.Seconds(),
			})
			return
		}

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

		if !deviceLimiter.allow(device.ID.String()) {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error":       "rate limit exceeded",
				"retry_after": deviceRefillEach.Seconds(),
			})
			return
		}

		c.Set("device_id", device.ID)
		c.Next()
	}
}

func fetchDeviceByAPIKey(ctx context.Context, db *pgxpool.Pool, apiKey string) (*models.Device, error) {
	// keys are stored as SHA-256 hex digests; hash the presented key to match
	const q = `
		SELECT id, owner_id, name, is_active, created_at, updated_at
		FROM devices
		WHERE api_key = $1
		LIMIT 1`

	row := db.QueryRow(ctx, q, services.HashAPIKey(apiKey))
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
