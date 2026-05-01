package config

import (
	"fmt"
	"os"
	"strings"
)

type Config struct {
	Port              string
	DatabaseURL       string
	SupabaseURL       string
	SupabaseServiceKey string
	SupabaseJWTSecret string
	CORSOrigins       []string
}

func Load() (*Config, error) {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}

	supabaseURL := os.Getenv("SUPABASE_URL")
	if supabaseURL == "" {
		return nil, fmt.Errorf("SUPABASE_URL is required")
	}

	supabaseServiceKey := os.Getenv("SUPABASE_SERVICE_KEY")
	if supabaseServiceKey == "" {
		return nil, fmt.Errorf("SUPABASE_SERVICE_KEY is required")
	}

	supabaseJWTSecret := os.Getenv("SUPABASE_JWT_SECRET")
	if supabaseJWTSecret == "" {
		return nil, fmt.Errorf("SUPABASE_JWT_SECRET is required")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	corsRaw := os.Getenv("CORS_ORIGINS")
	var corsOrigins []string
	if corsRaw != "" {
		for _, o := range strings.Split(corsRaw, ",") {
			if trimmed := strings.TrimSpace(o); trimmed != "" {
				corsOrigins = append(corsOrigins, trimmed)
			}
		}
	}
	if len(corsOrigins) == 0 {
		corsOrigins = []string{"http://localhost:5173"}
	}

	return &Config{
		Port:              port,
		DatabaseURL:       databaseURL,
		SupabaseURL:       supabaseURL,
		SupabaseServiceKey: supabaseServiceKey,
		SupabaseJWTSecret: supabaseJWTSecret,
		CORSOrigins:       corsOrigins,
	}, nil
}
