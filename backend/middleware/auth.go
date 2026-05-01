package middleware

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"encoding/base64"
	"encoding/json"
	"errors"
	"math/big"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

type jwkKey struct {
	Alg string `json:"alg"`
	Crv string `json:"crv"`
	X   string `json:"x"`
	Y   string `json:"y"`
}

type jwksDoc struct {
	Keys []jwkKey `json:"keys"`
}

// fetchECKey busca a chave pública ES256 do endpoint JWKS do Supabase.
func fetchECKey(supabaseURL string) *ecdsa.PublicKey {
	url := strings.TrimRight(supabaseURL, "/") + "/auth/v1/.well-known/jwks.json"
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		log.Warn().Err(err).Msg("could not fetch JWKS (ES256 validation disabled)")
		return nil
	}
	defer resp.Body.Close()

	var doc jwksDoc
	if err := json.NewDecoder(resp.Body).Decode(&doc); err != nil {
		log.Warn().Err(err).Msg("could not parse JWKS")
		return nil
	}

	for _, k := range doc.Keys {
		if k.Alg == "ES256" && k.Crv == "P-256" {
			xBytes, err1 := base64.RawURLEncoding.DecodeString(k.X)
			yBytes, err2 := base64.RawURLEncoding.DecodeString(k.Y)
			if err1 != nil || err2 != nil {
				continue
			}
			log.Info().Msg("ES256 public key loaded from JWKS")
			return &ecdsa.PublicKey{
				Curve: elliptic.P256(),
				X:     new(big.Int).SetBytes(xBytes),
				Y:     new(big.Int).SetBytes(yBytes),
			}
		}
	}
	log.Warn().Msg("no ES256 key found in JWKS")
	return nil
}

// JWTAuth valida tokens Supabase HS256 ou ES256 e injeta user_id no contexto.
func JWTAuth(jwtSecret, supabaseURL string) gin.HandlerFunc {
	secret := []byte(jwtSecret)
	ecKey := fetchECKey(supabaseURL)

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
				if ecKey == nil {
					return nil, errors.New("ES256 key not available")
				}
				return ecKey, nil
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
