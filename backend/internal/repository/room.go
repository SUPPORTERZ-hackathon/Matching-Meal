package repository

import (
	"context"
	"errors"

	"meal/backend/internal/domain"
)

var (
	ErrJoinCodeConflict    = errors.New("join code conflict")
	ErrIdempotencyConflict = errors.New("idempotency key conflict")
	ErrIdempotencyCorrupt  = errors.New("idempotency record corrupt")
	ErrParticipantNotFound = errors.New("participant not found")
	ErrRoomNotFound        = errors.New("room not found")
)

type RoomIdempotencyOperation string

const (
	RoomIdempotencyCreate RoomIdempotencyOperation = "create_room"
	RoomIdempotencyJoin   RoomIdempotencyOperation = "join_room"
)

type RoomIdempotencyClaim struct {
	Operation          RoomIdempotencyOperation
	KeyHash            []byte
	RequestFingerprint []byte
}

type CreateRoomParams struct {
	Room             domain.Room
	Host             domain.Participant
	SearchCondition  domain.RoomSearchCondition
	SessionTokenHash []byte
}

type RoomRepository interface {
	Create(ctx context.Context, params CreateRoomParams) (domain.Room, domain.Participant, error)
	FindParticipantBySessionTokenHash(ctx context.Context, sessionTokenHash []byte) (domain.Participant, error)
	FindStateByID(ctx context.Context, roomID string) (domain.Room, []domain.Participant, error)
	WithinTransaction(ctx context.Context, operation func(RoomTransaction) error) error
}

type RoomIdempotencyRepository interface {
	CreateIdempotent(ctx context.Context, claim RoomIdempotencyClaim, params CreateRoomParams) (domain.Room, domain.Participant, bool, error)
	WithinIdempotentTransaction(
		ctx context.Context,
		claim RoomIdempotencyClaim,
		operation func(RoomTransaction) (domain.Room, domain.Participant, error),
	) (domain.Room, domain.Participant, bool, error)
}

type RoomTransaction interface {
	FindByJoinCodeForUpdate(ctx context.Context, joinCode string) (domain.Room, error)
	FindByIDForUpdate(ctx context.Context, roomID string) (domain.Room, error)
	CountParticipants(ctx context.Context, roomID string) (int, error)
	ListParticipants(ctx context.Context, roomID string) ([]domain.Participant, error)
	InsertParticipant(ctx context.Context, participant domain.Participant, sessionTokenHash []byte) (domain.Participant, error)
	IncrementRoomVersion(ctx context.Context, roomID string) (domain.Room, error)
	UpdateRoomStatus(ctx context.Context, roomID string, status domain.RoomStatus) (domain.Room, error)
}
