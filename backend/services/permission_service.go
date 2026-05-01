package services

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PermissionEntry struct {
	ID         uuid.UUID `json:"id"`
	DeviceID   uuid.UUID `json:"device_id"`
	UserID     uuid.UUID `json:"user_id"`
	UserEmail  string    `json:"user_email"`
	Permission string    `json:"permission"`
	GrantedBy  uuid.UUID `json:"granted_by"`
	GrantedAt  time.Time `json:"granted_at"`
}

type PermissionService struct {
	db *pgxpool.Pool
}

func NewPermissionService(db *pgxpool.Pool) *PermissionService {
	return &PermissionService{db: db}
}

// isOwner checks whether userID owns deviceID.
func (s *PermissionService) isOwner(ctx context.Context, userID, deviceID uuid.UUID) (bool, error) {
	var ok bool
	err := s.db.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM devices WHERE id = $1 AND owner_id = $2)`,
		deviceID, userID,
	).Scan(&ok)
	return ok, err
}

// List returns all permissions for a device. Only the owner may call this.
func (s *PermissionService) List(ctx context.Context, ownerID, deviceID uuid.UUID) ([]PermissionEntry, error) {
	owner, err := s.isOwner(ctx, ownerID, deviceID)
	if err != nil {
		return nil, fmt.Errorf("check owner: %w", err)
	}
	if !owner {
		return nil, ErrForbidden
	}

	const q = `
		SELECT dp.id, dp.device_id, dp.user_id, u.email,
		       dp.permission, dp.granted_by, dp.granted_at
		FROM device_permissions dp
		JOIN auth.users u ON u.id = dp.user_id
		WHERE dp.device_id = $1
		ORDER BY dp.granted_at DESC`

	rows, err := s.db.Query(ctx, q, deviceID)
	if err != nil {
		return nil, fmt.Errorf("list permissions: %w", err)
	}
	defer rows.Close()

	var entries []PermissionEntry
	for rows.Next() {
		var e PermissionEntry
		if err := rows.Scan(&e.ID, &e.DeviceID, &e.UserID, &e.UserEmail,
			&e.Permission, &e.GrantedBy, &e.GrantedAt); err != nil {
			return nil, fmt.Errorf("scan permission: %w", err)
		}
		entries = append(entries, e)
	}
	return entries, rows.Err()
}

// Grant looks up the target user by email and creates a permission entry.
// Only the device owner may grant access.
func (s *PermissionService) Grant(ctx context.Context, ownerID, deviceID uuid.UUID, email, permission string) (*PermissionEntry, error) {
	if permission != "view" && permission != "admin" {
		return nil, fmt.Errorf("permission must be 'view' or 'admin'")
	}

	owner, err := s.isOwner(ctx, ownerID, deviceID)
	if err != nil {
		return nil, fmt.Errorf("check owner: %w", err)
	}
	if !owner {
		return nil, ErrForbidden
	}

	// Resolve email → user_id via auth.users (accessible with service-role connection)
	var targetUserID uuid.UUID
	err = s.db.QueryRow(ctx,
		`SELECT id FROM auth.users WHERE email = $1 LIMIT 1`, email,
	).Scan(&targetUserID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("user with email %q not found — they must create an account first", email)
		}
		return nil, fmt.Errorf("lookup user: %w", err)
	}

	if targetUserID == ownerID {
		return nil, fmt.Errorf("cannot grant permission to yourself")
	}

	const q = `
		INSERT INTO device_permissions (device_id, user_id, permission, granted_by)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (device_id, user_id) DO UPDATE SET permission = EXCLUDED.permission
		RETURNING id, device_id, user_id, permission, granted_by, granted_at`

	var e PermissionEntry
	e.UserEmail = email
	err = s.db.QueryRow(ctx, q, deviceID, targetUserID, permission, ownerID).
		Scan(&e.ID, &e.DeviceID, &e.UserID, &e.Permission, &e.GrantedBy, &e.GrantedAt)
	if err != nil {
		return nil, fmt.Errorf("grant permission: %w", err)
	}
	return &e, nil
}

// Revoke removes a permission entry. Only the device owner may revoke.
func (s *PermissionService) Revoke(ctx context.Context, ownerID, deviceID, targetUserID uuid.UUID) error {
	owner, err := s.isOwner(ctx, ownerID, deviceID)
	if err != nil {
		return fmt.Errorf("check owner: %w", err)
	}
	if !owner {
		return ErrForbidden
	}

	tag, err := s.db.Exec(ctx,
		`DELETE FROM device_permissions WHERE device_id = $1 AND user_id = $2`,
		deviceID, targetUserID,
	)
	if err != nil {
		return fmt.Errorf("revoke permission: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
