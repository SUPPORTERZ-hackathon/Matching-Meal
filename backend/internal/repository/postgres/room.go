package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"meal/backend/internal/domain"
	"meal/backend/internal/repository"
)

const (
	uniqueViolationCode        = "23505"
	joinCodeConstraintName     = "rooms_join_code_unique"
	transactionRollbackTimeout = 2 * time.Second
)

type RoomRepository struct {
	pool *pgxpool.Pool
}

type roomTransaction struct {
	tx pgx.Tx
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
		rollback(tx)
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

func (roomRepository *RoomRepository) WithinTransaction(ctx context.Context, operation func(repository.RoomTransaction) error) error {
	tx, err := roomRepository.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin room transaction: %w", err)
	}
	defer func() {
		rollback(tx)
	}()

	if err := operation(&roomTransaction{tx: tx}); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit room transaction: %w", err)
	}
	return nil
}

func rollback(tx pgx.Tx) {
	rollbackContext, cancel := context.WithTimeout(context.Background(), transactionRollbackTimeout)
	defer cancel()
	_ = tx.Rollback(rollbackContext)
}

func (transaction *roomTransaction) FindByJoinCodeForUpdate(ctx context.Context, joinCode string) (domain.Room, error) {
	var room domain.Room
	err := transaction.tx.QueryRow(ctx, `
		SELECT id, join_code, status, version, expires_at, created_at, updated_at
		FROM rooms
		WHERE join_code = $1
		FOR UPDATE
	`, joinCode).Scan(
		&room.ID, &room.JoinCode, &room.Status, &room.Version,
		&room.ExpiresAt, &room.CreatedAt, &room.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Room{}, repository.ErrRoomNotFound
	}
	if err != nil {
		return domain.Room{}, fmt.Errorf("find room by join code: %w", err)
	}
	return room, nil
}

func (transaction *roomTransaction) CountParticipants(ctx context.Context, roomID string) (int, error) {
	var count int
	if err := transaction.tx.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM participants
		WHERE room_id = $1
	`, roomID).Scan(&count); err != nil {
		return 0, fmt.Errorf("count room participants: %w", err)
	}
	return count, nil
}

func (transaction *roomTransaction) InsertParticipant(ctx context.Context, participant domain.Participant, sessionTokenHash []byte) (domain.Participant, error) {
	err := transaction.tx.QueryRow(ctx, `
		INSERT INTO participants (id, room_id, nickname, role, session_token_hash)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING joined_at
	`, participant.ID, participant.RoomID, participant.Nickname, participant.Role, sessionTokenHash).Scan(&participant.JoinedAt)
	if err != nil {
		return domain.Participant{}, fmt.Errorf("insert room participant: %w", err)
	}
	return participant, nil
}

func (transaction *roomTransaction) IncrementRoomVersion(ctx context.Context, roomID string) (domain.Room, error) {
	var room domain.Room
	err := transaction.tx.QueryRow(ctx, `
		UPDATE rooms
		SET version = version + 1, updated_at = NOW()
		WHERE id = $1
		RETURNING id, join_code, status, version, expires_at, created_at, updated_at
	`, roomID).Scan(
		&room.ID, &room.JoinCode, &room.Status, &room.Version,
		&room.ExpiresAt, &room.CreatedAt, &room.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Room{}, repository.ErrRoomNotFound
	}
	if err != nil {
		return domain.Room{}, fmt.Errorf("increment room version: %w", err)
	}
	return room, nil
}
