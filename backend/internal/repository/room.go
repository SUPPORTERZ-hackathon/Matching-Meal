package repository

import (
	"context"
	"errors"

	"meal/backend/internal/domain"
)

var ErrJoinCodeConflict = errors.New("join code conflict")

type CreateRoomParams struct {
	Room             domain.Room
	Host             domain.Participant
	SessionTokenHash []byte
}

type RoomRepository interface {
	Create(ctx context.Context, params CreateRoomParams) (domain.Room, domain.Participant, error)
}
