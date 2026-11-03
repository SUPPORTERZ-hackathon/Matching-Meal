package repository

import (
	"context"
	"errors"
	"time"

	"meal/backend/internal/domain"
)

var (
	ErrRestaurantSearchConditionNotFound = errors.New("restaurant search condition not found")
	ErrGenreVoteResultNotFound           = errors.New("genre vote result not found")
	ErrRestaurantSearchNotActive         = errors.New("restaurant search not active")
)

type RestaurantSearchRepository interface {
	FindContext(ctx context.Context, roomID string) (domain.RestaurantSearchContext, error)
	SaveCandidatesAndAdvance(ctx context.Context, roomID string, candidates []domain.RestaurantCandidate, now time.Time) (domain.Room, []domain.RestaurantCandidate, error)
}
