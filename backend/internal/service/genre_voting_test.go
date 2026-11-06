package service

import (
	"context"
	"errors"
	"slices"
	"testing"
	"time"

	"meal/backend/internal/domain"
	"meal/backend/internal/repository"
)

type genreRoomRepositoryStub struct {
	participant domain.Participant
	authError   error
}

func (stub *genreRoomRepositoryStub) Create(context.Context, repository.CreateRoomParams) (domain.Room, domain.Participant, error) {
	return domain.Room{}, domain.Participant{}, errors.New("unexpected create")
}
func (stub *genreRoomRepositoryStub) FindParticipantBySessionTokenHash(context.Context, []byte) (domain.Participant, error) {
	return stub.participant, stub.authError
}
func (*genreRoomRepositoryStub) FindStateByID(context.Context, string) (domain.Room, []domain.Participant, error) {
	return domain.Room{}, nil, errors.New("unexpected state lookup")
}
func (*genreRoomRepositoryStub) WithinTransaction(context.Context, func(repository.RoomTransaction) error) error {
	return errors.New("unexpected room transaction")
}

type genreVotingRepositoryStub struct {
	transaction *genreVotingTransactionStub
	state       domain.GenreVotingState
	stateError  error
}

func (stub *genreVotingRepositoryStub) WithinTransaction(ctx context.Context, operation func(repository.GenreVotingTransaction) error) error {
	return operation(stub.transaction)
}
func (stub *genreVotingRepositoryStub) FindState(context.Context, string, string) (domain.GenreVotingState, error) {
	return stub.state, stub.stateError
}

type genreVotingTransactionStub struct {
	room                  domain.Room
	storedVotes           []domain.GenreVote
	storedAt              *time.Time
	submissionError       error
	participantCount      int
	submissionCount       int
	counts                map[string]int
	state                 domain.GenreVotingState
	insertSubmissionCalls int
	incrementCalls        int
	advanceCalls          int
	insertedResult        domain.GenreVoteResult
	insertedRankings      []domain.GenreVoteRanking
}

func (stub *genreVotingTransactionStub) FindRoomByIDForUpdate(context.Context, string) (domain.Room, error) {
	return stub.room, nil
}
func (stub *genreVotingTransactionStub) FindSubmission(context.Context, string) ([]domain.GenreVote, *time.Time, error) {
	return stub.storedVotes, stub.storedAt, stub.submissionError
}
func (stub *genreVotingTransactionStub) InsertSubmission(context.Context, string, []domain.GenreVote) (time.Time, error) {
	stub.insertSubmissionCalls++
	return time.Now(), nil
}
func (stub *genreVotingTransactionStub) CountParticipants(context.Context, string) (int, error) {
	return stub.participantCount, nil
}
func (stub *genreVotingTransactionStub) CountSubmissions(context.Context, string) (int, error) {
	return stub.submissionCount, nil
}
func (stub *genreVotingTransactionStub) AggregateLikeCounts(context.Context, string) (map[string]int, error) {
	return stub.counts, nil
}
func (stub *genreVotingTransactionStub) InsertResult(_ context.Context, result domain.GenreVoteResult) (domain.GenreVoteResult, error) {
	stub.insertedResult = result
	return result, nil
}
func (stub *genreVotingTransactionStub) InsertRankings(_ context.Context, rankings []domain.GenreVoteRanking) error {
	stub.insertedRankings = append([]domain.GenreVoteRanking(nil), rankings...)
	return nil
}
func (stub *genreVotingTransactionStub) IncrementRoomVersion(context.Context, string) (domain.Room, error) {
	stub.incrementCalls++
	return stub.room, nil
}
func (stub *genreVotingTransactionStub) AdvanceToRestaurantSearching(context.Context, string) (domain.Room, error) {
	stub.advanceCalls++
	return stub.room, nil
}
func (stub *genreVotingTransactionStub) FindState(context.Context, string, string) (domain.GenreVotingState, error) {
	return stub.state, nil
}

type randomIndexSelectorStub struct {
	index       int
	indexes     []int
	error       error
	upperBound  int
	upperBounds []int
	calls       int
}

func (stub *randomIndexSelectorStub) SelectIndex(upperBound int) (int, error) {
	selectedIndex := stub.index
	if stub.calls < len(stub.indexes) {
		selectedIndex = stub.indexes[stub.calls]
	}
	stub.calls++
	stub.upperBound = upperBound
	stub.upperBounds = append(stub.upperBounds, upperBound)
	return selectedIndex, stub.error
}

func genreVotes(choice domain.GenreVoteChoice) []domain.GenreVote {
	votes := make([]domain.GenreVote, 0, domain.GenreCount)
	for _, genreID := range domain.GenreIDs() {
		votes = append(votes, domain.GenreVote{GenreID: genreID, Choice: choice})
	}
	return votes
}

