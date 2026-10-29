package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"meal/backend/internal/domain"
	"meal/backend/internal/repository"
)

const (
	uniqueViolationCode    = "23505"
	joinCodeConstraintName = "rooms_join_code_unique"
)

type RoomRepository struct {
	pool *pgxpool.Pool
}

func NewRoomRepository(pool *pgxpool.Pool) *RoomRepository {
	return &RoomRepository{pool: pool}
}

func (roomRepository *RoomRepository) Create(ctx context.Context, params repository.CreateRoomParams) (domain.Room, domain.Participant, error) {
	tx, err := roomRepository.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return domain.Room{}, domain.Participant{}, fmt.Errorf("begin create room transaction: %w", err)
	}
	defer func() {
		_ = tx.Rollback(ctx)
	}()

	room := params.Room
	err = tx.QueryRow(ctx, `
		INSERT INTO rooms (id, join_code, status, version, expires_at)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING created_at, updated_at
	`, room.ID, room.JoinCode, room.Status, room.Version, room.ExpiresAt).Scan(&room.CreatedAt, &room.UpdatedAt)
	if err != nil {
		var databaseError *pgconn.PgError
		if errors.As(err, &databaseError) && databaseError.Code == uniqueViolationCode && databaseError.ConstraintName == joinCodeConstraintName {
			return domain.Room{}, domain.Participant{}, repository.ErrJoinCodeConflict
		}
		return domain.Room{}, domain.Participant{}, fmt.Errorf("insert room: %w", err)
	}

	host := params.Host
	err = tx.QueryRow(ctx, `
		INSERT INTO participants (id, room_id, nickname, role, session_token_hash)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING joined_at
	`, host.ID, host.RoomID, host.Nickname, host.Role, params.SessionTokenHash).Scan(&host.JoinedAt)
	if err != nil {
		return domain.Room{}, domain.Participant{}, fmt.Errorf("insert host participant: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.Room{}, domain.Participant{}, fmt.Errorf("commit create room transaction: %w", err)
	}
	return room, host, nil
}
