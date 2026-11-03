package httptransport

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"meal/backend/internal/domain"
	"meal/backend/internal/hotpepper"
	"meal/backend/internal/repository"
	"meal/backend/internal/service"
)

const restaurantHandlerRoomID = "550e8400-e29b-41d4-a716-446655440000"

type restaurantHandlerRoomRepository struct {
	participant domain.Participant
}

func (stub restaurantHandlerRoomRepository) Create(context.Context, repository.CreateRoomParams) (domain.Room, domain.Participant, error) {
	return domain.Room{}, domain.Participant{}, errors.New("unexpected create")
}
func (stub restaurantHandlerRoomRepository) FindParticipantBySessionTokenHash(context.Context, []byte) (domain.Participant, error) {
	return stub.participant, nil
}
func (stub restaurantHandlerRoomRepository) FindStateByID(context.Context, string) (domain.Room, []domain.Participant, error) {
	return domain.Room{}, nil, errors.New("unexpected state lookup")
}
func (stub restaurantHandlerRoomRepository) WithinTransaction(context.Context, func(repository.RoomTransaction) error) error {
	return errors.New("unexpected transaction")
}

type restaurantHandlerRepository struct {
	searchContext domain.RestaurantSearchContext
}

func (stub *restaurantHandlerRepository) FindContext(context.Context, string) (domain.RestaurantSearchContext, error) {
	return stub.searchContext, nil
}
func (stub *restaurantHandlerRepository) SaveCandidatesAndAdvance(_ context.Context, roomID string, candidates []domain.RestaurantCandidate, _ time.Time) (domain.Room, []domain.RestaurantCandidate, error) {
	room := stub.searchContext.Room
	room.Status = domain.RoomStatusRestaurantVoting
	room.Version++
	for index := range candidates {
		candidates[index].RoomID = roomID
		candidates[index].Position = int16(index + 1)
	}
	return room, candidates, nil
}

type restaurantHandlerSearcher struct {
	candidates []domain.RestaurantCandidate
	err        error
}

func (stub restaurantHandlerSearcher) Search(context.Context, hotpepper.Query) ([]domain.RestaurantCandidate, error) {
	return stub.candidates, stub.err
}

type restaurantHandlerSelector struct{}

func (restaurantHandlerSelector) SelectIndex(int) (int, error) { return 0, nil }

type restaurantHandlerClock struct{ now time.Time }

func (clock restaurantHandlerClock) Now() time.Time { return clock.now }

func TestRegisterRestaurantSearchRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handler := newRestaurantHandler(domain.ParticipantRoleHost, nil, nil)
	router := gin.New()
	RegisterRestaurantSearchRoutes(router, handler)

	expected := map[string]bool{
		"POST /api/v1/rooms/:roomId/restaurant-candidates/search": false,
		"GET /api/v1/rooms/:roomId/restaurant-candidates":         false,
	}
	for _, route := range router.Routes() {
		key := route.Method + " " + route.Path
		if _, exists := expected[key]; exists {
			expected[key] = true
		}
	}
	for route, registered := range expected {
		if !registered {
			t.Fatalf("route %s was not registered", route)
		}
	}
}

func TestRestaurantSearchHandlerSearch(t *testing.T) {
	gin.SetMode(gin.TestMode)
	candidates := []domain.RestaurantCandidate{{RestaurantID: "J001", Name: "店舗", Source: "hotpepper"}}
	handler := newRestaurantHandler(domain.ParticipantRoleHost, candidates, nil)
	router := gin.New()
	router.POST("/api/v1/rooms/:roomId/restaurant-candidates/search", handler.Search)
	request := httptest.NewRequest(http.MethodPost, "/api/v1/rooms/"+restaurantHandlerRoomID+"/restaurant-candidates/search", nil)
	request.Header.Set("Authorization", "Bearer token")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d body = %s", recorder.Code, recorder.Body.String())
	}
	if body := recorder.Body.String(); !containsAll(body, `"id":"J001"`, `"status":"restaurant_voting"`, `"coordinates":null`, `"source":"hotpepper"`) {
		t.Fatalf("body = %s", body)
	}
}

func TestRestaurantSearchHandlerErrors(t *testing.T) {
	tests := []struct {
		name         string
		role         domain.ParticipantRole
		searchErr    error
		method       string
		expected     int
		expectedCode string
	}{
		{name: "host required", role: domain.ParticipantRoleMember, method: http.MethodPost, expected: http.StatusForbidden, expectedCode: "HOST_REQUIRED"},
		{name: "upstream failure", role: domain.ParticipantRoleHost, searchErr: hotpepper.ErrSearchFailed, method: http.MethodPost, expected: http.StatusBadGateway, expectedCode: "RESTAURANT_SEARCH_FAILED"},
		{name: "upstream timeout", role: domain.ParticipantRoleHost, searchErr: hotpepper.ErrSearchTimeout, method: http.MethodPost, expected: http.StatusGatewayTimeout, expectedCode: "RESTAURANT_SEARCH_TIMEOUT"},
		{name: "not ready", role: domain.ParticipantRoleMember, method: http.MethodGet, expected: http.StatusConflict, expectedCode: "RESTAURANT_CANDIDATES_NOT_READY"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			gin.SetMode(gin.TestMode)
			handler := newRestaurantHandler(test.role, nil, test.searchErr)
			router := gin.New()
			router.Handle(test.method, "/api/v1/rooms/:roomId/restaurant-candidates", func(context *gin.Context) {
				if test.method == http.MethodPost {
					handler.Search(context)
				} else {
					handler.Get(context)
				}
			})
			request := httptest.NewRequest(test.method, "/api/v1/rooms/"+restaurantHandlerRoomID+"/restaurant-candidates", nil)
			request.Header.Set("Authorization", "Bearer token")
			recorder := httptest.NewRecorder()
			router.ServeHTTP(recorder, request)
			if recorder.Code != test.expected || !containsAll(recorder.Body.String(), `"code":"`+test.expectedCode+`"`) {
				t.Fatalf("status = %d body = %s", recorder.Code, recorder.Body.String())
			}
		})
	}
}

func newRestaurantHandler(role domain.ParticipantRole, candidates []domain.RestaurantCandidate, searchError error) *RestaurantSearchHandler {
	now := time.Date(2026, time.October, 31, 10, 0, 0, 0, time.UTC)
	restaurantRepository := &restaurantHandlerRepository{searchContext: domain.RestaurantSearchContext{
		Room:            domain.Room{ID: restaurantHandlerRoomID, Status: domain.RoomStatusRestaurantSearching, Version: 4, ExpiresAt: now.Add(time.Hour)},
		SearchCondition: domain.RoomSearchCondition{RoomID: restaurantHandlerRoomID, Latitude: 35.658, Longitude: 139.7016, Range: 3},
		GenreID:         "ramen",
	}}
	roomRepository := restaurantHandlerRoomRepository{participant: domain.Participant{RoomID: restaurantHandlerRoomID, Role: role}}
	restaurantService := service.NewRestaurantSearchService(
		restaurantRepository, roomRepository, restaurantHandlerSearcher{candidates: candidates, err: searchError},
		restaurantHandlerSelector{}, restaurantHandlerClock{now: now},
	)
	return NewRestaurantSearchHandler(restaurantService)
}

func containsAll(value string, parts ...string) bool {
	for _, part := range parts {
		if !strings.Contains(value, part) {
			return false
		}
	}
	return true
}