func genreLikeCounts(values map[string]int) map[string]int {
	counts := make(map[string]int, domain.GenreCount)
	for _, genreID := range domain.GenreIDs() {
		counts[genreID] = values[genreID]
	}
	return counts
}

func TestGenreVotingServiceSelectGenreRankings(t *testing.T) {
	roomID := "550e8400-e29b-41d4-a716-446655440000"
	tests := []struct {
		name        string
		winnerID    string
		method      domain.GenreDecisionMethod
		counts      map[string]int
		indexes     []int
		wantIDs     []string
		wantBounds  []int
		wantTieRows []bool
	}{
		{name: "different counts", winnerID: "ramen", method: domain.GenreDecisionMostLikes,
			counts:  map[string]int{"ramen": 5, "sushi-seafood": 4, "yakiniku": 3},
			wantIDs: []string{"ramen", "sushi-seafood", "yakiniku"}, wantTieRows: []bool{false, false, false}},
		{name: "second and third tie", winnerID: "ramen", method: domain.GenreDecisionMostLikes,
			counts: map[string]int{"ramen": 5, "sushi-seafood": 3, "yakiniku": 3}, indexes: []int{1},
			wantIDs: []string{"ramen", "yakiniku", "sushi-seafood"}, wantBounds: []int{2}, wantTieRows: []bool{false, true, true}},
		{name: "third place boundary tie", winnerID: "ramen", method: domain.GenreDecisionMostLikes,
			counts: map[string]int{"ramen": 5, "sushi-seafood": 4, "yakiniku": 2, "steak-hamburg": 2}, indexes: []int{1},
			wantIDs: []string{"ramen", "sushi-seafood", "steak-hamburg"}, wantBounds: []int{2}, wantTieRows: []bool{false, false, true}},
		{name: "top three tie", winnerID: "ramen", method: domain.GenreDecisionRandomTie,
			counts: map[string]int{"ramen": 3, "sushi-seafood": 3, "yakiniku": 3}, indexes: []int{1},
			wantIDs: []string{"ramen", "yakiniku", "sushi-seafood"}, wantBounds: []int{2}, wantTieRows: []bool{true, true, true}},
		{name: "winner tie leaves fixed second", winnerID: "sushi-seafood", method: domain.GenreDecisionRandomTie,
			counts:  map[string]int{"ramen": 3, "sushi-seafood": 3, "yakiniku": 2},
			wantIDs: []string{"sushi-seafood", "ramen", "yakiniku"}, wantTieRows: []bool{true, true, false}},
		{name: "all skipped", winnerID: "cafe", method: domain.GenreDecisionRandomAllSkipped,
			counts: map[string]int{}, indexes: []int{0, 0}, wantIDs: []string{"cafe", "ramen", "sushi-seafood"},
			wantBounds: []int{15, 14}, wantTieRows: []bool{true, true, true}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			selector := &randomIndexSelectorStub{indexes: test.indexes}
			service := &GenreVotingService{selector: selector}
			rankings, err := service.selectGenreRankings(roomID, test.winnerID, test.method, genreLikeCounts(test.counts))
			if err != nil {
				t.Fatalf("selectGenreRankings() error = %v", err)
			}
			for index, ranking := range rankings {
				if ranking.Rank != int16(index+1) || ranking.GenreID != test.wantIDs[index] ||
					ranking.TieBreakApplied != test.wantTieRows[index] {
					t.Fatalf("rankings = %+v", rankings)
				}
			}
			if !slices.Equal(selector.upperBounds, test.wantBounds) {
				t.Fatalf("upper bounds = %v, want %v", selector.upperBounds, test.wantBounds)
			}
		})
	}
}

func TestGenreVotingServiceSelectGenreRankingsRejectsSelectorFailure(t *testing.T) {
	counts := genreLikeCounts(map[string]int{"ramen": 3, "sushi-seafood": 2, "yakiniku": 2})
	for name, selector := range map[string]*randomIndexSelectorStub{
		"error":        {error: errors.New("random failed")},
		"out of range": {index: 2},
	} {
		t.Run(name, func(t *testing.T) {
			service := &GenreVotingService{selector: selector}
			if _, err := service.selectGenreRankings("room", "ramen", domain.GenreDecisionMostLikes, counts); err == nil {
				t.Fatal("selectGenreRankings() unexpectedly succeeded")
			}
		})
	}
}

func validGenreVotingState(room domain.Room, participant domain.Participant, submittedCount int, result *domain.GenreVoteResult) domain.GenreVotingState {
	return domain.GenreVotingState{
		Room: room, CurrentParticipantID: participant.ID, Submitted: true,
		SubmittedParticipantCount: submittedCount, TotalParticipantCount: 2,
		Participants: []domain.GenreVotingParticipant{
			{Participant: participant, Submitted: true},
			{Participant: domain.Participant{ID: "member-2", RoomID: room.ID}, Submitted: submittedCount == 2},
		},
		Result: result,
	}
}

