package service

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"meal/backend/internal/domain"
	"meal/backend/internal/hotpepper"
)

const restaurantTestRoomID = "550e8400-e29b-41d4-a716-446655440000"

type restaurantSearchRepositoryStub struct {
	searchContext domain.RestaurantSearchContext
	findError     error
	saveError     error
	saveCalls     int
	saved         []domain.RestaurantCandidate
}

func (stub *restaurantSearchRepositoryStub) FindContext(context.Context, string) (domain.RestaurantSearchContext, error) {
	return stub.searchContext, stub.findError
}

func (stub *restaurantSearchRepositoryStub) SaveCandidatesAndAdvance(_ context.Context, roomID string, candidates []domain.RestaurantCandidate, _ time.Time) (domain.Room, []domain.RestaurantCandidate, error) {
	stub.saveCalls++
	stub.saved = append([]domain.RestaurantCandidate(nil), candidates...)
	if stub.saveError != nil {
		return domain.Room{}, nil, stub.saveError
	}
	room := stub.searchContext.Room
	room.Status = domain.RoomStatusRestaurantVoting
	room.Version++
	stored := append([]domain.RestaurantCandidate(nil), candidates...)
	for index := range stored {
		stored[index].RoomID = roomID
		stored[index].Position = int16(index + 1)
	}
	return room, stored, nil
}

type hotPepperSearcherStub struct {
	responses [][]domain.RestaurantCandidate
	errors    []error
	queries   []hotpepper.Query
}

func (stub *hotPepperSearcherStub) Search(_ context.Context, query hotpepper.Query) ([]domain.RestaurantCandidate, error) {
	stub.queries = append(stub.queries, query)
	index := len(stub.queries) - 1
	if index < len(stub.errors) && stub.errors[index] != nil {
		return nil, stub.errors[index]
	}
	if index >= len(stub.responses) {
		return nil, nil
	}
	return stub.responses[index], nil
}

type restaurantSelectorStub struct {
	bounds []int
	index  int
	err    error
}

func (stub *restaurantSelectorStub) SelectIndex(upperBound int) (int, error) {
	stub.bounds = append(stub.bounds, upperBound)
	return stub.index, stub.err
}

func TestRestaurantSearchServiceSearchSelectsFiveFromTen(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, time.October, 31, 10, 0, 0, 0, time.UTC)
	restaurantRepository := &restaurantSearchRepositoryStub{searchContext: validRestaurantSearchContext(now, "ramen")}
	roomRepository := &roomRepositoryStub{authenticatedParticipant: domain.Participant{
		ID: "host-id", RoomID: restaurantTestRoomID, Role: domain.ParticipantRoleHost,
	}}
	searcher := &hotPepperSearcherStub{responses: [][]domain.RestaurantCandidate{restaurantCandidates(10)}}
	selector := &restaurantSelectorStub{}
	searchService := NewRestaurantSearchService(restaurantRepository, roomRepository, searcher, selector, clockStub{now: now})

	result, err := searchService.Search(context.Background(), restaurantTestRoomID, "token")
	if err != nil {
		t.Fatalf("Search() error = %v", err)
	}
	if result.Room.Status != domain.RoomStatusRestaurantVoting || len(result.Candidates) != 5 || restaurantRepository.saveCalls != 1 {
		t.Fatalf("Search() result = %+v, save calls = %d", result, restaurantRepository.saveCalls)
	}
	if len(selector.bounds) != 5 {
		t.Fatalf("selector bounds = %v", selector.bounds)
	}
	expectedBounds := []int{10, 9, 8, 7, 6}
	for index := range expectedBounds {
		if selector.bounds[index] != expectedBounds[index] {
			t.Fatalf("selector bounds = %v", selector.bounds)
		}
	}
	if len(searcher.queries) != 1 || searcher.queries[0].GenreCode != "G013" || searcher.queries[0].Count != 100 {
		t.Fatalf("queries = %+v", searcher.queries)
	}
}

func TestRestaurantSearchServiceSearchMergesCompositeQueries(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, time.October, 31, 10, 0, 0, 0, time.UTC)
	restaurantRepository := &restaurantSearchRepositoryStub{searchContext: validRestaurantSearchContext(now, "sushi-seafood")}
	roomRepository := &roomRepositoryStub{authenticatedParticipant: domain.Participant{RoomID: restaurantTestRoomID, Role: domain.ParticipantRoleHost}}
	searcher := &hotPepperSearcherStub{responses: [][]domain.RestaurantCandidate{
		{{RestaurantID: "J001", Name: "寿司", Source: "hotpepper"}},
		{{RestaurantID: "J001", Name: "重複", Source: "hotpepper"}, {RestaurantID: "J002", Name: "海鮮", Source: "hotpepper"}},
	}}
	searchService := NewRestaurantSearchService(restaurantRepository, roomRepository, searcher, &restaurantSelectorStub{}, clockStub{now: now})

	result, err := searchService.Search(context.Background(), restaurantTestRoomID, "token")
	if err != nil {
		t.Fatalf("Search() error = %v", err)
	}
	if len(searcher.queries) != 2 || searcher.queries[0].Count != 50 || searcher.queries[1].Count != 50 {
		t.Fatalf("queries = %+v", searcher.queries)
	}
	if searcher.queries[0].Keyword != "寿司" || searcher.queries[1].Keyword != "海鮮" || len(result.Candidates) != 2 {
		t.Fatalf("queries = %+v, candidates = %+v", searcher.queries, result.Candidates)
	}
}

