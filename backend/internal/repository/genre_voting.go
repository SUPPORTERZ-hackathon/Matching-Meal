package repository

import (
	"context"
	"errors"
	"time"

	"meal/backend/internal/domain"
)

var ErrGenreSubmissionNotFound = errors.New("genre vote submission not found")

type GenreVotingRepository interface {
	FindState(ctx context.Context, roomID string, currentParticipantID string) (domain.GenreVotingState, error)
	WithinTransaction(ctx context.Context, operation func(GenreVotingTransaction) error) error
}

type GenreVotingTransaction interface {
	FindRoomByIDForUpdate(ctx context.Context, roomID string) (domain.Room, error)
	FindSubmission(ctx context.Context, participantID string) ([]domain.GenreVote, *time.Time, error)
	InsertSubmission(ctx context.Context, participantID string, votes []domain.GenreVote) (time.Time, error)
	CountParticipants(ctx context.Context, roomID string) (int, error)
	CountSubmissions(ctx context.Context, roomID string) (int, error)
	AggregateLikeCounts(ctx context.Context, roomID string) (map[string]int, error)
	InsertResult(ctx context.Context, result domain.GenreVoteResult) (domain.GenreVoteResult, error)
	IncrementRoomVersion(ctx context.Context, roomID string) (domain.Room, error)
	AdvanceToRestaurantSearching(ctx context.Context, roomID string) (domain.Room, error)
	FindState(ctx context.Context, roomID string, currentParticipantID string) (domain.GenreVotingState, error)
}
