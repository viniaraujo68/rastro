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

type ShareService struct {
	db       *pgxpool.Pool
	locSvc   *LocationService
	devSvc   *DeviceService
}

func NewShareService(db *pgxpool.Pool, locSvc *LocationService, devSvc *DeviceService) *ShareService {
	return &ShareService{db: db, locSvc: locSvc, devSvc: devSvc}
}

func (s *ShareService) Create(ctx context.Context, deviceID, ownerID uuid.UUID, hours int) (*models.ShareLink, error) {
	const checkQ = `SELECT EXISTS(SELECT 1 FROM devices WHERE id = $1 AND owner_id = $2)`
	var isOwner bool
	if err := s.db.QueryRow(ctx, checkQ, deviceID, ownerID).Scan(&isOwner); err != nil {
		return nil, fmt.Errorf("check ownership: %w", err)
	}
	if !isOwner {
		return nil, ErrForbidden
	}

	if hours < 1 || hours > 24*30 {
		return nil, errors.New("hours must be between 1 and 720")
	}

	expiresAt := time.Now().Add(time.Duration(hours) * time.Hour)
	const q = `
		INSERT INTO share_links (device_id, created_by, expires_at)
		VALUES ($1, $2, $3)
		RETURNING id, device_id, created_by, expires_at, created_at`

	var link models.ShareLink
	err := s.db.QueryRow(ctx, q, deviceID, ownerID, expiresAt).
		Scan(&link.ID, &link.DeviceID, &link.CreatedBy, &link.ExpiresAt, &link.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("create share link: %w", err)
	}
	return &link, nil
}

func (s *ShareService) List(ctx context.Context, deviceID uuid.UUID) ([]models.ShareLink, error) {
	const q = `
		SELECT id, device_id, created_by, expires_at, created_at
		FROM share_links
		WHERE device_id = $1 AND expires_at > now()
		ORDER BY created_at DESC`

	rows, err := s.db.Query(ctx, q, deviceID)
	if err != nil {
		return nil, fmt.Errorf("list share links: %w", err)
	}
	defer rows.Close()

	var links []models.ShareLink
	for rows.Next() {
		var l models.ShareLink
		if err := rows.Scan(&l.ID, &l.DeviceID, &l.CreatedBy, &l.ExpiresAt, &l.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan share link: %w", err)
		}
		links = append(links, l)
	}
	return links, rows.Err()
}

func (s *ShareService) Revoke(ctx context.Context, linkID, userID uuid.UUID) error {
	const q = `DELETE FROM share_links WHERE id = $1 AND created_by = $2`
	tag, err := s.db.Exec(ctx, q, linkID, userID)
	if err != nil {
		return fmt.Errorf("revoke share link: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// GetByToken validates the token, checks expiry, and returns device + latest location.
func (s *ShareService) GetByToken(ctx context.Context, token uuid.UUID) (*models.Device, *models.Location, error) {
	const q = `
		SELECT device_id FROM share_links
		WHERE id = $1 AND expires_at > now()`

	var deviceID uuid.UUID
	err := s.db.QueryRow(ctx, q, token).Scan(&deviceID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil, ErrNotFound
		}
		return nil, nil, fmt.Errorf("get share link: %w", err)
	}

	device, err := s.devSvc.Get(ctx, deviceID)
	if err != nil || device == nil {
		return nil, nil, fmt.Errorf("get device: %w", err)
	}

	loc, err := s.locSvc.Latest(ctx, deviceID)
	if err != nil {
		return nil, nil, fmt.Errorf("get location: %w", err)
	}

	return device, loc, nil
}
