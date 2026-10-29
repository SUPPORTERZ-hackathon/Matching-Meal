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

const (
	joinCodeGenerationAttempts = 5
	roomOperationTimeout       = 5 * time.Second
)

var (
	ErrRoomCapacityReached   = errors.New("room capacity reached")
	ErrRoomCodeGeneration    = errors.New("room code generation failed")
	ErrRoomNotFound          = errors.New("room not found")
	ErrRoomNotJoinable       = errors.New("room not joinable")
	ErrUnauthorized          = errors.New("unauthorized")
	ErrForbidden             = errors.New("forbidden")
	ErrHostRequired          = errors.New("host required")
	ErrNotEnoughParticipants = errors.New("not enough participants")
	ErrInvalidRoomTransition = errors.New("invalid room transition")
)

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

type JoinRoomResult struct {
	Room         domain.Room
	Participant  domain.Participant
	SessionToken string
}

type GetRoomStateResult struct {
	Room                 domain.Room
	CurrentParticipantID string
	Participants         []domain.Participant
}

func NewRoomService(roomRepository repository.RoomRepository, generator security.Generator, clock Clock) *RoomService {
	return &RoomService{repository: roomRepository, generator: generator, clock: clock}
}

func (service *RoomService) Create(ctx context.Context, rawNickname string) (CreateRoomResult, error) {
	operationContext, cancel := context.WithTimeout(ctx, roomOperationTimeout)
	defer cancel()

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
		storedRoom, storedHost, err := service.repository.Create(operationContext, repository.CreateRoomParams{
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

func (service *RoomService) Join(ctx context.Context, rawJoinCode string, rawNickname string) (JoinRoomResult, error) {
	operationContext, cancel := context.WithTimeout(ctx, roomOperationTimeout)
	defer cancel()

	joinCode, err := domain.NormalizeJoinCode(rawJoinCode)
	if err != nil {
		return JoinRoomResult{}, err
	}
	nickname, err := domain.NormalizeNickname(rawNickname)
	if err != nil {
		return JoinRoomResult{}, err
	}

	var result JoinRoomResult
	err = service.repository.WithinTransaction(operationContext, func(transaction repository.RoomTransaction) error {
		room, err := transaction.FindByJoinCodeForUpdate(operationContext, joinCode)
		if errors.Is(err, repository.ErrRoomNotFound) {
			return ErrRoomNotFound
		}
		if err != nil {
			return err
		}
		if !service.clock.Now().Before(room.ExpiresAt) {
			return ErrRoomNotFound
		}
		if room.Status != domain.RoomStatusLobby {
			return ErrRoomNotJoinable
		}

		participantCount, err := transaction.CountParticipants(operationContext, room.ID)
		if err != nil {
			return err
		}
		if participantCount >= domain.MaxRoomParticipants {
			return ErrRoomCapacityReached
		}

		participantID, err := service.generator.UUID()
		if err != nil {
			return fmt.Errorf("generate participant id: %w", err)
		}
		sessionToken, sessionTokenHash, err := service.generator.SessionToken()
		if err != nil {
			return fmt.Errorf("generate participant session: %w", err)
		}
		participant, err := transaction.InsertParticipant(operationContext, domain.Participant{
			ID: participantID, RoomID: room.ID, Nickname: nickname, Role: domain.ParticipantRoleMember,
		}, sessionTokenHash)
		if err != nil {
			return err
		}
		room, err = transaction.IncrementRoomVersion(operationContext, room.ID)
		if err != nil {
			return err
		}
		result = JoinRoomResult{Room: room, Participant: participant, SessionToken: sessionToken}
		return nil
	})
	if err != nil {
		return JoinRoomResult{}, err
	}
	return result, nil
}

func (service *RoomService) GetState(ctx context.Context, rawRoomID string, sessionToken string) (GetRoomStateResult, error) {
	operationContext, cancel := context.WithTimeout(ctx, roomOperationTimeout)
	defer cancel()

	roomID, err := domain.NormalizeRoomID(rawRoomID)
	if err != nil {
		return GetRoomStateResult{}, err
	}
	if sessionToken == "" {
		return GetRoomStateResult{}, ErrUnauthorized
	}

	currentParticipant, err := service.repository.FindParticipantBySessionTokenHash(
		operationContext,
		security.HashSessionToken(sessionToken),
	)
	if errors.Is(err, repository.ErrParticipantNotFound) {
		return GetRoomStateResult{}, ErrUnauthorized
	}
	if err != nil {
		return GetRoomStateResult{}, err
	}
	if currentParticipant.RoomID != roomID {
		return GetRoomStateResult{}, ErrForbidden
	}

	room, participants, err := service.repository.FindStateByID(operationContext, roomID)
	if errors.Is(err, repository.ErrRoomNotFound) {
		return GetRoomStateResult{}, ErrRoomNotFound
	}
	if err != nil {
		return GetRoomStateResult{}, err
	}
	if room.Status == domain.RoomStatusExpired || !service.clock.Now().Before(room.ExpiresAt) {
		return GetRoomStateResult{}, ErrRoomNotFound
	}

	return GetRoomStateResult{
		Room: room, CurrentParticipantID: currentParticipant.ID, Participants: participants,
	}, nil
}

func (service *RoomService) StartGenreVoting(ctx context.Context, rawRoomID string, sessionToken string) (GetRoomStateResult, error) {
	operationContext, cancel := context.WithTimeout(ctx, roomOperationTimeout)
	defer cancel()

	roomID, err := domain.NormalizeRoomID(rawRoomID)
	if err != nil {
		return GetRoomStateResult{}, err
	}
	if sessionToken == "" {
		return GetRoomStateResult{}, ErrUnauthorized
	}
	currentParticipant, err := service.repository.FindParticipantBySessionTokenHash(
		operationContext,
		security.HashSessionToken(sessionToken),
	)
	if errors.Is(err, repository.ErrParticipantNotFound) {
		return GetRoomStateResult{}, ErrUnauthorized
	}
	if err != nil {
		return GetRoomStateResult{}, err
	}
	if currentParticipant.RoomID != roomID {
		return GetRoomStateResult{}, ErrForbidden
	}
	if currentParticipant.Role != domain.ParticipantRoleHost {
		return GetRoomStateResult{}, ErrHostRequired
	}

	var result GetRoomStateResult
	err = service.repository.WithinTransaction(operationContext, func(transaction repository.RoomTransaction) error {
		room, err := transaction.FindByIDForUpdate(operationContext, roomID)
		if errors.Is(err, repository.ErrRoomNotFound) {
			return ErrRoomNotFound
		}
		if err != nil {
			return err
		}
		if room.Status == domain.RoomStatusExpired || !service.clock.Now().Before(room.ExpiresAt) {
			return ErrRoomNotFound
		}

		switch room.Status {
		case domain.RoomStatusLobby:
			participantCount, err := transaction.CountParticipants(operationContext, roomID)
			if err != nil {
				return err
			}
			if participantCount < 2 {
				return ErrNotEnoughParticipants
			}
			room, err = transaction.UpdateRoomStatus(operationContext, roomID, domain.RoomStatusGenreVoting)
			if err != nil {
				return err
			}
		case domain.RoomStatusGenreVoting:
			// A repeated request is successful without changing the version.
		default:
			return ErrInvalidRoomTransition
		}

		participants, err := transaction.ListParticipants(operationContext, roomID)
		if err != nil {
			return err
		}
		result = GetRoomStateResult{
			Room: room, CurrentParticipantID: currentParticipant.ID, Participants: participants,
		}
		return nil
	})
	if err != nil {
		return GetRoomStateResult{}, err
	}
	return result, nil
}
