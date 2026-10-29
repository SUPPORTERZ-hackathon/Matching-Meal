package postgres_test

import (
	"context"
	"errors"
	"os"
	"sort"
	"sync"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"meal/backend/internal/domain"
	roompostgres "meal/backend/internal/repository/postgres"
	"meal/backend/internal/security"
	"meal/backend/internal/service"
)

func TestRoomStateIntegration(t *testing.T) {
	if os.Getenv(integrationTestEnvironment) != "1" {
		t.Skip("set INTEGRATION_TEST=1 to run PostgreSQL integration tests")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, "")
	if err != nil {
		t.Fatalf("connect to PostgreSQL: %v", err)
	}
	t.Cleanup(pool.Close)

	repository := roompostgres.NewRoomRepository(pool)
	roomService := service.NewRoomService(repository, security.RandomGenerator{}, service.SystemClock{})
	created, err := roomService.Create(ctx, "同名")
	if err != nil {
		t.Fatalf("create room: %v", err)
	}
	t.Cleanup(func() {
		if _, err := pool.Exec(context.Background(), "DELETE FROM rooms WHERE id = $1", created.Room.ID); err != nil {
			t.Errorf("clean up room: %v", err)
		}
	})

	joined, err := roomService.Join(ctx, created.Room.JoinCode, "同名")
	if err != nil {
		t.Fatalf("join room: %v", err)
	}
	state, err := roomService.GetState(ctx, created.Room.ID, joined.SessionToken)
	if err != nil {
		t.Fatalf("get room state: %v", err)
	}
	if state.CurrentParticipantID != joined.Participant.ID {
		t.Fatalf("current participant id = %q, want %q", state.CurrentParticipantID, joined.Participant.ID)
	}
	if state.Room.Version != 2 || len(state.Participants) != 2 {
		t.Fatalf("room state = %+v", state)
	}
	if state.Participants[0].Nickname != "同名" || state.Participants[1].Nickname != "同名" {
		t.Fatalf("participant nicknames = %+v", state.Participants)
	}
	if !sort.SliceIsSorted(state.Participants, func(left int, right int) bool {
		if state.Participants[left].JoinedAt.Equal(state.Participants[right].JoinedAt) {
			return state.Participants[left].ID < state.Participants[right].ID
		}
		return state.Participants[left].JoinedAt.Before(state.Participants[right].JoinedAt)
	}) {
		t.Fatalf("participants are not sorted: %+v", state.Participants)
	}
}

const integrationTestEnvironment = "INTEGRATION_TEST"

func TestRoomJoinConcurrencyIntegration(t *testing.T) {
	if os.Getenv(integrationTestEnvironment) != "1" {
		t.Skip("set INTEGRATION_TEST=1 to run PostgreSQL integration tests")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, "")
	if err != nil {
		t.Fatalf("connect to PostgreSQL: %v", err)
	}
	t.Cleanup(pool.Close)

	repository := roompostgres.NewRoomRepository(pool)
	roomService := service.NewRoomService(repository, security.RandomGenerator{}, service.SystemClock{})
	created, err := roomService.Create(ctx, "同名")
	if err != nil {
		t.Fatalf("create room: %v", err)
	}
	t.Cleanup(func() {
		if _, err := pool.Exec(context.Background(), "DELETE FROM rooms WHERE id = $1", created.Room.ID); err != nil {
			t.Errorf("clean up room: %v", err)
		}
	})

	joinAttempts := domain.MaxRoomParticipants + 5
	errorsByAttempt := make(chan error, joinAttempts)
	var waitGroup sync.WaitGroup
	for range joinAttempts {
		waitGroup.Add(1)
		go func() {
			defer waitGroup.Done()
			_, err := roomService.Join(ctx, created.Room.JoinCode, "同名")
			errorsByAttempt <- err
		}()
	}
	waitGroup.Wait()
	close(errorsByAttempt)

	successCount := 0
	capacityErrorCount := 0
	for err := range errorsByAttempt {
		switch {
		case err == nil:
			successCount++
		case errors.Is(err, service.ErrRoomCapacityReached):
			capacityErrorCount++
		default:
			t.Fatalf("join room: unexpected error %v", err)
		}
	}
	expectedSuccesses := domain.MaxRoomParticipants - 1
	if successCount != expectedSuccesses {
		t.Fatalf("successful joins = %d, want %d", successCount, expectedSuccesses)
	}
	if capacityErrorCount != joinAttempts-expectedSuccesses {
		t.Fatalf("capacity errors = %d, want %d", capacityErrorCount, joinAttempts-expectedSuccesses)
	}

	var participantCount int
	var distinctParticipantCount int
	var allTokenHashesValid bool
	if err := pool.QueryRow(ctx, `
		SELECT COUNT(*), COUNT(DISTINCT id), bool_and(octet_length(session_token_hash) = 32)
		FROM participants
		WHERE room_id = $1
	`, created.Room.ID).Scan(&participantCount, &distinctParticipantCount, &allTokenHashesValid); err != nil {
		t.Fatalf("inspect participants: %v", err)
	}
	if participantCount != domain.MaxRoomParticipants || distinctParticipantCount != domain.MaxRoomParticipants {
		t.Fatalf("participant counts = %d/%d, want %d", participantCount, distinctParticipantCount, domain.MaxRoomParticipants)
	}
	if !allTokenHashesValid {
		t.Fatal("one or more participant token hashes are not 32 bytes")
	}

	var roomVersion int64
	if err := pool.QueryRow(ctx, "SELECT version FROM rooms WHERE id = $1", created.Room.ID).Scan(&roomVersion); err != nil {
		t.Fatalf("inspect room version: %v", err)
	}
	if roomVersion != int64(domain.MaxRoomParticipants) {
		t.Fatalf("room version = %d, want %d", roomVersion, domain.MaxRoomParticipants)
	}
}
