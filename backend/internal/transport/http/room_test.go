package httptransport

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"meal/backend/internal/domain"
	"meal/backend/internal/repository"
	"meal/backend/internal/service"
)

type handlerRepositoryStub struct{}

func (handlerRepositoryStub) Create(_ context.Context, params repository.CreateRoomParams) (domain.Room, domain.Participant, error) {
	storedAt := time.Date(2026, time.October, 29, 10, 0, 0, 0, time.UTC)
	params.Room.CreatedAt = storedAt
	params.Room.UpdatedAt = storedAt
	params.Host.JoinedAt = storedAt
	return params.Room, params.Host, nil
}

func (handlerRepositoryStub) WithinTransaction(_ context.Context, _ func(repository.RoomTransaction) error) error {
	return errors.New("unexpected transaction")
}

type handlerGeneratorStub struct {
	uuidCalls int
}

func (stub *handlerGeneratorStub) UUID() (string, error) {
	stub.uuidCalls++
	if stub.uuidCalls == 1 {
		return "room-id", nil
	}
	return "participant-id", nil
}

func (stub *handlerGeneratorStub) JoinCode() (string, error) {
	return "ABCDEFGH", nil
}

func (stub *handlerGeneratorStub) SessionToken() (string, []byte, error) {
	return "plain-token", []byte("token-hash"), nil
}

type handlerClockStub struct{}

func (handlerClockStub) Now() time.Time {
	return time.Date(2026, time.October, 29, 9, 0, 0, 0, time.UTC)
}

func TestRoomHandlerCreate(t *testing.T) {
	gin.SetMode(gin.TestMode)
	generator := &handlerGeneratorStub{}
	roomService := service.NewRoomService(handlerRepositoryStub{}, generator, handlerClockStub{})
	handler := NewRoomHandler(roomService)
	router := gin.New()
	router.Use(func(context *gin.Context) {
		context.Set(requestIDContextKey, "request-id")
	})
	router.POST("/api/v1/rooms", handler.Create)

	request := httptest.NewRequest(http.MethodPost, "/api/v1/rooms", strings.NewReader(`{"nickname":"ひかる"}`))
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusCreated {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	var response roomSessionResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if response.Data.Room.ID != "room-id" || response.Data.Room.JoinCode != "ABCDEFGH" {
		t.Fatalf("room response = %+v", response.Data.Room)
	}
	if response.Data.Participant.Role != domain.ParticipantRoleHost || response.Data.SessionToken != "plain-token" {
		t.Fatalf("response = %+v", response.Data)
	}
}

type joinHandlerRepositoryStub struct {
	room domain.Room
}

func (stub joinHandlerRepositoryStub) Create(_ context.Context, _ repository.CreateRoomParams) (domain.Room, domain.Participant, error) {
	return domain.Room{}, domain.Participant{}, errors.New("unexpected create")
}

func (stub joinHandlerRepositoryStub) WithinTransaction(ctx context.Context, operation func(repository.RoomTransaction) error) error {
	return operation(&joinHandlerTransactionStub{room: stub.room})
}

type joinHandlerTransactionStub struct {
	room domain.Room
}

func (stub *joinHandlerTransactionStub) FindByJoinCodeForUpdate(_ context.Context, _ string) (domain.Room, error) {
	return stub.room, nil
}

func (stub *joinHandlerTransactionStub) CountParticipants(_ context.Context, _ string) (int, error) {
	return 1, nil
}

func (stub *joinHandlerTransactionStub) InsertParticipant(_ context.Context, participant domain.Participant, _ []byte) (domain.Participant, error) {
	return participant, nil
}

func (stub *joinHandlerTransactionStub) IncrementRoomVersion(_ context.Context, _ string) (domain.Room, error) {
	stub.room.Version++
	return stub.room, nil
}

type joinHandlerGeneratorStub struct{}

func (joinHandlerGeneratorStub) UUID() (string, error) {
	return "participant-id", nil
}

func (joinHandlerGeneratorStub) JoinCode() (string, error) {
	return "", errors.New("unexpected join code generation")
}

func (joinHandlerGeneratorStub) SessionToken() (string, []byte, error) {
	return "member-token", []byte("member-token-hash"), nil
}

func TestRoomHandlerJoin(t *testing.T) {
	gin.SetMode(gin.TestMode)
	now := handlerClockStub{}.Now()
	roomService := service.NewRoomService(joinHandlerRepositoryStub{room: domain.Room{
		ID: "room-id", JoinCode: "EB9TY3TS", Status: domain.RoomStatusLobby,
		Version: 1, ExpiresAt: now.Add(time.Hour),
	}}, joinHandlerGeneratorStub{}, handlerClockStub{})
	handler := NewRoomHandler(roomService)
	router := gin.New()
	router.Use(func(context *gin.Context) {
		context.Set(requestIDContextKey, "request-id")
	})
	router.POST("/api/v1/rooms/:joinCode/participants", handler.Join)

	request := httptest.NewRequest(http.MethodPost, "/api/v1/rooms/eb9ty3ts/participants", strings.NewReader(`{"nickname":"ひかる"}`))
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusCreated {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	var response roomSessionResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if response.Data.Room.Version != 2 || response.Data.Participant.Role != domain.ParticipantRoleMember {
		t.Fatalf("response = %+v", response.Data)
	}
	if response.Data.SessionToken != "member-token" {
		t.Fatalf("session token = %q", response.Data.SessionToken)
	}
}

func TestRoomHandlerCreateRejectsInvalidRequest(t *testing.T) {
	gin.SetMode(gin.TestMode)
	roomService := service.NewRoomService(handlerRepositoryStub{}, &handlerGeneratorStub{}, handlerClockStub{})
	handler := NewRoomHandler(roomService)
	router := gin.New()
	router.Use(func(context *gin.Context) {
		context.Set(requestIDContextKey, "request-id")
	})
	router.POST("/api/v1/rooms", handler.Create)

	request := httptest.NewRequest(http.MethodPost, "/api/v1/rooms", strings.NewReader(`{"nickname":""}`))
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	var response apiErrorResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if response.Error.Code != "INVALID_REQUEST" || response.Error.RequestID != "request-id" {
		t.Fatalf("error response = %+v", response.Error)
	}
}
