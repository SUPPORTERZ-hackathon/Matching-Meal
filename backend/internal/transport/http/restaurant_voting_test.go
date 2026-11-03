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

type restaurantVotingUseCaseStub struct {
	state domain.RestaurantVotingState
	error error
	votes []domain.RestaurantVote
}

func (stub *restaurantVotingUseCaseStub) Submit(_ context.Context, _ string, _ string, votes []domain.RestaurantVote) (domain.RestaurantVotingState, error) {
	stub.votes = votes
	return stub.state, stub.error
}
func (stub *restaurantVotingUseCaseStub) GetState(context.Context, string, string) (domain.RestaurantVotingState, error) {
	return stub.state, stub.error
}

const validRestaurantVotingRequest = `{"votes":[{"restaurantId":"J001","choice":"like"},{"restaurantId":"J002","choice":"skip"}]}`

func TestRegisterRestaurantVotingRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	RegisterRestaurantVotingRoutes(router, NewRestaurantVotingHandler(&restaurantVotingUseCaseStub{}))
	routes := map[string]bool{
		"PUT /api/v1/rooms/:roomKey/restaurant-votes":  false,
		"GET /api/v1/rooms/:roomKey/restaurant-voting": false,
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

func TestRestaurantVotingHandlerSubmitAndResultResponse(t *testing.T) {
	gin.SetMode(gin.TestMode)
	now := time.Date(2026, time.November, 3, 12, 0, 0, 0, time.UTC)
	roomID := "550e8400-e29b-41d4-a716-446655440000"
	latitude, longitude := 35.658, 139.7016
	stub := &restaurantVotingUseCaseStub{state: domain.RestaurantVotingState{
		Room:                 domain.Room{ID: roomID, Status: domain.RoomStatusDecided, ExpiresAt: now.Add(time.Hour)},
		CurrentParticipantID: "participant-id", Submitted: true,
		SubmittedParticipantCount: 1, TotalParticipantCount: 1,
		Participants: []domain.RestaurantVotingParticipant{{Participant: domain.Participant{ID: "participant-id"}, Submitted: true}},
		Result: &domain.RestaurantVoteResult{
			RestaurantID: "J001", LikeCount: 1, DecisionMethod: domain.RestaurantDecisionMostLikes, DecidedAt: now,
			Restaurant: domain.RestaurantCandidate{
				RestaurantID: "J001", Name: "店舗名", Latitude: &latitude, Longitude: &longitude,
				Source: domain.RestaurantSourceHotPepper,
			},
		},
	}}
	router := gin.New()
	router.PUT("/api/v1/rooms/:roomKey/restaurant-votes", NewRestaurantVotingHandler(stub).Submit)
	request := httptest.NewRequest(http.MethodPut, "/api/v1/rooms/"+roomID+"/restaurant-votes", strings.NewReader(validRestaurantVotingRequest))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer token")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK || len(stub.votes) != 2 {
		t.Fatalf("status = %d, votes = %d, body = %s", recorder.Code, len(stub.votes), recorder.Body.String())
	}
	var response restaurantVotingResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if response.Data.Result == nil || response.Data.Result.Restaurant.ID != "J001" ||
		response.Data.Result.Restaurant.Coordinates == nil || response.Data.Result.Restaurant.Coordinates.Latitude != latitude {
		t.Fatalf("response = %+v", response.Data)
	}
	if strings.Contains(recorder.Body.String(), "google") {
		t.Fatalf("Google Maps URL must not be present: %s", recorder.Body.String())
	}
}

func TestRestaurantVotingHandlerErrors(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, test := range []struct {
		name          string
		method        string
		authorization string
		body          string
		serviceError  error
		wantStatus    int
		wantCode      string
	}{
		{name: "missing authorization", method: http.MethodPut, body: validRestaurantVotingRequest, wantStatus: http.StatusUnauthorized, wantCode: "UNAUTHORIZED"},
		{name: "invalid body", method: http.MethodPut, authorization: "Bearer token", body: `{}`, wantStatus: http.StatusBadRequest, wantCode: "INVALID_RESTAURANT_VOTES"},
		{name: "candidate mismatch", method: http.MethodPut, authorization: "Bearer token", body: validRestaurantVotingRequest, serviceError: service.ErrRestaurantCandidatesMismatch, wantStatus: http.StatusConflict, wantCode: "RESTAURANT_CANDIDATES_MISMATCH"},
		{name: "already submitted", method: http.MethodPut, authorization: "Bearer token", body: validRestaurantVotingRequest, serviceError: service.ErrVoteAlreadySubmitted, wantStatus: http.StatusConflict, wantCode: "VOTE_ALREADY_SUBMITTED"},
		{name: "inactive", method: http.MethodPut, authorization: "Bearer token", body: validRestaurantVotingRequest, serviceError: service.ErrRestaurantVotingNotActive, wantStatus: http.StatusConflict, wantCode: "RESTAURANT_VOTING_NOT_ACTIVE"},
		{name: "not ready", method: http.MethodGet, authorization: "Bearer token", serviceError: service.ErrRestaurantVotingNotReady, wantStatus: http.StatusConflict, wantCode: "RESTAURANT_VOTING_NOT_READY"},
		{name: "forbidden", method: http.MethodGet, authorization: "Bearer token", serviceError: service.ErrForbidden, wantStatus: http.StatusForbidden, wantCode: "FORBIDDEN"},
		{name: "not found", method: http.MethodGet, authorization: "Bearer token", serviceError: service.ErrRoomNotFound, wantStatus: http.StatusNotFound, wantCode: "ROOM_NOT_FOUND"},
		{name: "timeout", method: http.MethodGet, authorization: "Bearer token", serviceError: context.DeadlineExceeded, wantStatus: http.StatusServiceUnavailable, wantCode: "SERVICE_UNAVAILABLE"},
		{name: "internal", method: http.MethodPut, authorization: "Bearer token", body: validRestaurantVotingRequest, serviceError: errors.New("database secret"), wantStatus: http.StatusInternalServerError, wantCode: "INTERNAL_ERROR"},
	} {
		t.Run(test.name, func(t *testing.T) {
			stub := &restaurantVotingUseCaseStub{error: test.serviceError}
			router := gin.New()
			handler := NewRestaurantVotingHandler(stub)
			if test.method == http.MethodGet {
				router.GET("/api/v1/rooms/:roomKey/restaurant-voting", handler.GetState)
			} else {
				router.PUT("/api/v1/rooms/:roomKey/restaurant-votes", handler.Submit)
			}
			path := "/api/v1/rooms/550e8400-e29b-41d4-a716-446655440000/restaurant-votes"
			if test.method == http.MethodGet {
				path = "/api/v1/rooms/550e8400-e29b-41d4-a716-446655440000/restaurant-voting"
			}
			request := httptest.NewRequest(test.method, path, strings.NewReader(test.body))
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
