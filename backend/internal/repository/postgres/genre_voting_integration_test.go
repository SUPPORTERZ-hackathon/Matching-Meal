package postgres_test

import (
	"context"
	"errors"
	"os"
	"sync"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"meal/backend/internal/domain"
	"meal/backend/internal/repository"
	roompostgres "meal/backend/internal/repository/postgres"
	"meal/backend/internal/security"
	"meal/backend/internal/service"
)

type fixedIndexSelector struct {
	index int
}

func TestGenreVoteSubmissionRollbackIntegration(t *testing.T) {
	if os.Getenv(integrationTestEnvironment) != "1" {
		t.Skip("set INTEGRATION_TEST=1 to run PostgreSQL integration tests")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, "")
	if err != nil {
		t.Fatalf("connect to PostgreSQL: %v", err)
	}
	t.Cleanup(pool.Close)
	roomRepository := roompostgres.NewRoomRepository(pool)
	roomService := service.NewRoomService(roomRepository, security.RandomGenerator{}, service.SystemClock{})
	created, err := roomService.Create(ctx, "ロールバック検証")
	if err != nil {
		t.Fatalf("create room: %v", err)
	}
	t.Cleanup(func() {
		if _, err := pool.Exec(context.Background(), "DELETE FROM rooms WHERE id = $1", created.Room.ID); err != nil {
			t.Errorf("clean up room: %v", err)
		}
	})

	votes := integrationGenreVotes("ramen")
	votes[len(votes)-1].Choice = "invalid"
	genreRepository := roompostgres.NewGenreVotingRepository(pool)
	err = genreRepository.WithinTransaction(ctx, func(transaction repository.GenreVotingTransaction) error {
		_, err := transaction.InsertSubmission(ctx, created.Participant.ID, votes)
		return err
	})
	if err == nil {
		t.Fatal("invalid vote insertion unexpectedly succeeded")
	}
	var submissions int
	var storedVotes int
	if err := pool.QueryRow(ctx, `
		SELECT
			(SELECT COUNT(*) FROM genre_vote_submissions WHERE participant_id = $1),
			(SELECT COUNT(*) FROM genre_votes WHERE participant_id = $1)
	`, created.Participant.ID).Scan(&submissions, &storedVotes); err != nil {
		t.Fatalf("inspect rollback: %v", err)
	}
	if submissions != 0 || storedVotes != 0 {
		t.Fatalf("partial submission remained: submission=%d votes=%d", submissions, storedVotes)
	}
}

func (selector fixedIndexSelector) SelectIndex(upperBound int) (int, error) {
	if selector.index < 0 || selector.index >= upperBound {
		return 0, errors.New("fixed index is outside candidates")
	}
	return selector.index, nil
}

func integrationGenreVotes(likedGenreID string) []domain.GenreVote {
	votes := make([]domain.GenreVote, 0, domain.GenreCount)
	for _, genreID := range domain.GenreIDs() {
		choice := domain.GenreVoteChoiceSkip
		if genreID == likedGenreID {
			choice = domain.GenreVoteChoiceLike
		}
		votes = append(votes, domain.GenreVote{GenreID: genreID, Choice: choice})
	}
	return votes
}

func TestGenreVotingConcurrencyIntegration(t *testing.T) {
	if os.Getenv(integrationTestEnvironment) != "1" {
		t.Skip("set INTEGRATION_TEST=1 to run PostgreSQL integration tests")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, "")
	if err != nil {
		t.Fatalf("connect to PostgreSQL: %v", err)
	}
	t.Cleanup(pool.Close)

	roomRepository := roompostgres.NewRoomRepository(pool)
	genreRepository := roompostgres.NewGenreVotingRepository(pool)
	randomGenerator := security.RandomGenerator{}
	roomService := service.NewRoomService(roomRepository, randomGenerator, service.SystemClock{})
	genreService := service.NewGenreVotingService(genreRepository, roomRepository, fixedIndexSelector{index: 1}, service.SystemClock{})

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
	if _, err := roomService.StartGenreVoting(ctx, created.Room.ID, created.SessionToken); err != nil {
		t.Fatalf("start genre voting: %v", err)
	}

	start := make(chan struct{})
	errorsByParticipant := make(chan error, 2)
	var waitGroup sync.WaitGroup
	for _, submission := range []struct {
		token string
		votes []domain.GenreVote
	}{
		{token: created.SessionToken, votes: integrationGenreVotes("ramen")},
		{token: joined.SessionToken, votes: integrationGenreVotes("sushi-seafood")},
	} {
		waitGroup.Add(1)
		go func(token string, votes []domain.GenreVote) {
			defer waitGroup.Done()
			<-start
			_, err := genreService.Submit(ctx, created.Room.ID, token, votes)
			errorsByParticipant <- err
		}(submission.token, submission.votes)
	}
	close(start)
	waitGroup.Wait()
	close(errorsByParticipant)
	for err := range errorsByParticipant {
		if err != nil {
			t.Fatalf("submit genre votes: %v", err)
		}
	}

	state, err := genreService.GetState(ctx, created.Room.ID, created.SessionToken)
	if err != nil {
		t.Fatalf("get genre voting state: %v", err)
	}
	if state.Room.Status != domain.RoomStatusRestaurantSearching || state.Room.Version != 5 {
		t.Fatalf("room = %+v", state.Room)
	}
	if state.SubmittedParticipantCount != 2 || state.TotalParticipantCount != 2 || len(state.Participants) != 2 {
		t.Fatalf("state = %+v", state)
	}
	if state.Result == nil || state.Result.GenreID != "sushi-seafood" || state.Result.LikeCount != 1 || state.Result.DecisionMethod != domain.GenreDecisionRandomTie {
		t.Fatalf("result = %+v", state.Result)
	}

	repeated, err := genreService.Submit(ctx, created.Room.ID, created.SessionToken, integrationGenreVotes("ramen"))
	if err != nil {
		t.Fatalf("repeat same submission: %v", err)
	}
	if repeated.Room.Version != state.Room.Version || repeated.Result == nil || repeated.Result.GenreID != state.Result.GenreID {
		t.Fatalf("repeated state = %+v, original = %+v", repeated, state)
	}
	if _, err := genreService.Submit(ctx, created.Room.ID, created.SessionToken, integrationGenreVotes("cafe")); !errors.Is(err, service.ErrVoteAlreadySubmitted) {
		t.Fatalf("different retry error = %v", err)
	}

	var submissionCount int
	var voteCount int
	var resultCount int
	if err := pool.QueryRow(ctx, `
		SELECT
			(SELECT COUNT(*) FROM genre_vote_submissions s JOIN participants p ON p.id = s.participant_id WHERE p.room_id = $1),
			(SELECT COUNT(*) FROM genre_votes v JOIN participants p ON p.id = v.participant_id WHERE p.room_id = $1),
			(SELECT COUNT(*) FROM genre_vote_results WHERE room_id = $1)
	`, created.Room.ID).Scan(&submissionCount, &voteCount, &resultCount); err != nil {
		t.Fatalf("inspect stored votes: %v", err)
	}
	if submissionCount != 2 || voteCount != 2*domain.GenreCount || resultCount != 1 {
		t.Fatalf("stored counts = submissions:%d votes:%d results:%d", submissionCount, voteCount, resultCount)
	}
}
