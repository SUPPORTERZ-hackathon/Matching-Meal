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

func (roomRepository *RoomRepository) FindParticipantBySessionTokenHash(ctx context.Context, sessionTokenHash []byte) (domain.Participant, error) {
	var participant domain.Participant
	err := roomRepository.pool.QueryRow(ctx, `
		SELECT id, room_id, nickname, role, joined_at
		FROM participants
		WHERE session_token_hash = $1
	`, sessionTokenHash).Scan(
		&participant.ID, &participant.RoomID, &participant.Nickname,
		&participant.Role, &participant.JoinedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Participant{}, repository.ErrParticipantNotFound
	}
	if err != nil {
		return domain.Participant{}, fmt.Errorf("find participant by session token hash: %w", err)
	}
	return participant, nil
}

func (roomRepository *RoomRepository) FindStateByID(ctx context.Context, roomID string) (domain.Room, []domain.Participant, error) {
	rows, err := roomRepository.pool.Query(ctx, `
		SELECT
			r.id, r.join_code, r.status, r.version, r.expires_at, r.created_at, r.updated_at,
			p.id, p.room_id, p.nickname, p.role, p.joined_at
		FROM rooms r
		JOIN participants p ON p.room_id = r.id
		WHERE r.id = $1
		ORDER BY p.joined_at ASC, p.id ASC
	`, roomID)
	if err != nil {
		return domain.Room{}, nil, fmt.Errorf("query room state: %w", err)
	}
	defer rows.Close()

	var room domain.Room
	participants := make([]domain.Participant, 0)
	for rows.Next() {
		var participant domain.Participant
		if err := rows.Scan(
			&room.ID, &room.JoinCode, &room.Status, &room.Version,
			&room.ExpiresAt, &room.CreatedAt, &room.UpdatedAt,
			&participant.ID, &participant.RoomID, &participant.Nickname,
			&participant.Role, &participant.JoinedAt,
		); err != nil {
			return domain.Room{}, nil, fmt.Errorf("scan room state: %w", err)
		}
		participants = append(participants, participant)
	}
	if err := rows.Err(); err != nil {
		return domain.Room{}, nil, fmt.Errorf("read room state: %w", err)
	}
	if len(participants) == 0 {
		return domain.Room{}, nil, repository.ErrRoomNotFound
	}
	return room, participants, nil
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

func (transaction *roomTransaction) FindByIDForUpdate(ctx context.Context, roomID string) (domain.Room, error) {
	var room domain.Room
	err := transaction.tx.QueryRow(ctx, `
		SELECT id, join_code, status, version, expires_at, created_at, updated_at
		FROM rooms
		WHERE id = $1
		FOR UPDATE
	`, roomID).Scan(
		&room.ID, &room.JoinCode, &room.Status, &room.Version,
		&room.ExpiresAt, &room.CreatedAt, &room.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Room{}, repository.ErrRoomNotFound
	}
	if err != nil {
		return domain.Room{}, fmt.Errorf("find room by id for update: %w", err)
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

func (transaction *roomTransaction) ListParticipants(ctx context.Context, roomID string) ([]domain.Participant, error) {
	rows, err := transaction.tx.Query(ctx, `
		SELECT id, room_id, nickname, role, joined_at
		FROM participants
		WHERE room_id = $1
		ORDER BY joined_at ASC, id ASC
	`, roomID)
	if err != nil {
		return nil, fmt.Errorf("query room participants: %w", err)
	}
	defer rows.Close()

	participants := make([]domain.Participant, 0)
	for rows.Next() {
		var participant domain.Participant
		if err := rows.Scan(
			&participant.ID, &participant.RoomID, &participant.Nickname,
			&participant.Role, &participant.JoinedAt,
		); err != nil {
			return nil, fmt.Errorf("scan room participant: %w", err)
		}
		participants = append(participants, participant)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read room participants: %w", err)
	}
	return participants, nil
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

func (transaction *roomTransaction) UpdateRoomStatus(ctx context.Context, roomID string, status domain.RoomStatus) (domain.Room, error) {
	var room domain.Room
	err := transaction.tx.QueryRow(ctx, `
		UPDATE rooms
		SET status = $2, version = version + 1, updated_at = NOW()
		WHERE id = $1
		RETURNING id, join_code, status, version, expires_at, created_at, updated_at
	`, roomID, status).Scan(
		&room.ID, &room.JoinCode, &room.Status, &room.Version,
		&room.ExpiresAt, &room.CreatedAt, &room.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Room{}, repository.ErrRoomNotFound
	}
	if err != nil {
		return domain.Room{}, fmt.Errorf("update room status: %w", err)
	}
	return room, nil
}
