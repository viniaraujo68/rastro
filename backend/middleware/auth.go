package middleware

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

type jwkKey struct {
	Kid string `json:"kid"`
	Alg string `json:"alg"`
	Crv string `json:"crv"`
	X   string `json:"x"`
	Y   string `json:"y"`
}

type jwksDoc struct {
	Keys []jwkKey `json:"keys"`
}

const (
	// jwksTTL is how long a fetched JWKS document is considered fresh.
	jwksTTL = 15 * time.Minute
	// jwksMinRetry throttles refetches so a dead JWKS endpoint (or tokens
	// carrying bogus kids) cannot trigger one upstream call per request.
	jwksMinRetry = 30 * time.Second
)

// jwksCache holds the ES256 public keys published by Supabase, refreshing them
// lazily when they go stale or when a token presents an unknown kid. A failed
// refresh never clears what is already cached: the last known keys keep being
// served so a transient JWKS outage does not break logins.
type jwksCache struct {
	url    string
	client *http.Client

	mu        sync.RWMutex
	keys      map[string]*ecdsa.PublicKey // kid -> key
	latest    *ecdsa.PublicKey            // fallback for tokens without a kid
	fetchedAt time.Time                   // last successful fetch
	attemptAt time.Time                   // last fetch attempt (success or not)

	refreshMu sync.Mutex // serializes refreshes (single-flight)
}

func newJWKSCache(supabaseURL string) *jwksCache {
	return &jwksCache{
		url:    strings.TrimRight(supabaseURL, "/") + "/auth/v1/.well-known/jwks.json",
		client: &http.Client{Timeout: 5 * time.Second},
		keys:   map[string]*ecdsa.PublicKey{},
	}
}

// key returns the public key for kid, refreshing the cache when it is stale or
// the kid is unknown. It returns an error only when no key is available at all.
func (c *jwksCache) key(kid string) (*ecdsa.PublicKey, error) {
	if k, ok := c.lookup(kid); ok {
		return k, nil
	}

	c.refresh()

	if k, ok := c.lookup(kid); ok {
		return k, nil
	}

	// Unknown kid (or refresh failed): fall back to the last known key. A
	// mismatch simply fails signature verification, which is the safe outcome.
	c.mu.RLock()
	defer c.mu.RUnlock()
	if c.latest != nil {
		return c.latest, nil
	}
	return nil, errors.New("ES256 key not available")
}

// lookup returns the cached key for kid if the cache is fresh and holds it.
func (c *jwksCache) lookup(kid string) (*ecdsa.PublicKey, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if time.Since(c.fetchedAt) > jwksTTL {
		return nil, false
	}
	if kid == "" {
		return c.latest, c.latest != nil
	}
	k, ok := c.keys[kid]
	return k, ok
}

// refresh fetches the JWKS document and replaces the cached keys on success.
// Errors are logged and swallowed — the previous keys stay in place.
func (c *jwksCache) refresh() {
	c.refreshMu.Lock()
	defer c.refreshMu.Unlock()

	c.mu.RLock()
	attemptedAt := c.attemptAt
	c.mu.RUnlock()
	if !attemptedAt.IsZero() && time.Since(attemptedAt) < jwksMinRetry {
		return // another goroutine just tried; don't hammer the endpoint
	}

	c.mu.Lock()
	c.attemptAt = time.Now()
	c.mu.Unlock()

	keys, latest, err := c.fetch()
	if err != nil {
		log.Warn().Err(err).Msg("could not refresh JWKS (keeping last known keys)")
		return
	}
	if latest == nil {
		log.Warn().Msg("no ES256 key found in JWKS (keeping last known keys)")
		return
	}

	c.mu.Lock()
	c.keys = keys
	c.latest = latest
	c.fetchedAt = time.Now()
	c.mu.Unlock()
	log.Info().Int("keys", len(keys)).Msg("ES256 public keys loaded from JWKS")
}

// fetch downloads and parses the JWKS document into ES256 public keys.
func (c *jwksCache) fetch() (map[string]*ecdsa.PublicKey, *ecdsa.PublicKey, error) {
	resp, err := c.client.Get(c.url)
	if err != nil {
		return nil, nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, nil, fmt.Errorf("JWKS endpoint returned status %d", resp.StatusCode)
	}

	var doc jwksDoc
	if err := json.NewDecoder(resp.Body).Decode(&doc); err != nil {
		return nil, nil, fmt.Errorf("parse JWKS: %w", err)
	}

	keys := make(map[string]*ecdsa.PublicKey, len(doc.Keys))
	var latest *ecdsa.PublicKey
	for _, k := range doc.Keys {
		if k.Alg != "ES256" || k.Crv != "P-256" {
			continue
		}
		xBytes, err1 := base64.RawURLEncoding.DecodeString(k.X)
		yBytes, err2 := base64.RawURLEncoding.DecodeString(k.Y)
		if err1 != nil || err2 != nil {
			continue
		}
		pub := &ecdsa.PublicKey{
			Curve: elliptic.P256(),
			X:     new(big.Int).SetBytes(xBytes),
			Y:     new(big.Int).SetBytes(yBytes),
		}
		if k.Kid != "" {
			keys[k.Kid] = pub
		}
		if latest == nil {
			latest = pub
		}
	}
	return keys, latest, nil
}

// JWTAuth valida tokens Supabase HS256 ou ES256 e injeta user_id no contexto.
func JWTAuth(jwtSecret, supabaseURL string) gin.HandlerFunc {
	secret := []byte(jwtSecret)
	jwks := newJWKSCache(supabaseURL)
	jwks.refresh() // best effort at boot; retried lazily if it fails

	return func(c *gin.Context) {
		tokenStr, err := extractBearer(c.GetHeader("Authorization"))
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
			return
		}

		token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (any, error) {
			switch t.Method.(type) {
			case *jwt.SigningMethodHMAC:
				return secret, nil
			case *jwt.SigningMethodECDSA:
				kid, _ := t.Header["kid"].(string)
				return jwks.key(kid)
			default:
				return nil, errors.New("unexpected signing method")
			}
		}, jwt.WithValidMethods([]string{"HS256", "ES256"}))

		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "malformed token claims"})
			return
		}

		sub, _ := claims["sub"].(string)
		userID, err := uuid.Parse(sub)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid user id in token"})
			return
		}

		c.Set("user_id", userID)
		c.Next()
	}
}

func extractBearer(header string) (string, error) {
	if header == "" {
		return "", errors.New("missing Authorization header")
	}
	parts := strings.SplitN(header, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return "", errors.New("authorization header must be 'Bearer <token>'")
	}
	return parts[1], nil
}
