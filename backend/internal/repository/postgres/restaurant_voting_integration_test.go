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
	restaurantpostgres "meal/backend/internal/repository/postgres"
	"meal/backend/internal/security"
	"meal/backend/internal/service"
)

func TestRestaurantVotingRepositoryIntegration(t *testing.T) {
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
		Nickname: "同名", Latitude: 35.658, Longitude: 139.7016, SearchRange: 3,
	})
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

	if _, err := pool.Exec(ctx, `
		INSERT INTO restaurant_candidates (room_id, restaurant_id, position, name, source)
		VALUES
			($1, 'JVOTE001', 1, '候補1', 'hotpepper'),
			($1, 'JVOTE002', 2, '候補2', 'hotpepper'),
			($1, 'JVOTE003', 3, '候補3', 'hotpepper')
	`, created.Room.ID); err != nil {
		t.Fatalf("insert restaurant voting candidates: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		UPDATE rooms SET status = 'restaurant_voting', version = version + 1 WHERE id = $1
	`, created.Room.ID); err != nil {
		t.Fatalf("advance room to restaurant voting: %v", err)
	}

	votingRepository := restaurantpostgres.NewRestaurantVotingRepository(pool)
	var candidates []domain.RestaurantCandidate
	err = votingRepository.WithinTransaction(ctx, func(transaction repository.RestaurantVotingTransaction) error {
		var transactionError error
		candidates, transactionError = transaction.ListCandidates(ctx, created.Room.ID)
		if transactionError != nil {
			return transactionError
		}
		hostVotes, transactionError := domain.NormalizeRestaurantVotes([]domain.RestaurantVote{
			{RestaurantID: "JVOTE003", Choice: domain.RestaurantVoteChoiceSkip},
			{RestaurantID: "JVOTE001", Choice: domain.RestaurantVoteChoiceLike},
			{RestaurantID: "JVOTE002", Choice: domain.RestaurantVoteChoiceLike},
		}, candidates)
		if transactionError != nil {
			return transactionError
		}
		if _, transactionError = transaction.InsertSubmission(ctx, created.Room.ID, created.Participant.ID, hostVotes); transactionError != nil {
			return transactionError
		}
		memberVotes, transactionError := domain.NormalizeRestaurantVotes([]domain.RestaurantVote{
			{RestaurantID: "JVOTE001", Choice: domain.RestaurantVoteChoiceLike},
			{RestaurantID: "JVOTE002", Choice: domain.RestaurantVoteChoiceSkip},
			{RestaurantID: "JVOTE003", Choice: domain.RestaurantVoteChoiceSkip},
		}, candidates)
		if transactionError != nil {
			return transactionError
		}
		if _, transactionError = transaction.InsertSubmission(ctx, created.Room.ID, joined.Participant.ID, memberVotes); transactionError != nil {
			return transactionError
		}

		participantCount, transactionError := transaction.CountParticipants(ctx, created.Room.ID)
		if transactionError != nil {
			return transactionError
		}
		submissionCount, transactionError := transaction.CountSubmissions(ctx, created.Room.ID)
		if transactionError != nil {
			return transactionError
		}
		if participantCount != 2 || submissionCount != 2 {
			t.Fatalf("counts = participants:%d submissions:%d", participantCount, submissionCount)
		}

		counts, transactionError := transaction.AggregateLikeCounts(ctx, created.Room.ID, candidates)
		if transactionError != nil {
			return transactionError
		}
		winnerIDs, likeCount, method, transactionError := domain.RestaurantWinnerCandidates(candidates, counts)
		if transactionError != nil {
			return transactionError
		}
		if len(winnerIDs) != 1 || winnerIDs[0] != "JVOTE001" || likeCount != 2 || method != domain.RestaurantDecisionMostLikes {
			t.Fatalf("winner = %v, count=%d, method=%q", winnerIDs, likeCount, method)
		}
		if _, transactionError = transaction.InsertResult(ctx, domain.RestaurantVoteResult{
			RoomID: created.Room.ID, RestaurantID: winnerIDs[0], LikeCount: likeCount, DecisionMethod: method,
		}); transactionError != nil {
			return transactionError
		}
		_, transactionError = transaction.AdvanceToDecided(ctx, created.Room.ID)
		return transactionError
	})
	if err != nil {
		t.Fatalf("store and aggregate restaurant votes: %v", err)
	}

	state, err := votingRepository.FindState(ctx, created.Room.ID, created.Participant.ID)
	if err != nil {
		t.Fatalf("find restaurant voting state: %v", err)
	}
	if state.Room.Status != domain.RoomStatusDecided || state.SubmittedParticipantCount != 2 || state.TotalParticipantCount != 2 {
		t.Fatalf("state = %+v", state)
	}
	if !state.Submitted || state.SubmittedAt == nil || len(state.Participants) != 2 {
		t.Fatalf("current participant state = %+v", state)
	}
	if state.Result == nil || state.Result.RestaurantID != "JVOTE001" || state.Result.LikeCount != 2 ||
		state.Result.DecisionMethod != domain.RestaurantDecisionMostLikes || state.Result.Restaurant.Name != "候補1" {
		t.Fatalf("result = %+v", state.Result)
	}

	err = votingRepository.WithinTransaction(ctx, func(transaction repository.RestaurantVotingTransaction) error {
		stored, submittedAt, transactionError := transaction.FindSubmission(ctx, created.Room.ID, created.Participant.ID, candidates)
		if transactionError != nil {
			return transactionError
		}
		if submittedAt == nil || len(stored) != len(candidates) || stored[0].RestaurantID != "JVOTE001" {
			t.Fatalf("stored submission = %+v, submittedAt=%v", stored, submittedAt)
		}
		return nil
	})
	if err != nil {
		t.Fatalf("read stored restaurant submission: %v", err)
	}
}

func TestRestaurantVoteSubmissionRollbackAndRoomConstraintsIntegration(t *testing.T) {
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
	first, err := roomService.Create(ctx, service.CreateRoomInput{
		Nickname: "制約1", Latitude: 35.658, Longitude: 139.7016, SearchRange: 3,
	})
	if err != nil {
		t.Fatalf("create first room: %v", err)
	}
	second, err := roomService.Create(ctx, service.CreateRoomInput{
		Nickname: "制約2", Latitude: 35.658, Longitude: 139.7016, SearchRange: 3,
	})
	if err != nil {
		t.Fatalf("create second room: %v", err)
	}
	t.Cleanup(func() {
		if _, err := pool.Exec(context.Background(), "DELETE FROM rooms WHERE id IN ($1, $2)", first.Room.ID, second.Room.ID); err != nil {
			t.Errorf("clean up rooms: %v", err)
		}
	})
	if _, err := pool.Exec(ctx, `
		INSERT INTO restaurant_candidates (room_id, restaurant_id, position, name, source)
		VALUES ($1, 'JOWN001', 1, '自室候補', 'hotpepper'), ($2, 'JOTHER001', 1, '別室候補', 'hotpepper')
	`, first.Room.ID, second.Room.ID); err != nil {
		t.Fatalf("insert candidates: %v", err)
	}

	votingRepository := restaurantpostgres.NewRestaurantVotingRepository(pool)
	err = votingRepository.WithinTransaction(ctx, func(transaction repository.RestaurantVotingTransaction) error {
		_, transactionError := transaction.InsertSubmission(ctx, first.Room.ID, first.Participant.ID, []domain.RestaurantVote{
			{RestaurantID: "JOWN001", Choice: "invalid"},
		})
		return transactionError
	})
	if err == nil {
		t.Fatal("invalid choice unexpectedly succeeded")
	}
	assertRestaurantSubmissionCounts(t, ctx, pool, first.Room.ID, 0, 0)

	err = votingRepository.WithinTransaction(ctx, func(transaction repository.RestaurantVotingTransaction) error {
		_, transactionError := transaction.InsertSubmission(ctx, first.Room.ID, first.Participant.ID, []domain.RestaurantVote{
			{RestaurantID: "JOTHER001", Choice: domain.RestaurantVoteChoiceLike},
		})
		return transactionError
	})
	if err == nil {
		t.Fatal("candidate from another room unexpectedly succeeded")
	}
	assertRestaurantSubmissionCounts(t, ctx, pool, first.Room.ID, 0, 0)

	err = votingRepository.WithinTransaction(ctx, func(transaction repository.RestaurantVotingTransaction) error {
		_, transactionError := transaction.InsertSubmission(ctx, second.Room.ID, first.Participant.ID, nil)
		return transactionError
	})
	if err == nil {
		t.Fatal("participant from another room unexpectedly succeeded")
	}
}

func TestRestaurantVotingServiceConcurrencyIntegration(t *testing.T) {
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
	votingRepository := restaurantpostgres.NewRestaurantVotingRepository(pool)
	randomGenerator := security.RandomGenerator{}
	roomService := service.NewRoomService(roomRepository, randomGenerator, service.SystemClock{})
	votingService := service.NewRestaurantVotingService(votingRepository, roomRepository, fixedIndexSelector{index: 1}, service.SystemClock{})

	created, err := roomService.Create(ctx, service.CreateRoomInput{
		Nickname: "同名", Latitude: 35.658, Longitude: 139.7016, SearchRange: 3,
	})
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
	if _, err := pool.Exec(ctx, `
		INSERT INTO restaurant_candidates (room_id, restaurant_id, position, name, source)
		VALUES
			($1, 'JCONCURRENT1', 1, '候補1', 'hotpepper'),
			($1, 'JCONCURRENT2', 2, '候補2', 'hotpepper'),
			($1, 'JCONCURRENT3', 3, '候補3', 'hotpepper')
	`, created.Room.ID); err != nil {
		t.Fatalf("insert candidates: %v", err)
	}
	if _, err := pool.Exec(ctx, `
		UPDATE rooms SET status = 'restaurant_voting', version = version + 1 WHERE id = $1
	`, created.Room.ID); err != nil {
		t.Fatalf("advance room to restaurant voting: %v", err)
	}

	votesFor := func(likedRestaurantID string) []domain.RestaurantVote {
		votes := make([]domain.RestaurantVote, 0, 3)
		for _, restaurantID := range []string{"JCONCURRENT1", "JCONCURRENT2", "JCONCURRENT3"} {
			choice := domain.RestaurantVoteChoiceSkip
			if restaurantID == likedRestaurantID {
				choice = domain.RestaurantVoteChoiceLike
			}
			votes = append(votes, domain.RestaurantVote{RestaurantID: restaurantID, Choice: choice})
		}
		return votes
	}

	start := make(chan struct{})
	errorsByParticipant := make(chan error, 2)
	var waitGroup sync.WaitGroup
	for _, submission := range []struct {
		token string
		votes []domain.RestaurantVote
	}{
		{token: created.SessionToken, votes: votesFor("JCONCURRENT1")},
		{token: joined.SessionToken, votes: votesFor("JCONCURRENT2")},
	} {
		waitGroup.Add(1)
		go func(token string, votes []domain.RestaurantVote) {
			defer waitGroup.Done()
			<-start
			_, err := votingService.Submit(ctx, created.Room.ID, token, votes)
			errorsByParticipant <- err
		}(submission.token, submission.votes)
	}
	close(start)
	waitGroup.Wait()
	close(errorsByParticipant)
	for err := range errorsByParticipant {
		if err != nil {
			t.Fatalf("submit restaurant votes: %v", err)
		}
	}

	state, err := votingService.GetState(ctx, created.Room.ID, created.SessionToken)
	if err != nil {
		t.Fatalf("get restaurant voting state: %v", err)
	}
	if state.Room.Status != domain.RoomStatusDecided || state.Room.Version != 5 {
		t.Fatalf("room = %+v", state.Room)
	}
	if state.SubmittedParticipantCount != 2 || state.TotalParticipantCount != 2 || len(state.Participants) != 2 {
		t.Fatalf("state = %+v", state)
	}
	if state.Result == nil || state.Result.RestaurantID != "JCONCURRENT2" || state.Result.LikeCount != 1 ||
		state.Result.DecisionMethod != domain.RestaurantDecisionRandomTie || state.Result.Restaurant.Name != "候補2" {
		t.Fatalf("result = %+v", state.Result)
	}

	repeated, err := votingService.Submit(ctx, created.Room.ID, created.SessionToken, votesFor("JCONCURRENT1"))
	if err != nil {
		t.Fatalf("repeat same submission: %v", err)
	}
	if repeated.Room.Version != state.Room.Version || repeated.Result == nil || repeated.Result.RestaurantID != state.Result.RestaurantID {
		t.Fatalf("repeated state = %+v, original = %+v", repeated, state)
	}
	if _, err := votingService.Submit(ctx, created.Room.ID, created.SessionToken, votesFor("JCONCURRENT3")); !errors.Is(err, service.ErrVoteAlreadySubmitted) {
		t.Fatalf("different retry error = %v", err)
	}

	var submissionCount int
	var voteCount int
	var resultCount int
	if err := pool.QueryRow(ctx, `
		SELECT
			(SELECT COUNT(*) FROM restaurant_vote_submissions WHERE room_id = $1),
			(SELECT COUNT(*) FROM restaurant_votes WHERE room_id = $1),
			(SELECT COUNT(*) FROM restaurant_vote_results WHERE room_id = $1)
	`, created.Room.ID).Scan(&submissionCount, &voteCount, &resultCount); err != nil {
		t.Fatalf("inspect stored votes: %v", err)
	}
	if submissionCount != 2 || voteCount != 6 || resultCount != 1 {
		t.Fatalf("stored counts = submissions:%d votes:%d results:%d", submissionCount, voteCount, resultCount)
	}
}

func assertRestaurantSubmissionCounts(
	t *testing.T,
	ctx context.Context,
	pool *pgxpool.Pool,
	roomID string,
	wantSubmissions int,
	wantVotes int,
) {
	t.Helper()
	var submissions int
	var votes int
	if err := pool.QueryRow(ctx, `
		SELECT
			(SELECT COUNT(*) FROM restaurant_vote_submissions WHERE room_id = $1),
			(SELECT COUNT(*) FROM restaurant_votes WHERE room_id = $1)
	`, roomID).Scan(&submissions, &votes); err != nil {
		t.Fatalf("inspect restaurant vote rollback: %v", err)
	}
	if submissions != wantSubmissions || votes != wantVotes {
		t.Fatalf("stored counts = submissions:%d votes:%d", submissions, votes)
	}
}
