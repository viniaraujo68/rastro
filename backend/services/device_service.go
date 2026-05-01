package services

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"rastro/backend/models"
)

var ErrNotFound = errors.New("not found")
var ErrForbidden = errors.New("forbidden")

type DeviceService struct {
	db *pgxpool.Pool
}

func NewDeviceService(db *pgxpool.Pool) *DeviceService {
	return &DeviceService{db: db}
}

// Get fetches a device by ID without permission check.
func (s *DeviceService) Get(ctx context.Context, deviceID uuid.UUID) (*models.Device, error) {
	const q = `
		SELECT id, owner_id, name, is_active, created_at, updated_at
		FROM devices WHERE id = $1`

	var d models.Device
	err := s.db.QueryRow(ctx, q, deviceID).
		Scan(&d.ID, &d.OwnerID, &d.Name, &d.IsActive, &d.CreatedAt, &d.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("get device: %w", err)
	}
	return &d, nil
}

// HasAccess returns true if userID is the owner of deviceID or has an entry in device_permissions.
func (s *DeviceService) HasAccess(ctx context.Context, userID, deviceID uuid.UUID) (bool, error) {
	const q = `
		SELECT EXISTS(
			SELECT 1 FROM devices WHERE id = $1 AND owner_id = $2
			UNION ALL
			SELECT 1 FROM device_permissions WHERE device_id = $1 AND user_id = $2
		)`

	var ok bool
	err := s.db.QueryRow(ctx, q, deviceID, userID).Scan(&ok)
	if err != nil {
		return false, fmt.Errorf("check access: %w", err)
	}
	return ok, nil
}

// List returns all devices the user owns plus devices they have explicit permission to see.
func (s *DeviceService) List(ctx context.Context, userID uuid.UUID) ([]models.Device, error) {
	const q = `
		SELECT DISTINCT d.id, d.owner_id, d.name, d.is_active, d.created_at, d.updated_at
		FROM devices d
		LEFT JOIN device_permissions dp ON dp.device_id = d.id AND dp.user_id = $1
		WHERE d.owner_id = $1 OR dp.user_id = $1
		ORDER BY d.created_at DESC`

	rows, err := s.db.Query(ctx, q, userID)
	if err != nil {
		return nil, fmt.Errorf("list devices: %w", err)
	}
	defer rows.Close()

	var devices []models.Device
	for rows.Next() {
		var d models.Device
		if err := rows.Scan(&d.ID, &d.OwnerID, &d.Name, &d.IsActive, &d.CreatedAt, &d.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan device: %w", err)
		}
		devices = append(devices, d)
	}
	return devices, rows.Err()
}

// Create inserts a new device with a freshly generated API key and returns the full record (including key).
func (s *DeviceService) Create(ctx context.Context, ownerID uuid.UUID, name string) (*models.Device, error) {
	apiKey, err := generateAPIKey()
	if err != nil {
		return nil, fmt.Errorf("generate api key: %w", err)
	}

	const q = `
		INSERT INTO devices (owner_id, name, api_key)
		VALUES ($1, $2, $3)
		RETURNING id, owner_id, name, api_key, is_active, created_at, updated_at`

	var d models.Device
	err = s.db.QueryRow(ctx, q, ownerID, name, apiKey).
		Scan(&d.ID, &d.OwnerID, &d.Name, &d.APIKey, &d.IsActive, &d.CreatedAt, &d.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("create device: %w", err)
	}
	return &d, nil
}

// Update edits name and/or is_active. Only the owner may call this.
func (s *DeviceService) Update(ctx context.Context, ownerID, deviceID uuid.UUID, name string, isActive bool) (*models.Device, error) {
	const q = `
		UPDATE devices
		SET name = $1, is_active = $2, updated_at = now()
		WHERE id = $3 AND owner_id = $4
		RETURNING id, owner_id, name, is_active, created_at, updated_at`

	var d models.Device
	err := s.db.QueryRow(ctx, q, name, isActive, deviceID, ownerID).
		Scan(&d.ID, &d.OwnerID, &d.Name, &d.IsActive, &d.CreatedAt, &d.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("update device: %w", err)
	}
	return &d, nil
}

// Delete removes a device (and all its locations via CASCADE). Only the owner may call this.
func (s *DeviceService) Delete(ctx context.Context, ownerID, deviceID uuid.UUID) error {
	const q = `DELETE FROM devices WHERE id = $1 AND owner_id = $2`

	tag, err := s.db.Exec(ctx, q, deviceID, ownerID)
	if err != nil {
		return fmt.Errorf("delete device: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// RotateKey generates a new API key for the device. Only the owner may call this.
func (s *DeviceService) RotateKey(ctx context.Context, ownerID, deviceID uuid.UUID) (string, error) {
	newKey, err := generateAPIKey()
	if err != nil {
		return "", fmt.Errorf("generate api key: %w", err)
	}

	const q = `
		UPDATE devices SET api_key = $1, updated_at = now()
		WHERE id = $2 AND owner_id = $3`

	tag, err := s.db.Exec(ctx, q, newKey, deviceID, ownerID)
	if err != nil {
		return "", fmt.Errorf("rotate key: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return "", ErrNotFound
	}
	return newKey, nil
}

func generateAPIKey() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return "rk_" + hex.EncodeToString(b), nil
}

// lastLocation returns the most recent timestamp for a device (used by the handler for display).
func (s *DeviceService) LastSeen(ctx context.Context, deviceID uuid.UUID) (*time.Time, error) {
	const q = `SELECT timestamp FROM locations WHERE device_id = $1 ORDER BY timestamp DESC LIMIT 1`
	var t time.Time
	err := s.db.QueryRow(ctx, q, deviceID).Scan(&t)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("last seen: %w", err)
	}
	return &t, nil
}