func TestRestaurantSearchServiceSearchReturnsSavedCandidatesWithoutExternalCall(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, time.October, 31, 10, 0, 0, 0, time.UTC)
	searchContext := validRestaurantSearchContext(now, "ramen")
	searchContext.Room.Status = domain.RoomStatusRestaurantVoting
	searchContext.Candidates = restaurantCandidates(5)
	restaurantRepository := &restaurantSearchRepositoryStub{searchContext: searchContext}
	roomRepository := &roomRepositoryStub{authenticatedParticipant: domain.Participant{RoomID: restaurantTestRoomID, Role: domain.ParticipantRoleHost}}
	searcher := &hotPepperSearcherStub{}
	searchService := NewRestaurantSearchService(restaurantRepository, roomRepository, searcher, &restaurantSelectorStub{}, clockStub{now: now})

	result, err := searchService.Search(context.Background(), restaurantTestRoomID, "token")
	if err != nil || len(result.Candidates) != 5 {
		t.Fatalf("Search() result = %+v, error = %v", result, err)
	}
	if len(searcher.queries) != 0 || restaurantRepository.saveCalls != 0 {
		t.Fatalf("external calls = %d, save calls = %d", len(searcher.queries), restaurantRepository.saveCalls)
	}
}

func TestRestaurantSearchServiceErrors(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, time.October, 31, 10, 0, 0, 0, time.UTC)
	tests := []struct {
		name        string
		role        domain.ParticipantRole
		status      domain.RoomStatus
		searchError error
		expected    error
	}{
		{name: "member cannot search", role: domain.ParticipantRoleMember, status: domain.RoomStatusRestaurantSearching, expected: ErrHostRequired},
		{name: "search not active", role: domain.ParticipantRoleHost, status: domain.RoomStatusGenreVoting, expected: ErrRestaurantSearchNotActive},
		{name: "no candidates", role: domain.ParticipantRoleHost, status: domain.RoomStatusRestaurantSearching, expected: ErrRestaurantCandidatesNotFound},
		{name: "external failure", role: domain.ParticipantRoleHost, status: domain.RoomStatusRestaurantSearching, searchError: hotpepper.ErrSearchFailed, expected: ErrRestaurantSearchFailed},
		{name: "external timeout", role: domain.ParticipantRoleHost, status: domain.RoomStatusRestaurantSearching, searchError: hotpepper.ErrSearchTimeout, expected: ErrRestaurantSearchTimeout},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			searchContext := validRestaurantSearchContext(now, "ramen")
			searchContext.Room.Status = test.status
			restaurantRepository := &restaurantSearchRepositoryStub{searchContext: searchContext}
			roomRepository := &roomRepositoryStub{authenticatedParticipant: domain.Participant{RoomID: restaurantTestRoomID, Role: test.role}}
			searcher := &hotPepperSearcherStub{errors: []error{test.searchError}}
			searchService := NewRestaurantSearchService(restaurantRepository, roomRepository, searcher, &restaurantSelectorStub{}, clockStub{now: now})
			_, err := searchService.Search(context.Background(), restaurantTestRoomID, "token")
			if !errors.Is(err, test.expected) {
				t.Fatalf("Search() error = %v, want %v", err, test.expected)
			}
		})
	}
}

func TestRestaurantSearchServiceGetNotReady(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, time.October, 31, 10, 0, 0, 0, time.UTC)
	restaurantRepository := &restaurantSearchRepositoryStub{searchContext: validRestaurantSearchContext(now, "ramen")}
	roomRepository := &roomRepositoryStub{authenticatedParticipant: domain.Participant{RoomID: restaurantTestRoomID, Role: domain.ParticipantRoleMember}}
	searchService := NewRestaurantSearchService(restaurantRepository, roomRepository, &hotPepperSearcherStub{}, &restaurantSelectorStub{}, clockStub{now: now})

	_, err := searchService.Get(context.Background(), restaurantTestRoomID, "token")
	if !errors.Is(err, ErrRestaurantCandidatesNotReady) {
		t.Fatalf("Get() error = %v, want ErrRestaurantCandidatesNotReady", err)
	}
}

func validRestaurantSearchContext(now time.Time, genreID string) domain.RestaurantSearchContext {
	return domain.RestaurantSearchContext{
		Room: domain.Room{
			ID: restaurantTestRoomID, Status: domain.RoomStatusRestaurantSearching,
			Version: 4, ExpiresAt: now.Add(time.Hour),
		},
		SearchCondition: domain.RoomSearchCondition{RoomID: restaurantTestRoomID, Latitude: 35.658, Longitude: 139.7016, Range: 3},
		GenreID:         genreID,
	}
}

func restaurantCandidates(count int) []domain.RestaurantCandidate {
	candidates := make([]domain.RestaurantCandidate, 0, count)
	for index := 0; index < count; index++ {
		candidates = append(candidates, domain.RestaurantCandidate{
			RestaurantID: fmt.Sprintf("J%03d", index), Name: fmt.Sprintf("店舗%d", index), Source: "hotpepper",
		})
	}
	return candidates
}
