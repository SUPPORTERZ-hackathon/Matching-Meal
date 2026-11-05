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
	roomTimestampPrecision     = time.Microsecond
)

var (
	ErrRoomCapacityReached    = errors.New("room capacity reached")
	ErrRoomCodeGeneration     = errors.New("room code generation failed")
	ErrRoomNotFound           = errors.New("room not found")
	ErrRoomNotJoinable        = errors.New("room not joinable")
	ErrIdempotencyConflict    = errors.New("idempotency key conflict")
	ErrIdempotencyUnavailable = errors.New("idempotency unavailable")
	ErrUnauthorized           = errors.New("unauthorized")
	ErrForbidden              = errors.New("forbidden")
	ErrHostRequired           = errors.New("host required")
	ErrNotEnoughParticipants  = errors.New("not enough participants")
	ErrInvalidRoomTransition  = errors.New("invalid room transition")
)

type Clock interface {
	Now() time.Time
}

type SystemClock struct{}

func (SystemClock) Now() time.Time {
	return time.Now()
}

type RoomService struct {
	repository     repository.RoomRepository
	generator      security.Generator
	clock          Clock
	idempotencyKey []byte
}

type CreateRoomResult struct {
	Room                domain.Room
	Participant         domain.Participant
	SessionToken        string
	IdempotencyReplayed bool
}

type CreateRoomInput struct {
	Nickname    string
	Latitude    float64
	Longitude   float64
	SearchRange int
}

type JoinRoomResult struct {
	Room                domain.Room
	Participant         domain.Participant
	SessionToken        string
	IdempotencyReplayed bool
}

type GetRoomStateResult struct {
	Room                 domain.Room
	CurrentParticipantID string
	Participants         []domain.Participant
}

type RoomServiceOption func(*RoomService)

func WithRoomIdempotencyKey(key []byte) RoomServiceOption {
	return func(roomService *RoomService) {
		roomService.idempotencyKey = append([]byte(nil), key...)
	}
}

func NewRoomService(roomRepository repository.RoomRepository, generator security.Generator, clock Clock, options ...RoomServiceOption) *RoomService {
	roomService := &RoomService{repository: roomRepository, generator: generator, clock: clock}
	for _, option := range options {
		option(roomService)
	}
	return roomService
}

func (service *RoomService) Create(ctx context.Context, input CreateRoomInput) (CreateRoomResult, error) {
	return service.CreateWithIdempotency(ctx, input, "")
}

func (service *RoomService) CreateWithIdempotency(ctx context.Context, input CreateRoomInput, idempotencyKey string) (CreateRoomResult, error) {
	operationContext, cancel := context.WithTimeout(ctx, roomOperationTimeout)
	defer cancel()

	nickname, err := domain.NormalizeNickname(input.Nickname)
	if err != nil {
		return CreateRoomResult{}, err
	}
	if idempotencyKey != "" {
		if err := domain.ValidateIdempotencyKey(idempotencyKey); err != nil {
			return CreateRoomResult{}, err
		}
		if len(service.idempotencyKey) < security.MinIdempotencyHMACKeyBytes {
			return CreateRoomResult{}, ErrIdempotencyUnavailable
		}
	}
	searchCondition, err := domain.NewRoomSearchCondition("", input.Latitude, input.Longitude, input.SearchRange)
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
	var sessionToken string
	var sessionTokenHash []byte
	if idempotencyKey == "" {
		sessionToken, sessionTokenHash, err = service.generator.SessionToken()
		if err != nil {
			return CreateRoomResult{}, fmt.Errorf("generate participant session: %w", err)
		}
	} else {
		sessionToken, sessionTokenHash, _ = security.DeriveIdempotentSessionToken(
			service.idempotencyKey, string(repository.RoomIdempotencyCreate), idempotencyKey, participantID,
		)
	}

	createdAt := service.clock.Now().Truncate(roomTimestampPrecision)
	searchCondition.RoomID = roomID
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
		params := repository.CreateRoomParams{
			Room: room, Host: host, SearchCondition: searchCondition, SessionTokenHash: sessionTokenHash,
		}
		var storedRoom domain.Room
		var storedHost domain.Participant
		var replayed bool
		if idempotencyKey == "" {
			storedRoom, storedHost, err = service.repository.Create(operationContext, params)
		} else {
			idempotencyRepository, ok := service.repository.(repository.RoomIdempotencyRepository)
			if !ok {
				return CreateRoomResult{}, ErrIdempotencyUnavailable
			}
			storedRoom, storedHost, replayed, err = idempotencyRepository.CreateIdempotent(
				operationContext,
				newRoomIdempotencyClaim(repository.RoomIdempotencyCreate, idempotencyKey, createRoomFingerprint(nickname, searchCondition)),
				params,
			)
			if errors.Is(err, repository.ErrIdempotencyConflict) {
				return CreateRoomResult{}, ErrIdempotencyConflict
			}
		}
		if errors.Is(err, repository.ErrJoinCodeConflict) {
			continue
		}
		if err != nil {
			return CreateRoomResult{}, err
		}
		if replayed {
			if !service.clock.Now().Before(storedRoom.ExpiresAt) {
				return CreateRoomResult{}, ErrRoomNotFound
			}
			sessionToken, _, _ = security.DeriveIdempotentSessionToken(
				service.idempotencyKey, string(repository.RoomIdempotencyCreate), idempotencyKey, storedHost.ID,
			)
		}
		return CreateRoomResult{
			Room: storedRoom, Participant: storedHost, SessionToken: sessionToken, IdempotencyReplayed: replayed,
		}, nil
	}
	return CreateRoomResult{}, ErrRoomCodeGeneration
}

