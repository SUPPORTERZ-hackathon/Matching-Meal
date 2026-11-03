package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"meal/backend/internal/domain"
	"meal/backend/internal/repository"
)

type restaurantVotingRoomRepositoryStub struct {
	participant domain.Participant
	authError   error
}

func (*restaurantVotingRoomRepositoryStub) Create(context.Context, repository.CreateRoomParams) (domain.Room, domain.Participant, error) {
	return domain.Room{}, domain.Participant{}, errors.New("unexpected create")
}
func (stub *restaurantVotingRoomRepositoryStub) FindParticipantBySessionTokenHash(context.Context, []byte) (domain.Participant, error) {
	return stub.participant, stub.authError
}
func (*restaurantVotingRoomRepositoryStub) FindStateByID(context.Context, string) (domain.Room, []domain.Participant, error) {
	return domain.Room{}, nil, errors.New("unexpected state lookup")
}
func (*restaurantVotingRoomRepositoryStub) WithinTransaction(context.Context, func(repository.RoomTransaction) error) error {
	return errors.New("unexpected room transaction")
}

type restaurantVotingRepositoryStub struct {
	transaction *restaurantVotingTransactionStub
	state       domain.RestaurantVotingState
	stateError  error
}

func (stub *restaurantVotingRepositoryStub) WithinTransaction(ctx context.Context, operation func(repository.RestaurantVotingTransaction) error) error {
	return operation(stub.transaction)
}
func (stub *restaurantVotingRepositoryStub) FindState(context.Context, string, string) (domain.RestaurantVotingState, error) {
	return stub.state, stub.stateError
}

type restaurantVotingTransactionStub struct {
	room                  domain.Room
	candidates            []domain.RestaurantCandidate
	storedVotes           []domain.RestaurantVote
	storedAt              *time.Time
	submissionError       error
	participantCount      int
	submissionCount       int
	counts                map[string]int
	state                 domain.RestaurantVotingState
	insertSubmissionCalls int
	incrementCalls        int
	advanceCalls          int
	insertedResult        domain.RestaurantVoteResult
}

func (stub *restaurantVotingTransactionStub) FindRoomByIDForUpdate(context.Context, string) (domain.Room, error) {
	return stub.room, nil
}
func (stub *restaurantVotingTransactionStub) ListCandidates(context.Context, string) ([]domain.RestaurantCandidate, error) {
	return stub.candidates, nil
}
func (stub *restaurantVotingTransactionStub) FindSubmission(context.Context, string, string, []domain.RestaurantCandidate) ([]domain.RestaurantVote, *time.Time, error) {
	return stub.storedVotes, stub.storedAt, stub.submissionError
}
func (stub *restaurantVotingTransactionStub) InsertSubmission(context.Context, string, string, []domain.RestaurantVote) (time.Time, error) {
	stub.insertSubmissionCalls++
	return time.Now(), nil
}
func (stub *restaurantVotingTransactionStub) CountParticipants(context.Context, string) (int, error) {
	return stub.participantCount, nil
}
func (stub *restaurantVotingTransactionStub) CountSubmissions(context.Context, string) (int, error) {
	return stub.submissionCount, nil
}
func (stub *restaurantVotingTransactionStub) AggregateLikeCounts(context.Context, string, []domain.RestaurantCandidate) (map[string]int, error) {
	return stub.counts, nil
}
func (stub *restaurantVotingTransactionStub) InsertResult(_ context.Context, result domain.RestaurantVoteResult) (domain.RestaurantVoteResult, error) {
	stub.insertedResult = result
	return result, nil
}
func (stub *restaurantVotingTransactionStub) IncrementRoomVersion(context.Context, string) (domain.Room, error) {
	stub.incrementCalls++
	return stub.room, nil
}
func (stub *restaurantVotingTransactionStub) AdvanceToDecided(context.Context, string) (domain.Room, error) {
	stub.advanceCalls++
	return stub.room, nil
}
func (stub *restaurantVotingTransactionStub) FindState(context.Context, string, string) (domain.RestaurantVotingState, error) {
	return stub.state, nil
}

func restaurantVotingCandidates(roomID string, count int) []domain.RestaurantCandidate {
	candidates := make([]domain.RestaurantCandidate, 0, count)
	for index := 0; index < count; index++ {
		candidates = append(candidates, domain.RestaurantCandidate{
			RoomID: roomID, RestaurantID: "restaurant-" + string(rune('a'+index)),
			Position: int16(index + 1), Name: "店舗", Source: domain.RestaurantSourceHotPepper,
		})
	}
	return candidates
}

func restaurantVotes(candidates []domain.RestaurantCandidate, choice domain.RestaurantVoteChoice) []domain.RestaurantVote {
	votes := make([]domain.RestaurantVote, 0, len(candidates))
	for _, candidate := range candidates {
		votes = append(votes, domain.RestaurantVote{RestaurantID: candidate.RestaurantID, Choice: choice})
	}
	return votes
}

