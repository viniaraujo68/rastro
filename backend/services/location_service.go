package services

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"rastro/backend/models"
)

type LocationService struct {
	db *pgxpool.Pool
}

func NewLocationService(db *pgxpool.Pool) *LocationService {
	return &LocationService{db: db}
}

func (s *LocationService) Insert(ctx context.Context, deviceID uuid.UUID, loc *models.Location) (int64, error) {
	const q = `
		INSERT INTO locations
			(device_id, latitude, longitude, address, accuracy, altitude, speed, battery_level, timestamp)
		VALUES
			($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id`

	var id int64
	err := s.db.QueryRow(ctx, q,
		deviceID,
		loc.Latitude,
		loc.Longitude,
		loc.Address,
		loc.Accuracy,
		loc.Altitude,
		loc.Speed,
		loc.BatteryLevel,
		loc.Timestamp,
	).Scan(&id)
	if err != nil {
		return 0, fmt.Errorf("insert location: %w", err)
	}
	return id, nil
}

func (s *LocationService) List(ctx context.Context, deviceID uuid.UUID, from, to time.Time, limit int) ([]models.Location, error) {
	const q = `
		SELECT id, device_id, latitude, longitude, address, accuracy, altitude, speed, battery_level, timestamp, created_at
		FROM locations
		WHERE device_id = $1
		  AND timestamp >= $2
		  AND timestamp <= $3
		ORDER BY timestamp ASC
		LIMIT $4`

	rows, err := s.db.Query(ctx, q, deviceID, from, to, limit)
	if err != nil {
		return nil, fmt.Errorf("list locations: %w", err)
	}
	defer rows.Close()

	var locs []models.Location
	for rows.Next() {
		var l models.Location
		if err := rows.Scan(
			&l.ID, &l.DeviceID, &l.Latitude, &l.Longitude,
			&l.Address, &l.Accuracy, &l.Altitude, &l.Speed,
			&l.BatteryLevel, &l.Timestamp, &l.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan location: %w", err)
		}
		locs = append(locs, l)
	}
	return locs, rows.Err()
}

func (s *LocationService) Latest(ctx context.Context, deviceID uuid.UUID) (*models.Location, error) {
	const q = `
		SELECT id, device_id, latitude, longitude, address, accuracy, altitude, speed, battery_level, timestamp, created_at
		FROM locations
		WHERE device_id = $1
		ORDER BY timestamp DESC
		LIMIT 1`

	var l models.Location
	err := s.db.QueryRow(ctx, q, deviceID).Scan(
		&l.ID, &l.DeviceID, &l.Latitude, &l.Longitude,
		&l.Address, &l.Accuracy, &l.Altitude, &l.Speed,
		&l.BatteryLevel, &l.Timestamp, &l.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("latest location: %w", err)
	}
	return &l, nil
}
