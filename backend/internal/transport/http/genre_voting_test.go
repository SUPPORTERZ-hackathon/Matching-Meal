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
	"meal/backend/internal/service"
)

type genreVotingUseCaseStub struct {
	state domain.GenreVotingState
	error error
	votes []domain.GenreVote
}

func (stub *genreVotingUseCaseStub) Submit(_ context.Context, _ string, _ string, votes []domain.GenreVote) (domain.GenreVotingState, error) {
	stub.votes = votes
	return stub.state, stub.error
}
func (stub *genreVotingUseCaseStub) GetState(context.Context, string, string) (domain.GenreVotingState, error) {
	return stub.state, stub.error
}

func validGenreVotingRequest() string {
	parts := make([]string, 0, domain.GenreCount)
	for _, genreID := range domain.GenreIDs() {
		parts = append(parts, `{"genreId":"`+genreID+`","choice":"skip"}`)
	}
	return `{"votes":[` + strings.Join(parts, ",") + `]}`
}

func TestRegisterGenreVotingRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	RegisterGenreVotingRoutes(router, NewGenreVotingHandler(&genreVotingUseCaseStub{}))
	routes := map[string]bool{
		"PUT /api/v1/rooms/:roomId/genre-votes":  false,
		"GET /api/v1/rooms/:roomId/genre-voting": false,
	}
	for _, route := range router.Routes() {
		key := route.Method + " " + route.Path
		if _, exists := routes[key]; exists {
			routes[key] = true
		}
	}
	for route, registered := range routes {
		if !registered {
			t.Fatalf("route %s was not registered", route)
		}
	}
}

func TestGenreVotingHandlerSubmit(t *testing.T) {
	gin.SetMode(gin.TestMode)
	now := time.Date(2026, time.October, 30, 12, 0, 0, 0, time.UTC)
	roomID := "550e8400-e29b-41d4-a716-446655440000"
	stub := &genreVotingUseCaseStub{state: domain.GenreVotingState{
		Room:                 domain.Room{ID: roomID, Status: domain.RoomStatusGenreVoting, ExpiresAt: now.Add(time.Hour)},
		CurrentParticipantID: "participant-id", Submitted: true,
		SubmittedParticipantCount: 1, TotalParticipantCount: 1,
		Participants: []domain.GenreVotingParticipant{{Participant: domain.Participant{ID: "participant-id"}, Submitted: true}},
	}}
	router := gin.New()
	router.PUT("/api/v1/rooms/:roomId/genre-votes", NewGenreVotingHandler(stub).Submit)
	request := httptest.NewRequest(http.MethodPut, "/api/v1/rooms/"+roomID+"/genre-votes", strings.NewReader(validGenreVotingRequest()))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer token")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK || len(stub.votes) != domain.GenreCount {
		t.Fatalf("status = %d, votes = %d, body = %s", recorder.Code, len(stub.votes), recorder.Body.String())
	}
	var response genreVotingResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !response.Data.Submitted || response.Data.CurrentParticipantID != "participant-id" {
		t.Fatalf("response = %+v", response.Data)
	}
}

func TestGenreVotingHandlerErrors(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tests := []struct {
		name          string
		authorization string
		body          string
		serviceError  error
		wantStatus    int
		wantCode      string
	}{
		{name: "missing authorization", body: validGenreVotingRequest(), wantStatus: http.StatusUnauthorized, wantCode: "UNAUTHORIZED"},
		{name: "invalid body", authorization: "Bearer token", body: `{}`, wantStatus: http.StatusBadRequest, wantCode: "INVALID_GENRE_VOTES"},
		{name: "already submitted", authorization: "Bearer token", body: validGenreVotingRequest(), serviceError: service.ErrVoteAlreadySubmitted, wantStatus: http.StatusConflict, wantCode: "VOTE_ALREADY_SUBMITTED"},
		{name: "inactive", authorization: "Bearer token", body: validGenreVotingRequest(), serviceError: service.ErrGenreVotingNotActive, wantStatus: http.StatusConflict, wantCode: "GENRE_VOTING_NOT_ACTIVE"},
		{name: "internal", authorization: "Bearer token", body: validGenreVotingRequest(), serviceError: errors.New("database secret"), wantStatus: http.StatusInternalServerError, wantCode: "INTERNAL_ERROR"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			stub := &genreVotingUseCaseStub{error: test.serviceError}
			router := gin.New()
			router.PUT("/api/v1/rooms/:roomId/genre-votes", NewGenreVotingHandler(stub).Submit)
			request := httptest.NewRequest(http.MethodPut, "/api/v1/rooms/550e8400-e29b-41d4-a716-446655440000/genre-votes", strings.NewReader(test.body))
			request.Header.Set("Content-Type", "application/json")
			if test.authorization != "" {
				request.Header.Set("Authorization", test.authorization)
			}
			recorder := httptest.NewRecorder()
			router.ServeHTTP(recorder, request)
			if recorder.Code != test.wantStatus || !strings.Contains(recorder.Body.String(), `"code":"`+test.wantCode+`"`) {
				t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
			}
			if strings.Contains(recorder.Body.String(), "database secret") {
				t.Fatal("internal error leaked to response")
			}
		})
	}
}