func (service *RoomService) Join(ctx context.Context, rawJoinCode string, rawNickname string) (JoinRoomResult, error) {
	return service.JoinWithIdempotency(ctx, rawJoinCode, rawNickname, "")
}

func (service *RoomService) JoinWithIdempotency(ctx context.Context, rawJoinCode string, rawNickname string, idempotencyKey string) (JoinRoomResult, error) {
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
	if idempotencyKey != "" {
		if err := domain.ValidateIdempotencyKey(idempotencyKey); err != nil {
			return JoinRoomResult{}, err
		}
		if len(service.idempotencyKey) < security.MinIdempotencyHMACKeyBytes {
			return JoinRoomResult{}, ErrIdempotencyUnavailable
		}
	}

	var result JoinRoomResult
	joinOperation := func(transaction repository.RoomTransaction) (domain.Room, domain.Participant, error) {
		room, err := transaction.FindByJoinCodeForUpdate(operationContext, joinCode)
		if errors.Is(err, repository.ErrRoomNotFound) {
			return domain.Room{}, domain.Participant{}, ErrRoomNotFound
		}
		if err != nil {
			return domain.Room{}, domain.Participant{}, err
		}
		if !service.clock.Now().Before(room.ExpiresAt) {
			return domain.Room{}, domain.Participant{}, ErrRoomNotFound
		}
		if room.Status != domain.RoomStatusLobby {
			return domain.Room{}, domain.Participant{}, ErrRoomNotJoinable
		}

		participantCount, err := transaction.CountParticipants(operationContext, room.ID)
		if err != nil {
			return domain.Room{}, domain.Participant{}, err
		}
		if participantCount >= domain.MaxRoomParticipants {
			return domain.Room{}, domain.Participant{}, ErrRoomCapacityReached
		}

		participantID, err := service.generator.UUID()
		if err != nil {
			return domain.Room{}, domain.Participant{}, fmt.Errorf("generate participant id: %w", err)
		}
		var sessionToken string
		var sessionTokenHash []byte
		if idempotencyKey == "" {
			sessionToken, sessionTokenHash, err = service.generator.SessionToken()
			if err != nil {
				return domain.Room{}, domain.Participant{}, fmt.Errorf("generate participant session: %w", err)
			}
		} else {
			sessionToken, sessionTokenHash, _ = security.DeriveIdempotentSessionToken(
				service.idempotencyKey, string(repository.RoomIdempotencyJoin), idempotencyKey, participantID,
			)
		}
		participant, err := transaction.InsertParticipant(operationContext, domain.Participant{
			ID: participantID, RoomID: room.ID, Nickname: nickname, Role: domain.ParticipantRoleMember,
		}, sessionTokenHash)
		if err != nil {
			return domain.Room{}, domain.Participant{}, err
		}
		room, err = transaction.IncrementRoomVersion(operationContext, room.ID)
		if err != nil {
			return domain.Room{}, domain.Participant{}, err
		}
		result = JoinRoomResult{Room: room, Participant: participant, SessionToken: sessionToken}
		return room, participant, nil
	}

	if idempotencyKey == "" {
		err = service.repository.WithinTransaction(operationContext, func(transaction repository.RoomTransaction) error {
			_, _, operationError := joinOperation(transaction)
			return operationError
		})
	} else {
		idempotencyRepository, ok := service.repository.(repository.RoomIdempotencyRepository)
		if !ok {
			return JoinRoomResult{}, ErrIdempotencyUnavailable
		}
		var room domain.Room
		var participant domain.Participant
		var replayed bool
		room, participant, replayed, err = idempotencyRepository.WithinIdempotentTransaction(
			operationContext,
			newRoomIdempotencyClaim(repository.RoomIdempotencyJoin, idempotencyKey, joinRoomFingerprint(joinCode, nickname)),
			joinOperation,
		)
		if errors.Is(err, repository.ErrIdempotencyConflict) {
			return JoinRoomResult{}, ErrIdempotencyConflict
		}
		if err == nil && replayed {
			if !service.clock.Now().Before(room.ExpiresAt) {
				return JoinRoomResult{}, ErrRoomNotFound
			}
			sessionToken, _, _ := security.DeriveIdempotentSessionToken(
				service.idempotencyKey, string(repository.RoomIdempotencyJoin), idempotencyKey, participant.ID,
			)
			result = JoinRoomResult{
				Room: room, Participant: participant, SessionToken: sessionToken, IdempotencyReplayed: true,
			}
		}
	}
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
