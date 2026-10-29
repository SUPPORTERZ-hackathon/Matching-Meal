package httptransport

import (
	"context"
	"encoding/json"
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
	var response createRoomResponse
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