func validRestaurantVotingState(
	room domain.Room,
	participant domain.Participant,
	submittedCount int,
	result *domain.RestaurantVoteResult,
) domain.RestaurantVotingState {
	return domain.RestaurantVotingState{
		Room: room, CurrentParticipantID: participant.ID, Submitted: true,
		SubmittedParticipantCount: submittedCount, TotalParticipantCount: 2,
		Participants: []domain.RestaurantVotingParticipant{
			{Participant: participant, Submitted: true},
			{Participant: domain.Participant{ID: "member-2", RoomID: room.ID}, Submitted: submittedCount == 2},
		},
		Result: result,
	}
}

func TestRestaurantVotingServiceSubmitPartial(t *testing.T) {
	now := time.Date(2026, time.November, 3, 12, 0, 0, 0, time.UTC)
	roomID := "550e8400-e29b-41d4-a716-446655440000"
	participant := domain.Participant{ID: "member-1", RoomID: roomID}
	room := domain.Room{ID: roomID, Status: domain.RoomStatusRestaurantVoting, ExpiresAt: now.Add(time.Hour)}
	candidates := restaurantVotingCandidates(roomID, 3)
	transaction := &restaurantVotingTransactionStub{
		room: room, candidates: candidates, submissionError: repository.ErrRestaurantSubmissionNotFound,
		participantCount: 2, submissionCount: 1, state: validRestaurantVotingState(room, participant, 1, nil),
	}
	service := NewRestaurantVotingService(
		&restaurantVotingRepositoryStub{transaction: transaction},
		&restaurantVotingRoomRepositoryStub{participant: participant}, &randomIndexSelectorStub{}, clockStub{now: now},
	)

	result, err := service.Submit(context.Background(), roomID, "token", restaurantVotes(candidates, domain.RestaurantVoteChoiceSkip))
	if err != nil {
		t.Fatalf("Submit() error = %v", err)
	}
	if !result.Submitted || transaction.insertSubmissionCalls != 1 || transaction.incrementCalls != 1 || transaction.advanceCalls != 0 {
		t.Fatalf("result = %+v, transaction = %+v", result, transaction)
	}
}

func TestRestaurantVotingServiceSubmitFinalTie(t *testing.T) {
	now := time.Date(2026, time.November, 3, 12, 0, 0, 0, time.UTC)
	roomID := "550e8400-e29b-41d4-a716-446655440000"
	participant := domain.Participant{ID: "member-1", RoomID: roomID}
	room := domain.Room{ID: roomID, Status: domain.RoomStatusRestaurantVoting, ExpiresAt: now.Add(time.Hour)}
	candidates := restaurantVotingCandidates(roomID, 3)
	decidedRoom := room
	decidedRoom.Status = domain.RoomStatusDecided
	winner := &domain.RestaurantVoteResult{
		RoomID: roomID, RestaurantID: candidates[1].RestaurantID, Restaurant: candidates[1],
		LikeCount: 2, DecisionMethod: domain.RestaurantDecisionRandomTie,
	}
	transaction := &restaurantVotingTransactionStub{
		room: room, candidates: candidates, submissionError: repository.ErrRestaurantSubmissionNotFound,
		participantCount: 2, submissionCount: 2,
		counts: map[string]int{candidates[0].RestaurantID: 2, candidates[1].RestaurantID: 2, candidates[2].RestaurantID: 1},
		state:  validRestaurantVotingState(decidedRoom, participant, 2, winner),
	}
	selector := &randomIndexSelectorStub{index: 1}
	service := NewRestaurantVotingService(
		&restaurantVotingRepositoryStub{transaction: transaction},
		&restaurantVotingRoomRepositoryStub{participant: participant}, selector, clockStub{now: now},
	)

	_, err := service.Submit(context.Background(), roomID, "token", restaurantVotes(candidates, domain.RestaurantVoteChoiceLike))
	if err != nil {
		t.Fatalf("Submit() error = %v", err)
	}
	if selector.calls != 1 || selector.upperBound != 2 || transaction.insertedResult.RestaurantID != candidates[1].RestaurantID {
		t.Fatalf("selector = %+v, result = %+v", selector, transaction.insertedResult)
	}
	if transaction.insertedResult.DecisionMethod != domain.RestaurantDecisionRandomTie || transaction.advanceCalls != 1 || transaction.incrementCalls != 0 {
		t.Fatalf("transaction = %+v", transaction)
	}
}