func TestGenreVotingServiceSubmitPartial(t *testing.T) {
	now := time.Date(2026, time.October, 30, 12, 0, 0, 0, time.UTC)
	roomID := "550e8400-e29b-41d4-a716-446655440000"
	participant := domain.Participant{ID: "member-1", RoomID: roomID}
	room := domain.Room{ID: roomID, Status: domain.RoomStatusGenreVoting, ExpiresAt: now.Add(time.Hour)}
	transaction := &genreVotingTransactionStub{
		room: room, submissionError: repository.ErrGenreSubmissionNotFound,
		participantCount: 2, submissionCount: 1, state: validGenreVotingState(room, participant, 1, nil),
	}
	service := NewGenreVotingService(
		&genreVotingRepositoryStub{transaction: transaction},
		&genreRoomRepositoryStub{participant: participant}, &randomIndexSelectorStub{}, clockStub{now: now},
	)

	result, err := service.Submit(context.Background(), roomID, "token", genreVotes(domain.GenreVoteChoiceSkip))
	if err != nil {
		t.Fatalf("Submit() error = %v", err)
	}
	if !result.Submitted || transaction.insertSubmissionCalls != 1 || transaction.incrementCalls != 1 || transaction.advanceCalls != 0 {
		t.Fatalf("result = %+v, transaction = %+v", result, transaction)
	}
}

func TestGenreVotingServiceSubmitFinalTie(t *testing.T) {
	now := time.Date(2026, time.October, 30, 12, 0, 0, 0, time.UTC)
	roomID := "550e8400-e29b-41d4-a716-446655440000"
	participant := domain.Participant{ID: "member-1", RoomID: roomID}
	room := domain.Room{ID: roomID, Status: domain.RoomStatusGenreVoting, ExpiresAt: now.Add(time.Hour)}
	counts := make(map[string]int, domain.GenreCount)
	for _, genreID := range domain.GenreIDs() {
		counts[genreID] = 0
	}
	counts["ramen"] = 2
	counts["sushi-seafood"] = 2
	resultRoom := room
	resultRoom.Status = domain.RoomStatusRestaurantSearching
	winner := &domain.GenreVoteResult{RoomID: roomID, GenreID: "sushi-seafood", LikeCount: 2, DecisionMethod: domain.GenreDecisionRandomTie}
	transaction := &genreVotingTransactionStub{
		room: room, submissionError: repository.ErrGenreSubmissionNotFound,
		participantCount: 2, submissionCount: 2, counts: counts,
		state: validGenreVotingState(resultRoom, participant, 2, winner),
	}
	selector := &randomIndexSelectorStub{indexes: []int{1, 0}}
	service := NewGenreVotingService(
		&genreVotingRepositoryStub{transaction: transaction},
		&genreRoomRepositoryStub{participant: participant}, selector, clockStub{now: now},
	)

	_, err := service.Submit(context.Background(), roomID, "token", genreVotes(domain.GenreVoteChoiceLike))
	if err != nil {
		t.Fatalf("Submit() error = %v", err)
	}
	if selector.calls != 2 || !slices.Equal(selector.upperBounds, []int{2, 14}) || transaction.insertedResult.GenreID != "sushi-seafood" {
		t.Fatalf("selector = %+v, result = %+v", selector, transaction.insertedResult)
	}
	if len(transaction.insertedRankings) != domain.GenreRankingLimit ||
		transaction.insertedRankings[0].GenreID != "sushi-seafood" ||
		transaction.insertedRankings[1].GenreID != "ramen" ||
		transaction.insertedRankings[2].GenreID != "yakiniku" ||
		!transaction.insertedRankings[0].TieBreakApplied || !transaction.insertedRankings[2].TieBreakApplied {
		t.Fatalf("rankings = %+v", transaction.insertedRankings)
	}
	if transaction.insertedResult.DecisionMethod != domain.GenreDecisionRandomTie || transaction.advanceCalls != 1 || transaction.incrementCalls != 0 {
		t.Fatalf("transaction = %+v", transaction)
	}
}

