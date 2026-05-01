package models

import (
	"time"

	"github.com/google/uuid"
)

type Device struct {
	ID        uuid.UUID `json:"id"`
	OwnerID   uuid.UUID `json:"owner_id"`
	Name      string    `json:"name"`
	APIKey    string    `json:"-"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Location struct {
	ID           int64     `json:"id"`
	DeviceID     uuid.UUID `json:"device_id"`
	Latitude     float64   `json:"latitude"`
	Longitude    float64   `json:"longitude"`
	Address      *string   `json:"address,omitempty"`
	Accuracy     *float64  `json:"accuracy,omitempty"`
	Altitude     *float64  `json:"altitude,omitempty"`
	Speed        *float64  `json:"speed,omitempty"`
	BatteryLevel *int      `json:"battery_level,omitempty"`
	Timestamp    time.Time `json:"timestamp"`
	CreatedAt    time.Time `json:"created_at"`
}

type ShareLink struct {
	ID        uuid.UUID `json:"id"`
	DeviceID  uuid.UUID `json:"device_id"`
	CreatedBy uuid.UUID `json:"created_by"`
	ExpiresAt time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}

type DevicePermission struct {
	ID         uuid.UUID `json:"id"`
	DeviceID   uuid.UUID `json:"device_id"`
	UserID     uuid.UUID `json:"user_id"`
	Permission string    `json:"permission"`
	GrantedBy  uuid.UUID `json:"granted_by"`
	GrantedAt  time.Time `json:"granted_at"`
}
