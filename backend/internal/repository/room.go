package repository

import (
	"context"
	"errors"

	"meal/backend/internal/domain"
)

var (
	ErrJoinCodeConflict = errors.New("join code conflict")
	ErrRoomNotFound     = errors.New("room not found")
)

type CreateRoomParams struct {
	Room             domain.Room
	Host             domain.Participant
	SessionTokenHash []byte
}

type RoomRepository interface {
	Create(ctx context.Context, params CreateRoomParams) (domain.Room, domain.Participant, error)
	WithinTransaction(ctx context.Context, operation func(RoomTransaction) error) error
}

type RoomTransaction interface {
	FindByJoinCodeForUpdate(ctx context.Context, joinCode string) (domain.Room, error)
	CountParticipants(ctx context.Context, roomID string) (int, error)
	InsertParticipant(ctx context.Context, participant domain.Participant, sessionTokenHash []byte) (domain.Participant, error)
	IncrementRoomVersion(ctx context.Context, roomID string) (domain.Room, error)
}
