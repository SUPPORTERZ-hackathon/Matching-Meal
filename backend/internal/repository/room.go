package repository

import (
	"context"
	"errors"

	"meal/backend/internal/domain"
)

var (
	ErrJoinCodeConflict    = errors.New("join code conflict")
	ErrParticipantNotFound = errors.New("participant not found")
	ErrRoomNotFound        = errors.New("room not found")
)

type CreateRoomParams struct {
	Room             domain.Room
	Host             domain.Participant
	SessionTokenHash []byte
}

type RoomRepository interface {
	Create(ctx context.Context, params CreateRoomParams) (domain.Room, domain.Participant, error)
	FindParticipantBySessionTokenHash(ctx context.Context, sessionTokenHash []byte) (domain.Participant, error)
	FindStateByID(ctx context.Context, roomID string) (domain.Room, []domain.Participant, error)
	WithinTransaction(ctx context.Context, operation func(RoomTransaction) error) error
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
