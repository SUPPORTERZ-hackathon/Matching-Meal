package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"meal/backend/internal/domain"
	"meal/backend/internal/repository"
)

type roomRepositoryStub struct {
	errors []error
	calls  []repository.CreateRoomParams
}

func (stub *roomRepositoryStub) Create(_ context.Context, params repository.CreateRoomParams) (domain.Room, domain.Participant, error) {
	stub.calls = append(stub.calls, params)
	callIndex := len(stub.calls) - 1
	if callIndex < len(stub.errors) && stub.errors[callIndex] != nil {
		return domain.Room{}, domain.Participant{}, stub.errors[callIndex]
	}
	params.Room.CreatedAt = time.Date(2026, time.October, 29, 10, 0, 0, 0, time.UTC)
	params.Room.UpdatedAt = params.Room.CreatedAt
	params.Host.JoinedAt = params.Room.CreatedAt
	return params.Room, params.Host, nil
}

type generatorStub struct {
	uuids     []string
	uuidIndex int
	codes     []string
	codeIndex int
	token     string
	hash      []byte
}

func (stub *generatorStub) UUID() (string, error) {
	value := stub.uuids[stub.uuidIndex]
	stub.uuidIndex++
	return value, nil
}

func (stub *generatorStub) JoinCode() (string, error) {
	value := stub.codes[stub.codeIndex]
	stub.codeIndex++
	return value, nil
}

func (stub *generatorStub) SessionToken() (string, []byte, error) {
	return stub.token, stub.hash, nil
}

type clockStub struct {
	now time.Time
}

func (stub clockStub) Now() time.Time {
	return stub.now
}

func TestRoomServiceCreate(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, time.October, 29, 9, 0, 0, 0, time.UTC)
	repositoryStub := &roomRepositoryStub{}
	generator := &generatorStub{
		uuids: []string{"room-id", "participant-id"}, codes: []string{"ABCDEFGH"},
		token: "plain-token", hash: []byte("token-hash"),
	}
	roomService := NewRoomService(repositoryStub, generator, clockStub{now: now})

	result, err := roomService.Create(context.Background(), " ひかる ")
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if result.Room.ID != "room-id" || result.Room.JoinCode != "ABCDEFGH" || result.Room.Status != domain.RoomStatusLobby {
		t.Fatalf("Create() room = %+v", result.Room)
	}
	if result.Room.ExpiresAt != now.Add(domain.DefaultRoomLifetime) {
		t.Fatalf("Create() expiresAt = %v", result.Room.ExpiresAt)
	}
	if result.Participant.ID != "participant-id" || result.Participant.Nickname != "ひかる" || result.Participant.Role != domain.ParticipantRoleHost {
		t.Fatalf("Create() participant = %+v", result.Participant)
	}
	if result.SessionToken != "plain-token" {
		t.Fatalf("Create() token = %q", result.SessionToken)
	}
	if len(repositoryStub.calls) != 1 || string(repositoryStub.calls[0].SessionTokenHash) != "token-hash" {
		t.Fatalf("repository calls = %+v", repositoryStub.calls)
	}
}

func TestRoomServiceCreateRetriesJoinCodeConflict(t *testing.T) {
	t.Parallel()
	repositoryStub := &roomRepositoryStub{errors: []error{repository.ErrJoinCodeConflict, nil}}
	generator := &generatorStub{
		uuids: []string{"room-id", "participant-id"}, codes: []string{"CONFLICT", "AVAILABLE"},
		token: "plain-token", hash: []byte("token-hash"),
	}
	roomService := NewRoomService(repositoryStub, generator, clockStub{now: time.Now()})

	result, err := roomService.Create(context.Background(), "同名OK")
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if result.Room.JoinCode != "AVAILABLE" || len(repositoryStub.calls) != 2 {
		t.Fatalf("Create() joinCode = %q, calls = %d", result.Room.JoinCode, len(repositoryStub.calls))
	}
}

func TestRoomServiceCreateRejectsInvalidNicknameBeforePersistence(t *testing.T) {
	t.Parallel()
	repositoryStub := &roomRepositoryStub{}
	roomService := NewRoomService(repositoryStub, &generatorStub{}, clockStub{})

	_, err := roomService.Create(context.Background(), " ")
	if !errors.Is(err, domain.ErrInvalidNickname) {
		t.Fatalf("Create() error = %v, want ErrInvalidNickname", err)
	}
	if len(repositoryStub.calls) != 0 {
		t.Fatalf("repository calls = %d, want 0", len(repositoryStub.calls))
	}
}
