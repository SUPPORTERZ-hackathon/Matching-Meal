package postgres

import (
	"bytes"
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
	idempotencyStatePending    = "pending"
	idempotencyStateCompleted  = "completed"
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

	room, host, err := insertRoomBundle(ctx, tx, params)
	if err != nil {
		return domain.Room{}, domain.Participant{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return domain.Room{}, domain.Participant{}, fmt.Errorf("commit create room transaction: %w", err)
	}
	return room, host, nil
}

func insertRoomBundle(ctx context.Context, tx pgx.Tx, params repository.CreateRoomParams) (domain.Room, domain.Participant, error) {
	room := params.Room
	err := tx.QueryRow(ctx, `
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

	searchCondition := params.SearchCondition
	err = tx.QueryRow(ctx, `
		INSERT INTO room_search_conditions (room_id, latitude, longitude, search_range)
		VALUES ($1, $2, $3, $4)
		RETURNING created_at
	`, searchCondition.RoomID, searchCondition.Latitude, searchCondition.Longitude, searchCondition.Range).Scan(&searchCondition.CreatedAt)
	if err != nil {
		return domain.Room{}, domain.Participant{}, fmt.Errorf("insert room search condition: %w", err)
	}

	return room, host, nil
}

func (roomRepository *RoomRepository) CreateIdempotent(
	ctx context.Context,
	claim repository.RoomIdempotencyClaim,
	params repository.CreateRoomParams,
) (domain.Room, domain.Participant, bool, error) {
	tx, err := roomRepository.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return domain.Room{}, domain.Participant{}, false, fmt.Errorf("begin idempotent create room transaction: %w", err)
	}
	defer func() { rollback(tx) }()

	isNew, err := claimRoomIdempotency(ctx, tx, claim)
	if err != nil {
		return domain.Room{}, domain.Participant{}, false, err
	}
	if !isNew {
		room, participant, err := loadRoomIdempotencyResult(ctx, tx, claim)
		if err != nil {
			return domain.Room{}, domain.Participant{}, false, err
		}
		if err := tx.Commit(ctx); err != nil {
			return domain.Room{}, domain.Participant{}, false, fmt.Errorf("commit idempotent create replay: %w", err)
		}
		return room, participant, true, nil
	}

	room, participant, err := insertRoomBundle(ctx, tx, params)
	if err != nil {
		return domain.Room{}, domain.Participant{}, false, err
	}
	if err := completeRoomIdempotency(ctx, tx, claim, room, participant); err != nil {
		return domain.Room{}, domain.Participant{}, false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.Room{}, domain.Participant{}, false, fmt.Errorf("commit idempotent create room transaction: %w", err)
	}
	return room, participant, false, nil
}

func (roomRepository *RoomRepository) WithinIdempotentTransaction(
	ctx context.Context,
	claim repository.RoomIdempotencyClaim,
	operation func(repository.RoomTransaction) (domain.Room, domain.Participant, error),
) (domain.Room, domain.Participant, bool, error) {
	tx, err := roomRepository.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return domain.Room{}, domain.Participant{}, false, fmt.Errorf("begin idempotent room transaction: %w", err)
	}
	defer func() { rollback(tx) }()

	isNew, err := claimRoomIdempotency(ctx, tx, claim)
	if err != nil {
		return domain.Room{}, domain.Participant{}, false, err
	}
	if !isNew {
		room, participant, err := loadRoomIdempotencyResult(ctx, tx, claim)
		if err != nil {
			return domain.Room{}, domain.Participant{}, false, err
		}
		if err := tx.Commit(ctx); err != nil {
			return domain.Room{}, domain.Participant{}, false, fmt.Errorf("commit idempotent room replay: %w", err)
		}
		return room, participant, true, nil
	}

	room, participant, err := operation(&roomTransaction{tx: tx})
	if err != nil {
		return domain.Room{}, domain.Participant{}, false, err
	}
	if err := completeRoomIdempotency(ctx, tx, claim, room, participant); err != nil {
		return domain.Room{}, domain.Participant{}, false, err
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.Room{}, domain.Participant{}, false, fmt.Errorf("commit idempotent room transaction: %w", err)
	}
	return room, participant, false, nil
}

func claimRoomIdempotency(ctx context.Context, tx pgx.Tx, claim repository.RoomIdempotencyClaim) (bool, error) {
	var inserted int
	err := tx.QueryRow(ctx, `
		INSERT INTO room_idempotency_requests (operation, key_hash, request_fingerprint, state)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (operation, key_hash) DO NOTHING
		RETURNING 1
	`, claim.Operation, claim.KeyHash, claim.RequestFingerprint, idempotencyStatePending).Scan(&inserted)
	if err == nil {
		return true, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return false, fmt.Errorf("claim room idempotency key: %w", err)
	}

	var fingerprint []byte
	var state string
	err = tx.QueryRow(ctx, `
		SELECT request_fingerprint, state
		FROM room_idempotency_requests
		WHERE operation = $1 AND key_hash = $2
		FOR UPDATE
	`, claim.Operation, claim.KeyHash).Scan(&fingerprint, &state)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, repository.ErrIdempotencyCorrupt
	}
	if err != nil {
		return false, fmt.Errorf("lock room idempotency key: %w", err)
	}
	if !bytes.Equal(fingerprint, claim.RequestFingerprint) {
		return false, repository.ErrIdempotencyConflict
	}
	if state != idempotencyStateCompleted {
		return false, repository.ErrIdempotencyCorrupt
	}
	return false, nil
}

func completeRoomIdempotency(
	ctx context.Context,
	tx pgx.Tx,
	claim repository.RoomIdempotencyClaim,
	room domain.Room,
	participant domain.Participant,
) error {
	command, err := tx.Exec(ctx, `
		UPDATE room_idempotency_requests
		SET state = $3, room_id = $4, participant_id = $5,
			response_room_status = $6, response_room_version = $7, expires_at = $8
		WHERE operation = $1 AND key_hash = $2 AND state = $9
	`, claim.Operation, claim.KeyHash, idempotencyStateCompleted, room.ID, participant.ID,
		room.Status, room.Version, room.ExpiresAt, idempotencyStatePending)
	if err != nil {
		return fmt.Errorf("complete room idempotency key: %w", err)
	}
	if command.RowsAffected() != 1 {
		return repository.ErrIdempotencyCorrupt
	}
	return nil
}

func loadRoomIdempotencyResult(
	ctx context.Context,
	tx pgx.Tx,
	claim repository.RoomIdempotencyClaim,
) (domain.Room, domain.Participant, error) {
	var room domain.Room
	var participant domain.Participant
	err := tx.QueryRow(ctx, `
		SELECT
			r.id, r.join_code, i.response_room_status, i.response_room_version,
			r.expires_at, r.created_at, r.updated_at,
			p.id, p.room_id, p.nickname, p.role, p.joined_at
		FROM room_idempotency_requests i
		JOIN rooms r ON r.id = i.room_id
		JOIN participants p ON p.id = i.participant_id AND p.room_id = i.room_id
		WHERE i.operation = $1 AND i.key_hash = $2 AND i.state = $3
	`, claim.Operation, claim.KeyHash, idempotencyStateCompleted).Scan(
		&room.ID, &room.JoinCode, &room.Status, &room.Version,
		&room.ExpiresAt, &room.CreatedAt, &room.UpdatedAt,
		&participant.ID, &participant.RoomID, &participant.Nickname,
		&participant.Role, &participant.JoinedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Room{}, domain.Participant{}, repository.ErrIdempotencyCorrupt
	}
	if err != nil {
		return domain.Room{}, domain.Participant{}, fmt.Errorf("load room idempotency result: %w", err)
	}
	return room, participant, nil
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
