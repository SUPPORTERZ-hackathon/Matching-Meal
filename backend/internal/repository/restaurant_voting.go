package repository

import (
	"context"
	"errors"
	"time"

	"meal/backend/internal/domain"
)

var ErrRestaurantSubmissionNotFound = errors.New("restaurant vote submission not found")

type RestaurantVotingRepository interface {
	FindState(ctx context.Context, roomID string, currentParticipantID string) (domain.RestaurantVotingState, error)
	WithinTransaction(ctx context.Context, operation func(RestaurantVotingTransaction) error) error
}

type RestaurantVotingTransaction interface {
	FindRoomByIDForUpdate(ctx context.Context, roomID string) (domain.Room, error)
	ListCandidates(ctx context.Context, roomID string) ([]domain.RestaurantCandidate, error)
	FindSubmission(ctx context.Context, roomID string, participantID string, candidates []domain.RestaurantCandidate) ([]domain.RestaurantVote, *time.Time, error)
	InsertSubmission(ctx context.Context, roomID string, participantID string, votes []domain.RestaurantVote) (time.Time, error)
	CountParticipants(ctx context.Context, roomID string) (int, error)
	CountSubmissions(ctx context.Context, roomID string) (int, error)
	AggregateLikeCounts(ctx context.Context, roomID string, candidates []domain.RestaurantCandidate) (map[string]int, error)
	InsertResult(ctx context.Context, result domain.RestaurantVoteResult) (domain.RestaurantVoteResult, error)
	IncrementRoomVersion(ctx context.Context, roomID string) (domain.Room, error)
	AdvanceToDecided(ctx context.Context, roomID string) (domain.Room, error)
	FindState(ctx context.Context, roomID string, currentParticipantID string) (domain.RestaurantVotingState, error)
}
