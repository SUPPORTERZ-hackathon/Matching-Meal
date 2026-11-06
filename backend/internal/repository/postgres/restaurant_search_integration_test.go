package postgres_test

import (
	"context"
	"fmt"
	"os"
	"sync"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"meal/backend/internal/domain"
	restaurantpostgres "meal/backend/internal/repository/postgres"
	"meal/backend/internal/security"
	"meal/backend/internal/service"
)

func TestRestaurantCandidatesConcurrencyIntegration(t *testing.T) {
	if os.Getenv(integrationTestEnvironment) != "1" {
		t.Skip("set INTEGRATION_TEST=1 to run PostgreSQL integration tests")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, "")
	if err != nil {
		t.Fatalf("connect to PostgreSQL: %v", err)
	}
	t.Cleanup(pool.Close)
	roomRepository := restaurantpostgres.NewRoomRepository(pool)
	roomService := service.NewRoomService(roomRepository, security.RandomGenerator{}, service.SystemClock{})
	created, err := roomService.Create(ctx, service.CreateRoomInput{
		Nickname: "店舗検索ホスト", Latitude: 35.658, Longitude: 139.7016, SearchRange: 3,
	})
	if err != nil {
		t.Fatalf("create room: %v", err)
	}
	t.Cleanup(func() {
		if _, err := pool.Exec(context.Background(), "DELETE FROM rooms WHERE id = $1", created.Room.ID); err != nil {
			t.Errorf("clean up room: %v", err)
		}
	})
	if _, err := pool.Exec(ctx, `
		INSERT INTO genre_vote_results (room_id, genre_id, like_count, decision_method)
		VALUES ($1, 'ramen', 1, 'most_likes')
	`, created.Room.ID); err != nil {
		t.Fatalf("insert genre result: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		UPDATE rooms SET status = 'restaurant_searching', version = version + 1 WHERE id = $1
	`, created.Room.ID); err != nil {
		t.Fatalf("advance room to restaurant searching: %v", err)
	}

	repository := restaurantpostgres.NewRestaurantSearchRepository(pool)
	firstCandidates := integrationRestaurantCandidates("A")
	secondCandidates := integrationRestaurantCandidates("B")
	now := (service.SystemClock{}).Now()
	start := make(chan struct{})
	var waitGroup sync.WaitGroup
	results := make([][]domain.RestaurantCandidate, 2)
	errorsByCall := make([]error, 2)
	waitGroup.Add(2)
	go func() {
		defer waitGroup.Done()
		<-start
		_, results[0], errorsByCall[0] = repository.SaveCandidatesAndAdvance(ctx, created.Room.ID, firstCandidates, now)
	}()
	go func() {
		defer waitGroup.Done()
		<-start
		_, results[1], errorsByCall[1] = repository.SaveCandidatesAndAdvance(ctx, created.Room.ID, secondCandidates, now)
	}()
	close(start)
	waitGroup.Wait()
	for index, saveError := range errorsByCall {
		if saveError != nil {
			t.Fatalf("save call %d: %v", index, saveError)
		}
	}
	if len(results[0]) != 5 || len(results[1]) != 5 || results[0][0].RestaurantID != results[1][0].RestaurantID {
		t.Fatalf("concurrent results differ: first=%+v second=%+v", results[0], results[1])
	}

	searchContext, err := repository.FindContext(ctx, created.Room.ID)
	if err != nil {
		t.Fatalf("find search context: %v", err)
	}
	if searchContext.Room.Status != domain.RoomStatusRestaurantVoting || searchContext.Room.Version != 3 {
		t.Fatalf("room = %+v", searchContext.Room)
	}
	if len(searchContext.Candidates) != 5 {
		t.Fatalf("candidate count = %d", len(searchContext.Candidates))
	}
	for index, candidate := range searchContext.Candidates {
		if candidate.Position != int16(index+1) || candidate.RoomID != created.Room.ID {
			t.Fatalf("candidate %d = %+v", index, candidate)
		}
		if candidate.Address == nil || *candidate.Address != fmt.Sprintf("東京都店舗%s%d", candidate.RestaurantID[1:2], index) {
			t.Fatalf("candidate address %d = %v", index, candidate.Address)
		}
	}

	_, err = pool.Exec(ctx, `
		INSERT INTO restaurant_candidates (room_id, restaurant_id, position, name, source)
		VALUES ($1, 'JINVALID', 6, '不正', 'hotpepper')
	`, created.Room.ID)
	if err == nil {
		t.Fatal("position 6 unexpectedly passed database constraint")
	}
}

func integrationRestaurantCandidates(prefix string) []domain.RestaurantCandidate {
	candidates := make([]domain.RestaurantCandidate, 0, domain.MaxRestaurantCandidates)
	for index := 0; index < domain.MaxRestaurantCandidates; index++ {
		address := fmt.Sprintf("東京都店舗%s%d", prefix, index)
		candidates = append(candidates, domain.RestaurantCandidate{
			RestaurantID: fmt.Sprintf("J%s%03d", prefix, index),
			Name:         fmt.Sprintf("店舗%s%d", prefix, index),
			Address:      &address,
			Source:       "hotpepper",
		})
	}
	return candidates
}