func TestGenreVotingServiceSubmitAllSkippedSelectsFromAllGenres(t *testing.T) {
	now := time.Date(2026, time.October, 30, 12, 0, 0, 0, time.UTC)
	roomID := "550e8400-e29b-41d4-a716-446655440000"
	participant := domain.Participant{ID: "member-1", RoomID: roomID}
	room := domain.Room{ID: roomID, Status: domain.RoomStatusGenreVoting, ExpiresAt: now.Add(time.Hour)}
	counts := make(map[string]int, domain.GenreCount)
	for _, genreID := range domain.GenreIDs() {
		counts[genreID] = 0
	}
	resultRoom := room
	resultRoom.Status = domain.RoomStatusRestaurantSearching
	result := &domain.GenreVoteResult{GenreID: "cafe", DecisionMethod: domain.GenreDecisionRandomAllSkipped}
	transaction := &genreVotingTransactionStub{
		room: room, submissionError: repository.ErrGenreSubmissionNotFound, participantCount: 2,
		submissionCount: 2, counts: counts, state: validGenreVotingState(resultRoom, participant, 2, result),
	}
	selector := &randomIndexSelectorStub{indexes: []int{domain.GenreCount - 1, 0, 0}}
	service := NewGenreVotingService(&genreVotingRepositoryStub{transaction: transaction}, &genreRoomRepositoryStub{participant: participant}, selector, clockStub{now: now})

	if _, err := service.Submit(context.Background(), roomID, "token", genreVotes(domain.GenreVoteChoiceSkip)); err != nil {
		t.Fatalf("Submit() error = %v", err)
	}
	if !slices.Equal(selector.upperBounds, []int{domain.GenreCount, domain.GenreCount - 1, domain.GenreCount - 2}) || transaction.insertedResult.GenreID != "cafe" || transaction.insertedResult.DecisionMethod != domain.GenreDecisionRandomAllSkipped {
		t.Fatalf("selector = %+v, result = %+v", selector, transaction.insertedResult)
	}
	if len(transaction.insertedRankings) != domain.GenreRankingLimit || transaction.insertedRankings[0].GenreID != "cafe" ||
		transaction.insertedRankings[1].GenreID != "ramen" || transaction.insertedRankings[2].GenreID != "sushi-seafood" {
		t.Fatalf("rankings = %+v", transaction.insertedRankings)
	}
}

func TestGenreVotingServiceSubmitRetry(t *testing.T) {
	now := time.Date(2026, time.October, 30, 12, 0, 0, 0, time.UTC)
	roomID := "550e8400-e29b-41d4-a716-446655440000"
	participant := domain.Participant{ID: "member-1", RoomID: roomID}
	room := domain.Room{ID: roomID, Status: domain.RoomStatusRestaurantSearching, ExpiresAt: now.Add(time.Hour)}
	votes := genreVotes(domain.GenreVoteChoiceSkip)
	result := &domain.GenreVoteResult{GenreID: "cafe", DecisionMethod: domain.GenreDecisionRandomAllSkipped}
	tests := []struct {
		name          string
		storedVotes   []domain.GenreVote
		expectedError error
	}{
		{name: "same content succeeds", storedVotes: votes},
		{name: "different content conflicts", storedVotes: genreVotes(domain.GenreVoteChoiceLike), expectedError: ErrVoteAlreadySubmitted},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			transaction := &genreVotingTransactionStub{
				room: room, storedVotes: test.storedVotes,
				state: validGenreVotingState(room, participant, 2, result),
			}
			service := NewGenreVotingService(&genreVotingRepositoryStub{transaction: transaction}, &genreRoomRepositoryStub{participant: participant}, &randomIndexSelectorStub{}, clockStub{now: now})
			_, err := service.Submit(context.Background(), roomID, "token", votes)
			if !errors.Is(err, test.expectedError) {
				t.Fatalf("Submit() error = %v, want %v", err, test.expectedError)
			}
			if transaction.insertSubmissionCalls != 0 || transaction.incrementCalls != 0 || transaction.advanceCalls != 0 {
				t.Fatalf("retry mutated state: %+v", transaction)
			}
		})
	}
}

func TestGenreVotingServiceSubmitRejectsInactiveNewVote(t *testing.T) {
	now := time.Date(2026, time.October, 30, 12, 0, 0, 0, time.UTC)
	roomID := "550e8400-e29b-41d4-a716-446655440000"
	participant := domain.Participant{ID: "member-1", RoomID: roomID}
	transaction := &genreVotingTransactionStub{
		room:            domain.Room{ID: roomID, Status: domain.RoomStatusLobby, ExpiresAt: now.Add(time.Hour)},
		submissionError: repository.ErrGenreSubmissionNotFound,
	}
	service := NewGenreVotingService(&genreVotingRepositoryStub{transaction: transaction}, &genreRoomRepositoryStub{participant: participant}, &randomIndexSelectorStub{}, clockStub{now: now})

	_, err := service.Submit(context.Background(), roomID, "token", genreVotes(domain.GenreVoteChoiceSkip))
	if !errors.Is(err, ErrGenreVotingNotActive) {
		t.Fatalf("Submit() error = %v", err)
	}
}
