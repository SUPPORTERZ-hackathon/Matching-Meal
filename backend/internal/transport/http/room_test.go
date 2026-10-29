package httptransport

import (
	"bytes"
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

func (handlerRepositoryStub) FindParticipantBySessionTokenHash(_ context.Context, _ []byte) (domain.Participant, error) {
	return domain.Participant{}, errors.New("unexpected participant lookup")
}

func (handlerRepositoryStub) FindStateByID(_ context.Context, _ string) (domain.Room, []domain.Participant, error) {
	return domain.Room{}, nil, errors.New("unexpected room state lookup")
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

func TestRegisterRoomRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handler := NewRoomHandler(service.NewRoomService(handlerRepositoryStub{}, &handlerGeneratorStub{}, handlerClockStub{}))
	router := gin.New()

	RegisterRoomRoutes(router, handler)

	expectedRoutes := map[string]bool{
		"POST /api/v1/rooms":                             false,
		"POST /api/v1/rooms/:roomRef/participants":       false,
		"GET /api/v1/rooms/:roomId":                      false,
		"POST /api/v1/rooms/:roomRef/genre-voting/start": false,
	}
	for _, route := range router.Routes() {
		key := route.Method + " " + route.Path
		if _, exists := expectedRoutes[key]; exists {
			expectedRoutes[key] = true
		}
	}
	for route, registered := range expectedRoutes {
		if !registered {
			t.Fatalf("route %s was not registered", route)
		}
	}
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

func (joinHandlerRepositoryStub) FindParticipantBySessionTokenHash(_ context.Context, _ []byte) (domain.Participant, error) {
	return domain.Participant{}, errors.New("unexpected participant lookup")
}

func (joinHandlerRepositoryStub) FindStateByID(_ context.Context, _ string) (domain.Room, []domain.Participant, error) {
	return domain.Room{}, nil, errors.New("unexpected room state lookup")
}

type joinHandlerTransactionStub struct {
	room domain.Room
}

func (stub *joinHandlerTransactionStub) FindByJoinCodeForUpdate(_ context.Context, _ string) (domain.Room, error) {
	return stub.room, nil
}

func (stub *joinHandlerTransactionStub) FindByIDForUpdate(_ context.Context, _ string) (domain.Room, error) {
	return stub.room, nil
}

func (stub *joinHandlerTransactionStub) CountParticipants(_ context.Context, _ string) (int, error) {
	return 1, nil
}

func (stub *joinHandlerTransactionStub) ListParticipants(_ context.Context, _ string) ([]domain.Participant, error) {
	return nil, errors.New("unexpected participant list")
}

func (stub *joinHandlerTransactionStub) InsertParticipant(_ context.Context, participant domain.Participant, _ []byte) (domain.Participant, error) {
	return participant, nil
}

func (stub *joinHandlerTransactionStub) IncrementRoomVersion(_ context.Context, _ string) (domain.Room, error) {
	stub.room.Version++
	return stub.room, nil
}

func (stub *joinHandlerTransactionStub) UpdateRoomStatus(_ context.Context, _ string, _ domain.RoomStatus) (domain.Room, error) {
	return domain.Room{}, errors.New("unexpected status update")
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
	router.POST("/api/v1/rooms/:roomRef/participants", handler.Join)

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

type stateHandlerRepositoryStub struct {
	room         domain.Room
	participants []domain.Participant
}

func (stateHandlerRepositoryStub) Create(_ context.Context, _ repository.CreateRoomParams) (domain.Room, domain.Participant, error) {
	return domain.Room{}, domain.Participant{}, errors.New("unexpected create")
}

func (stateHandlerRepositoryStub) WithinTransaction(_ context.Context, _ func(repository.RoomTransaction) error) error {
	return errors.New("unexpected transaction")
}

func (stub stateHandlerRepositoryStub) FindParticipantBySessionTokenHash(_ context.Context, _ []byte) (domain.Participant, error) {
	return stub.participants[1], nil
}

func (stub stateHandlerRepositoryStub) FindStateByID(_ context.Context, _ string) (domain.Room, []domain.Participant, error) {
	return stub.room, stub.participants, nil
}

func TestRoomHandlerGetState(t *testing.T) {
	gin.SetMode(gin.TestMode)
	roomID := "550e8400-e29b-41d4-a716-446655440000"
	now := handlerClockStub{}.Now()
	participants := []domain.Participant{
		{ID: "host-id", RoomID: roomID, Nickname: "同名", Role: domain.ParticipantRoleHost},
		{ID: "member-id", RoomID: roomID, Nickname: "同名", Role: domain.ParticipantRoleMember},
	}
	roomService := service.NewRoomService(stateHandlerRepositoryStub{
		room:         domain.Room{ID: roomID, JoinCode: "EB9TY3TS", Status: domain.RoomStatusLobby, Version: 2, ExpiresAt: now.Add(time.Hour)},
		participants: participants,
	}, &handlerGeneratorStub{}, handlerClockStub{})
	handler := NewRoomHandler(roomService)
	router := gin.New()
	router.Use(func(context *gin.Context) { context.Set(requestIDContextKey, "request-id") })
	router.GET("/api/v1/rooms/:roomId", handler.GetState)

	request := httptest.NewRequest(http.MethodGet, "/api/v1/rooms/"+roomID, nil)
	request.Header.Set("Authorization", "Bearer member-token")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	var response roomStateResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if response.Data.CurrentParticipantID != "member-id" || len(response.Data.Participants) != 2 {
		t.Fatalf("response = %+v", response.Data)
	}
	if response.Data.Participants[0].Nickname != response.Data.Participants[1].Nickname {
		t.Fatalf("same nicknames were not preserved: %+v", response.Data.Participants)
	}
}

func TestRoomHandlerGetStateRejectsMissingAuthorization(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handler := NewRoomHandler(service.NewRoomService(handlerRepositoryStub{}, &handlerGeneratorStub{}, handlerClockStub{}))
	router := gin.New()
	router.Use(func(context *gin.Context) { context.Set(requestIDContextKey, "request-id") })
	router.GET("/api/v1/rooms/:roomId", handler.GetState)

	request := httptest.NewRequest(http.MethodGet, "/api/v1/rooms/550e8400-e29b-41d4-a716-446655440000", nil)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
}

type startHandlerRepositoryStub struct {
	room         domain.Room
	participants []domain.Participant
}

func (startHandlerRepositoryStub) Create(_ context.Context, _ repository.CreateRoomParams) (domain.Room, domain.Participant, error) {
	return domain.Room{}, domain.Participant{}, errors.New("unexpected create")
}

func (stub startHandlerRepositoryStub) FindParticipantBySessionTokenHash(_ context.Context, _ []byte) (domain.Participant, error) {
	return stub.participants[0], nil
}

func (startHandlerRepositoryStub) FindStateByID(_ context.Context, _ string) (domain.Room, []domain.Participant, error) {
	return domain.Room{}, nil, errors.New("unexpected room state lookup")
}

func (stub startHandlerRepositoryStub) WithinTransaction(ctx context.Context, operation func(repository.RoomTransaction) error) error {
	return operation(&startHandlerTransactionStub{room: stub.room, participants: stub.participants})
}

type startHandlerTransactionStub struct {
	room         domain.Room
	participants []domain.Participant
}

func (stub *startHandlerTransactionStub) FindByJoinCodeForUpdate(_ context.Context, _ string) (domain.Room, error) {
	return domain.Room{}, errors.New("unexpected join code lookup")
}

func (stub *startHandlerTransactionStub) FindByIDForUpdate(_ context.Context, _ string) (domain.Room, error) {
	return stub.room, nil
}

func (stub *startHandlerTransactionStub) CountParticipants(_ context.Context, _ string) (int, error) {
	return len(stub.participants), nil
}

func (stub *startHandlerTransactionStub) ListParticipants(_ context.Context, _ string) ([]domain.Participant, error) {
	return stub.participants, nil
}

func (stub *startHandlerTransactionStub) InsertParticipant(_ context.Context, _ domain.Participant, _ []byte) (domain.Participant, error) {
	return domain.Participant{}, errors.New("unexpected participant insert")
}

func (stub *startHandlerTransactionStub) IncrementRoomVersion(_ context.Context, _ string) (domain.Room, error) {
	return domain.Room{}, errors.New("unexpected version increment")
}

func (stub *startHandlerTransactionStub) UpdateRoomStatus(_ context.Context, _ string, status domain.RoomStatus) (domain.Room, error) {
	stub.room.Status = status
	stub.room.Version++
	return stub.room, nil
}

func TestRoomHandlerStartGenreVoting(t *testing.T) {
	gin.SetMode(gin.TestMode)
	roomID := "550e8400-e29b-41d4-a716-446655440000"
	now := handlerClockStub{}.Now()
	participants := []domain.Participant{
		{ID: "host-id", RoomID: roomID, Role: domain.ParticipantRoleHost},
		{ID: "member-id", RoomID: roomID, Role: domain.ParticipantRoleMember},
	}
	roomService := service.NewRoomService(startHandlerRepositoryStub{
		room:         domain.Room{ID: roomID, Status: domain.RoomStatusLobby, Version: 2, ExpiresAt: now.Add(time.Hour)},
		participants: participants,
	}, &handlerGeneratorStub{}, handlerClockStub{})
	handler := NewRoomHandler(roomService)
	router := gin.New()
	var logOutput bytes.Buffer
	router.Use(gin.LoggerWithWriter(&logOutput))
	router.Use(func(context *gin.Context) { context.Set(requestIDContextKey, "request-id") })
	router.POST("/api/v1/rooms/:roomRef/genre-voting/start", handler.StartGenreVoting)

	request := httptest.NewRequest(http.MethodPost, "/api/v1/rooms/"+roomID+"/genre-voting/start", nil)
	request.Header.Set("Authorization", "Bearer sensitive-host-token")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	var response roomStateResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if response.Data.Room.Status != domain.RoomStatusGenreVoting || response.Data.Room.Version != 3 {
		t.Fatalf("response = %+v", response.Data)
	}
	if strings.Contains(logOutput.String(), "sensitive-host-token") {
		t.Fatal("Authorization token was written to the request log")
	}
}

func TestRoomHandlerStartGenreVotingErrors(t *testing.T) {
	gin.SetMode(gin.TestMode)
	roomID := "550e8400-e29b-41d4-a716-446655440000"
	now := handlerClockStub{}.Now()
	tests := []struct {
		name           string
		roomStatus     domain.RoomStatus
		participants   []domain.Participant
		expectedStatus int
		expectedCode   string
	}{
		{
			name: "member cannot start", roomStatus: domain.RoomStatusLobby,
			participants: []domain.Participant{
				{ID: "member-id", RoomID: roomID, Role: domain.ParticipantRoleMember},
				{ID: "host-id", RoomID: roomID, Role: domain.ParticipantRoleHost},
			},
			expectedStatus: http.StatusForbidden, expectedCode: "HOST_REQUIRED",
		},
		{
			name: "one participant", roomStatus: domain.RoomStatusLobby,
			participants: []domain.Participant{
				{ID: "host-id", RoomID: roomID, Role: domain.ParticipantRoleHost},
			},
			expectedStatus: http.StatusConflict, expectedCode: "NOT_ENOUGH_PARTICIPANTS",
		},
		{
			name: "invalid transition", roomStatus: domain.RoomStatusRestaurantVoting,
			participants: []domain.Participant{
				{ID: "host-id", RoomID: roomID, Role: domain.ParticipantRoleHost},
				{ID: "member-id", RoomID: roomID, Role: domain.ParticipantRoleMember},
			},
			expectedStatus: http.StatusConflict, expectedCode: "INVALID_ROOM_TRANSITION",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			roomService := service.NewRoomService(startHandlerRepositoryStub{
				room:         domain.Room{ID: roomID, Status: test.roomStatus, Version: 2, ExpiresAt: now.Add(time.Hour)},
				participants: test.participants,
			}, &handlerGeneratorStub{}, handlerClockStub{})
			handler := NewRoomHandler(roomService)
			router := gin.New()
			router.Use(func(context *gin.Context) { context.Set(requestIDContextKey, "request-id") })
			router.POST("/api/v1/rooms/:roomRef/genre-voting/start", handler.StartGenreVoting)

			request := httptest.NewRequest(http.MethodPost, "/api/v1/rooms/"+roomID+"/genre-voting/start", nil)
			request.Header.Set("Authorization", "Bearer participant-token")
			recorder := httptest.NewRecorder()
			router.ServeHTTP(recorder, request)

			if recorder.Code != test.expectedStatus {
				t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
			}
			var response apiErrorResponse
			if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
				t.Fatalf("decode response: %v", err)
			}
			if response.Error.Code != test.expectedCode {
				t.Fatalf("error code = %q, want %q", response.Error.Code, test.expectedCode)
			}
		})
	}
}
