package postgres_test

import (
	"bytes"
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
	created, err := roomService.Create(ctx, service.CreateRoomInput{Nickname: "同名", Latitude: 35.658, Longitude: 139.7016, SearchRange: 3})
	if err != nil {
		t.Fatalf("create room: %v", err)
	}
	var latitude float64
	var longitude float64
	var searchRange int
	if err := pool.QueryRow(ctx, `
		SELECT latitude, longitude, search_range
		FROM room_search_conditions
		WHERE room_id = $1
	`, created.Room.ID).Scan(&latitude, &longitude, &searchRange); err != nil {
		t.Fatalf("find room search condition: %v", err)
	}
	if latitude != 35.658 || longitude != 139.7016 || searchRange != 3 {
		t.Fatalf("search condition = latitude:%v longitude:%v range:%d", latitude, longitude, searchRange)
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

func TestRoomStartGenreVotingConcurrencyIntegration(t *testing.T) {
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
	created, err := roomService.Create(ctx, service.CreateRoomInput{Nickname: "ホスト", Latitude: 35.658, Longitude: 139.7016, SearchRange: 3})
	if err != nil {
		t.Fatalf("create room: %v", err)
	}
	t.Cleanup(func() {
		if _, err := pool.Exec(context.Background(), "DELETE FROM rooms WHERE id = $1", created.Room.ID); err != nil {
			t.Errorf("clean up room: %v", err)
		}
	})
	if _, err := roomService.Join(ctx, created.Room.JoinCode, "先行メンバー"); err != nil {
		t.Fatalf("join initial member: %v", err)
	}

	startLine := make(chan struct{})
	var waitGroup sync.WaitGroup
	var started service.GetRoomStateResult
	var startError error
	var concurrentJoinError error
	waitGroup.Add(2)
	go func() {
		defer waitGroup.Done()
		<-startLine
		started, startError = roomService.StartGenreVoting(ctx, created.Room.ID, created.SessionToken)
	}()
	go func() {
		defer waitGroup.Done()
		<-startLine
		_, concurrentJoinError = roomService.Join(ctx, created.Room.JoinCode, "同時メンバー")
	}()
	close(startLine)
	waitGroup.Wait()

	if startError != nil {
		t.Fatalf("start genre voting: %v", startError)
	}
	expectedParticipantCount := 2
	if concurrentJoinError == nil {
		expectedParticipantCount = 3
	} else if !errors.Is(concurrentJoinError, service.ErrRoomNotJoinable) {
		t.Fatalf("concurrent join error = %v", concurrentJoinError)
	}
	if started.Room.Status != domain.RoomStatusGenreVoting || len(started.Participants) != expectedParticipantCount {
		t.Fatalf("started state = %+v, expected participants = %d", started, expectedParticipantCount)
	}

	repeated, err := roomService.StartGenreVoting(ctx, created.Room.ID, created.SessionToken)
	if err != nil {
		t.Fatalf("repeat start genre voting: %v", err)
	}
	if repeated.Room.Version != started.Room.Version || len(repeated.Participants) != expectedParticipantCount {
		t.Fatalf("repeated state = %+v, started state = %+v", repeated, started)
	}
	if _, err := roomService.Join(ctx, created.Room.JoinCode, "開始後メンバー"); !errors.Is(err, service.ErrRoomNotJoinable) {
		t.Fatalf("join after start error = %v, want ErrRoomNotJoinable", err)
	}
}

const integrationTestEnvironment = "INTEGRATION_TEST"

func TestRoomCreateIdempotencyConcurrencyIntegration(t *testing.T) {
	if os.Getenv(integrationTestEnvironment) != "1" {
		t.Skip("set INTEGRATION_TEST=1 to run PostgreSQL integration tests")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, "")
	if err != nil {
		t.Fatalf("connect to PostgreSQL: %v", err)
	}
	t.Cleanup(pool.Close)

	idempotencyHMACKey := bytes.Repeat([]byte{0x61}, security.MinIdempotencyHMACKeyBytes)
	roomService := service.NewRoomService(
		roompostgres.NewRoomRepository(pool), security.RandomGenerator{}, service.SystemClock{},
		service.WithRoomIdempotencyKey(idempotencyHMACKey),
	)
	if _, err := pool.Exec(ctx, `
		INSERT INTO room_idempotency_requests (operation, key_hash, request_fingerprint, state)
		VALUES ('create_room', decode('00', 'hex'), decode(repeat('00', 32), 'hex'), 'pending')
	`); err == nil {
		t.Fatal("invalid key hash bypassed room_idempotency_requests CHECK constraint")
	}
	const requestCount = 8
	const idempotencyKey = "550e8400-e29b-41d4-a716-446655440100"
	results := make(chan service.CreateRoomResult, requestCount)
	errorsByRequest := make(chan error, requestCount)
	startLine := make(chan struct{})
	var waitGroup sync.WaitGroup
	for range requestCount {
		waitGroup.Add(1)
		go func() {
			defer waitGroup.Done()
			<-startLine
			result, requestError := roomService.CreateWithIdempotency(ctx, service.CreateRoomInput{
				Nickname: "同名", Latitude: 35.658, Longitude: 139.7016, SearchRange: 3,
			}, idempotencyKey)
			results <- result
			errorsByRequest <- requestError
		}()
	}
	close(startLine)
	waitGroup.Wait()
	close(results)
	close(errorsByRequest)

	for requestError := range errorsByRequest {
		if requestError != nil {
			t.Fatalf("create room: %v", requestError)
		}
	}
	var expected service.CreateRoomResult
	for result := range results {
		if expected.Room.ID == "" {
			expected = result
			defer func(roomID string) {
				if _, cleanupError := pool.Exec(context.Background(), "DELETE FROM rooms WHERE id = $1", roomID); cleanupError != nil {
					t.Errorf("clean up room: %v", cleanupError)
				}
			}(result.Room.ID)
			continue
		}
		if result.Room != expected.Room || result.Participant != expected.Participant || result.SessionToken != expected.SessionToken {
			t.Fatalf("idempotent create returned different results: got %+v, want %+v", result, expected)
		}
	}

	var roomCount int
	var participantCount int
	var requestRowCount int
	var storedKeyHash []byte
	if err := pool.QueryRow(ctx, "SELECT COUNT(*) FROM rooms WHERE id = $1", expected.Room.ID).Scan(&roomCount); err != nil {
		t.Fatalf("count rooms: %v", err)
	}
	if err := pool.QueryRow(ctx, "SELECT COUNT(*) FROM participants WHERE room_id = $1", expected.Room.ID).Scan(&participantCount); err != nil {
		t.Fatalf("count participants: %v", err)
	}
	if err := pool.QueryRow(ctx, "SELECT COUNT(*) FROM room_idempotency_requests WHERE room_id = $1", expected.Room.ID).Scan(&requestRowCount); err != nil {
		t.Fatalf("count idempotency requests: %v", err)
	}
	if err := pool.QueryRow(ctx, "SELECT key_hash FROM room_idempotency_requests WHERE room_id = $1", expected.Room.ID).Scan(&storedKeyHash); err != nil {
		t.Fatalf("read stored key hash: %v", err)
	}
	if roomCount != 1 || participantCount != 1 || requestRowCount != 1 {
		t.Fatalf("stored counts = rooms:%d participants:%d requests:%d", roomCount, participantCount, requestRowCount)
	}
	if len(storedKeyHash) != 32 || bytes.Equal(storedKeyHash, []byte(idempotencyKey)) {
		t.Fatalf("stored key hash has unsafe representation: length = %d", len(storedKeyHash))
	}
	if _, err := pool.Exec(ctx, "DELETE FROM rooms WHERE id = $1", expected.Room.ID); err != nil {
		t.Fatalf("delete room for cascade verification: %v", err)
	}
	if err := pool.QueryRow(ctx, "SELECT COUNT(*) FROM room_idempotency_requests WHERE room_id = $1", expected.Room.ID).Scan(&requestRowCount); err != nil {
		t.Fatalf("count idempotency requests after room delete: %v", err)
	}
	if requestRowCount != 0 {
		t.Fatalf("idempotency requests after room delete = %d, want 0", requestRowCount)
	}
}

func TestRoomJoinIdempotencyIntegration(t *testing.T) {
	if os.Getenv(integrationTestEnvironment) != "1" {
		t.Skip("set INTEGRATION_TEST=1 to run PostgreSQL integration tests")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, "")
	if err != nil {
		t.Fatalf("connect to PostgreSQL: %v", err)
	}
	t.Cleanup(pool.Close)

	idempotencyHMACKey := bytes.Repeat([]byte{0x62}, security.MinIdempotencyHMACKeyBytes)
	roomService := service.NewRoomService(
		roompostgres.NewRoomRepository(pool), security.RandomGenerator{}, service.SystemClock{},
		service.WithRoomIdempotencyKey(idempotencyHMACKey),
	)
	created, err := roomService.Create(ctx, service.CreateRoomInput{
		Nickname: "ホスト", Latitude: 35.658, Longitude: 139.7016, SearchRange: 3,
	})
	if err != nil {
		t.Fatalf("create room: %v", err)
	}
	t.Cleanup(func() {
		if _, cleanupError := pool.Exec(context.Background(), "DELETE FROM rooms WHERE id = $1", created.Room.ID); cleanupError != nil {
			t.Errorf("clean up room: %v", cleanupError)
		}
	})

	const requestCount = 8
	const firstKey = "550e8400-e29b-41d4-a716-446655440101"
	results := make(chan service.JoinRoomResult, requestCount)
	errorsByRequest := make(chan error, requestCount)
	startLine := make(chan struct{})
	var waitGroup sync.WaitGroup
	for range requestCount {
		waitGroup.Add(1)
		go func() {
			defer waitGroup.Done()
			<-startLine
			result, requestError := roomService.JoinWithIdempotency(ctx, created.Room.JoinCode, "同名", firstKey)
			results <- result
			errorsByRequest <- requestError
		}()
	}
	close(startLine)
	waitGroup.Wait()
	close(results)
	close(errorsByRequest)
	for requestError := range errorsByRequest {
		if requestError != nil {
			t.Fatalf("join room: %v", requestError)
		}
	}

	var expected service.JoinRoomResult
	for result := range results {
		if expected.Participant.ID == "" {
			expected = result
			continue
		}
		if result.Room != expected.Room || result.Participant != expected.Participant || result.SessionToken != expected.SessionToken {
			t.Fatalf("idempotent join returned different results: got %+v, want %+v", result, expected)
		}
	}

	const secondKey = "550e8400-e29b-41d4-a716-446655440102"
	separateMember, err := roomService.JoinWithIdempotency(ctx, created.Room.JoinCode, "同名", secondKey)
	if err != nil {
		t.Fatalf("join same nickname with another key: %v", err)
	}
	if separateMember.Participant.ID == expected.Participant.ID {
		t.Fatal("different idempotency keys returned the same participant")
	}
	if _, err := roomService.JoinWithIdempotency(ctx, created.Room.JoinCode, "別名", firstKey); !errors.Is(err, service.ErrIdempotencyConflict) {
		t.Fatalf("reuse key with another payload error = %v, want ErrIdempotencyConflict", err)
	}

	if _, err := roomService.StartGenreVoting(ctx, created.Room.ID, created.SessionToken); err != nil {
		t.Fatalf("start genre voting: %v", err)
	}
	replayed, err := roomService.JoinWithIdempotency(ctx, created.Room.JoinCode, "同名", firstKey)
	if err != nil {
		t.Fatalf("replay join after room transition: %v", err)
	}
	if !replayed.IdempotencyReplayed || replayed.Participant.ID != expected.Participant.ID || replayed.Room.Status != domain.RoomStatusLobby {
		t.Fatalf("replayed result = %+v", replayed)
	}

	var participantCount int
	if err := pool.QueryRow(ctx, "SELECT COUNT(*) FROM participants WHERE room_id = $1", created.Room.ID).Scan(&participantCount); err != nil {
		t.Fatalf("count participants: %v", err)
	}
	if participantCount != 3 {
		t.Fatalf("participant count = %d, want 3", participantCount)
	}
}

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
	created, err := roomService.Create(ctx, service.CreateRoomInput{Nickname: "同名", Latitude: 35.658, Longitude: 139.7016, SearchRange: 3})
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