func TestRestaurantVotingServiceSubmitAllSkippedSelectsFromAllCandidates(t *testing.T) {
	now := time.Date(2026, time.November, 3, 12, 0, 0, 0, time.UTC)
	roomID := "550e8400-e29b-41d4-a716-446655440000"
	participant := domain.Participant{ID: "member-1", RoomID: roomID}
	room := domain.Room{ID: roomID, Status: domain.RoomStatusRestaurantVoting, ExpiresAt: now.Add(time.Hour)}
	candidates := restaurantVotingCandidates(roomID, 3)
	decidedRoom := room
	decidedRoom.Status = domain.RoomStatusDecided
	winner := &domain.RestaurantVoteResult{
		RoomID: roomID, RestaurantID: candidates[2].RestaurantID, Restaurant: candidates[2],
		DecisionMethod: domain.RestaurantDecisionRandomAllSkipped,
	}
	transaction := &restaurantVotingTransactionStub{
		room: room, candidates: candidates, submissionError: repository.ErrRestaurantSubmissionNotFound,
		participantCount: 2, submissionCount: 2,
		counts: map[string]int{candidates[0].RestaurantID: 0, candidates[1].RestaurantID: 0, candidates[2].RestaurantID: 0},
		state:  validRestaurantVotingState(decidedRoom, participant, 2, winner),
	}
	selector := &randomIndexSelectorStub{index: 2}
	service := NewRestaurantVotingService(
		&restaurantVotingRepositoryStub{transaction: transaction},
		&restaurantVotingRoomRepositoryStub{participant: participant}, selector, clockStub{now: now},
	)

	if _, err := service.Submit(context.Background(), roomID, "token", restaurantVotes(candidates, domain.RestaurantVoteChoiceSkip)); err != nil {
		t.Fatalf("Submit() error = %v", err)
	}
	if selector.upperBound != 3 || transaction.insertedResult.RestaurantID != candidates[2].RestaurantID ||
		transaction.insertedResult.DecisionMethod != domain.RestaurantDecisionRandomAllSkipped {
		t.Fatalf("selector = %+v, result = %+v", selector, transaction.insertedResult)
	}
}

func TestRestaurantVotingServiceSubmitRetryAndCandidateMismatch(t *testing.T) {
	now := time.Date(2026, time.November, 3, 12, 0, 0, 0, time.UTC)
	roomID := "550e8400-e29b-41d4-a716-446655440000"
	participant := domain.Participant{ID: "member-1", RoomID: roomID}
	room := domain.Room{ID: roomID, Status: domain.RoomStatusDecided, ExpiresAt: now.Add(time.Hour)}
	candidates := restaurantVotingCandidates(roomID, 2)
	votes := restaurantVotes(candidates, domain.RestaurantVoteChoiceSkip)
	result := &domain.RestaurantVoteResult{RestaurantID: candidates[0].RestaurantID, Restaurant: candidates[0]}

	for _, test := range []struct {
		name          string
		input         []domain.RestaurantVote
		stored        []domain.RestaurantVote
		expectedError error
	}{
		{name: "same content succeeds", input: votes, stored: votes},
		{name: "different content conflicts", input: votes, stored: restaurantVotes(candidates, domain.RestaurantVoteChoiceLike), expectedError: ErrVoteAlreadySubmitted},
		{name: "candidate mismatch conflicts", input: votes[:1], expectedError: ErrRestaurantCandidatesMismatch},
	} {
		t.Run(test.name, func(t *testing.T) {
			transaction := &restaurantVotingTransactionStub{
				room: room, candidates: candidates, storedVotes: test.stored,
				state: validRestaurantVotingState(room, participant, 2, result),
			}
			if test.expectedError == ErrRestaurantCandidatesMismatch {
				transaction.submissionError = repository.ErrRestaurantSubmissionNotFound
			}
			service := NewRestaurantVotingService(
				&restaurantVotingRepositoryStub{transaction: transaction},
				&restaurantVotingRoomRepositoryStub{participant: participant}, &randomIndexSelectorStub{}, clockStub{now: now},
			)
			_, err := service.Submit(context.Background(), roomID, "token", test.input)
			if !errors.Is(err, test.expectedError) {
				t.Fatalf("Submit() error = %v, want %v", err, test.expectedError)
			}
			if transaction.insertSubmissionCalls != 0 || transaction.incrementCalls != 0 || transaction.advanceCalls != 0 {
				t.Fatalf("request mutated state: %+v", transaction)
			}
		})
	}
}

func TestRestaurantVotingServiceGetStateNotReady(t *testing.T) {
	now := time.Date(2026, time.November, 3, 12, 0, 0, 0, time.UTC)
	roomID := "550e8400-e29b-41d4-a716-446655440000"
	participant := domain.Participant{ID: "member-1", RoomID: roomID}
	repositoryStub := &restaurantVotingRepositoryStub{state: domain.RestaurantVotingState{
		Room: domain.Room{ID: roomID, Status: domain.RoomStatusRestaurantSearching, ExpiresAt: now.Add(time.Hour)},
	}}
	service := NewRestaurantVotingService(repositoryStub, &restaurantVotingRoomRepositoryStub{participant: participant}, &randomIndexSelectorStub{}, clockStub{now: now})

	_, err := service.GetState(context.Background(), roomID, "token")
	if !errors.Is(err, ErrRestaurantVotingNotReady) {
		t.Fatalf("GetState() error = %v", err)
	}
}
