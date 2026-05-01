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
	r.Use(gin.Recovery())
	r.Use(zerlogMiddleware())
	r.Use(corsMiddleware(cfg.CORSOrigins))

	locationSvc := services.NewLocationService(pool)
	deviceSvc := services.NewDeviceService(pool)
	permissionSvc := services.NewPermissionService(pool)
	shareSvc := services.NewShareService(pool, locationSvc, deviceSvc)
	healthHandler := handlers.NewHealthHandler(pool)
	locationHandler := handlers.NewLocationHandler(locationSvc, deviceSvc)
	deviceHandler := handlers.NewDeviceHandler(deviceSvc)
	permissionHandler := handlers.NewPermissionHandler(permissionSvc)
	shareHandler := handlers.NewShareHandler(shareSvc)

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
		userGroup.POST("/devices/:id/share", shareHandler.Create)
		userGroup.GET("/devices/:id/share", shareHandler.List)
		userGroup.DELETE("/share/:token", shareHandler.Revoke)

		// Public share endpoint (no auth, token is the secret)
		v1.GET("/share/:token", shareHandler.Public)
	}

	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: r,
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

func zerlogMiddleware() gin.HandlerFunc {
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
