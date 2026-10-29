package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"meal/backend/internal/domain"
	"meal/backend/internal/repository"
	"meal/backend/internal/security"
)

const joinCodeGenerationAttempts = 5

var ErrRoomCodeGeneration = errors.New("room code generation failed")

type Clock interface {
	Now() time.Time
}

type SystemClock struct{}

func (SystemClock) Now() time.Time {
	return time.Now()
}

type RoomService struct {
	repository repository.RoomRepository
	generator  security.Generator
	clock      Clock
}

type CreateRoomResult struct {
	Room         domain.Room
	Participant  domain.Participant
	SessionToken string
}

func NewRoomService(roomRepository repository.RoomRepository, generator security.Generator, clock Clock) *RoomService {
	return &RoomService{repository: roomRepository, generator: generator, clock: clock}
}

func (service *RoomService) Create(ctx context.Context, rawNickname string) (CreateRoomResult, error) {
	nickname, err := domain.NormalizeNickname(rawNickname)
	if err != nil {
		return CreateRoomResult{}, err
	}

	roomID, err := service.generator.UUID()
	if err != nil {
		return CreateRoomResult{}, fmt.Errorf("generate room id: %w", err)
	}
	participantID, err := service.generator.UUID()
	if err != nil {
		return CreateRoomResult{}, fmt.Errorf("generate participant id: %w", err)
	}
	sessionToken, sessionTokenHash, err := service.generator.SessionToken()
	if err != nil {
		return CreateRoomResult{}, fmt.Errorf("generate participant session: %w", err)
	}

	createdAt := service.clock.Now()
	for attempt := 0; attempt < joinCodeGenerationAttempts; attempt++ {
		joinCode, err := service.generator.JoinCode()
		if err != nil {
			return CreateRoomResult{}, fmt.Errorf("generate room join code: %w", err)
		}
		room := domain.Room{
			ID:        roomID,
			JoinCode:  joinCode,
			Status:    domain.RoomStatusLobby,
			Version:   domain.InitialRoomVersion,
			ExpiresAt: createdAt.Add(domain.DefaultRoomLifetime),
		}
		host := domain.Participant{
			ID:       participantID,
			RoomID:   roomID,
			Nickname: nickname,
			Role:     domain.ParticipantRoleHost,
		}
		storedRoom, storedHost, err := service.repository.Create(ctx, repository.CreateRoomParams{
			Room: room, Host: host, SessionTokenHash: sessionTokenHash,
		})
		if errors.Is(err, repository.ErrJoinCodeConflict) {
			continue
		}
		if err != nil {
			return CreateRoomResult{}, err
		}
		return CreateRoomResult{Room: storedRoom, Participant: storedHost, SessionToken: sessionToken}, nil
	}
	return CreateRoomResult{}, ErrRoomCodeGeneration
}
