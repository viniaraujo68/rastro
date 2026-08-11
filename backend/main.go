package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"rastro/backend/config"
	"rastro/backend/db"
	"rastro/backend/handlers"
	"rastro/backend/middleware"
	"rastro/backend/services"
)

func main() {
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr, TimeFormat: time.RFC3339})
	zerolog.SetGlobalLevel(zerolog.DebugLevel)

	_ = godotenv.Load()

	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("failed to load config")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	pool, err := db.NewPool(ctx, cfg.DatabaseURL)
	cancel()
	if err != nil {
		log.Fatal().Err(err).Msg("failed to connect to database")
	}
	defer pool.Close()
	log.Info().Msg("database connected")

	if os.Getenv("GIN_MODE") == "" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	// The app runs behind a dockerized nginx on a private network: only honor
	// X-Forwarded-For / X-Real-IP when the immediate peer is a private proxy.
	if err := r.SetTrustedProxies([]string{"10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"}); err != nil {
		log.Fatal().Err(err).Msg("failed to set trusted proxies")
	}
	r.Use(gin.Recovery())
	r.Use(zerologMiddleware())
	r.Use(corsMiddleware(cfg.CORSOrigins))

	locationSvc := services.NewLocationService(pool)
	deviceSvc := services.NewDeviceService(pool)
	permissionSvc := services.NewPermissionService(pool)
	healthHandler := handlers.NewHealthHandler(pool)
	locationHandler := handlers.NewLocationHandler(locationSvc, deviceSvc)
	deviceHandler := handlers.NewDeviceHandler(deviceSvc)
	permissionHandler := handlers.NewPermissionHandler(permissionSvc)

	v1 := r.Group("/api/v1")
	{
		v1.GET("/health", healthHandler.Health)

		// device-authenticated routes (API Key)
		deviceKeyGroup := v1.Group("/")
		deviceKeyGroup.Use(middleware.DeviceAuth(pool))
		deviceKeyGroup.POST("/location", locationHandler.Ingest)

		// user-authenticated routes (JWT)
		userGroup := v1.Group("/")
		userGroup.Use(middleware.JWTAuth(cfg.SupabaseJWTSecret, cfg.SupabaseURL))
		userGroup.GET("/locations", locationHandler.List)
		userGroup.GET("/locations/latest", locationHandler.Latest)
		userGroup.GET("/devices", deviceHandler.List)
		userGroup.POST("/devices", deviceHandler.Create)
		userGroup.PUT("/devices/:id", deviceHandler.Update)
		userGroup.DELETE("/devices/:id", deviceHandler.Delete)
		userGroup.POST("/devices/:id/rotate-key", deviceHandler.RotateKey)
		userGroup.GET("/devices/:id/permissions", permissionHandler.List)
		userGroup.POST("/devices/:id/permissions", permissionHandler.Grant)
		userGroup.DELETE("/devices/:id/permissions/:user_id", permissionHandler.Revoke)
	}

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           r,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	go func() {
		log.Info().Str("port", cfg.Port).Msg("server started")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("server error")
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info().Msg("shutting down...")
	ctx, cancel = context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Error().Err(err).Msg("shutdown error")
	}
	log.Info().Msg("server stopped")
}

func zerologMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		log.Info().
			Str("method", c.Request.Method).
			Str("path", c.Request.URL.Path).
			Int("status", c.Writer.Status()).
			Dur("latency", time.Since(start)).
			Str("ip", c.ClientIP()).
			Msg("request")
	}
}

func corsMiddleware(origins []string) gin.HandlerFunc {
	allowed := make(map[string]struct{}, len(origins))
	for _, o := range origins {
		allowed[o] = struct{}{}
	}

	return func(c *gin.Context) {
		// Always vary on Origin: the response differs per origin, so shared
		// caches must not serve one origin's response to another.
		c.Writer.Header().Add("Vary", "Origin")

		origin := c.Request.Header.Get("Origin")
		if _, ok := allowed[origin]; ok {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Access-Control-Allow-Credentials", "true")
			c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Device-Key")
			c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		}
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}
