package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"meal/backend/internal/domain"
	"meal/backend/internal/repository"
)

type RestaurantSearchRepository struct {
	pool *pgxpool.Pool
}

func NewRestaurantSearchRepository(pool *pgxpool.Pool) *RestaurantSearchRepository {
	return &RestaurantSearchRepository{pool: pool}
}

func (restaurantRepository *RestaurantSearchRepository) FindContext(ctx context.Context, roomID string) (domain.RestaurantSearchContext, error) {
	var searchContext domain.RestaurantSearchContext
	room := &searchContext.Room
	err := restaurantRepository.pool.QueryRow(ctx, `
		SELECT id, join_code, status, version, expires_at, created_at, updated_at
		FROM rooms
		WHERE id = $1
	`, roomID).Scan(
		&room.ID, &room.JoinCode, &room.Status, &room.Version,
		&room.ExpiresAt, &room.CreatedAt, &room.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.RestaurantSearchContext{}, repository.ErrRoomNotFound
	}
	if err != nil {
		return domain.RestaurantSearchContext{}, fmt.Errorf("find restaurant search room: %w", err)
	}

	condition := &searchContext.SearchCondition
	err = restaurantRepository.pool.QueryRow(ctx, `
		SELECT room_id, latitude, longitude, search_range, created_at
		FROM room_search_conditions
		WHERE room_id = $1
	`, roomID).Scan(&condition.RoomID, &condition.Latitude, &condition.Longitude, &condition.Range, &condition.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.RestaurantSearchContext{}, repository.ErrRestaurantSearchConditionNotFound
	}
	if err != nil {
		return domain.RestaurantSearchContext{}, fmt.Errorf("find restaurant search condition: %w", err)
	}

	err = restaurantRepository.pool.QueryRow(ctx, `
		SELECT genre_id
		FROM genre_vote_results
		WHERE room_id = $1
	`, roomID).Scan(&searchContext.GenreID)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.RestaurantSearchContext{}, repository.ErrGenreVoteResultNotFound
	}
	if err != nil {
		return domain.RestaurantSearchContext{}, fmt.Errorf("find restaurant search genre result: %w", err)
	}

	candidates, err := listRestaurantCandidates(ctx, restaurantRepository.pool, roomID)
	if err != nil {
		return domain.RestaurantSearchContext{}, err
	}
	searchContext.Candidates = candidates
	return searchContext, nil
}

func (restaurantRepository *RestaurantSearchRepository) SaveCandidatesAndAdvance(ctx context.Context, roomID string, candidates []domain.RestaurantCandidate, now time.Time) (domain.Room, []domain.RestaurantCandidate, error) {
	tx, err := restaurantRepository.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return domain.Room{}, nil, fmt.Errorf("begin save restaurant candidates transaction: %w", err)
	}
	defer func() { rollback(tx) }()

	var room domain.Room
	err = tx.QueryRow(ctx, `
		SELECT id, join_code, status, version, expires_at, created_at, updated_at
		FROM rooms
		WHERE id = $1
		FOR UPDATE
	`, roomID).Scan(
		&room.ID, &room.JoinCode, &room.Status, &room.Version,
		&room.ExpiresAt, &room.CreatedAt, &room.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Room{}, nil, repository.ErrRoomNotFound
	}
	if err != nil {
		return domain.Room{}, nil, fmt.Errorf("lock restaurant search room: %w", err)
	}
	if room.Status == domain.RoomStatusExpired || !now.Before(room.ExpiresAt) {
		return domain.Room{}, nil, repository.ErrRoomNotFound
	}

	existing, err := listRestaurantCandidates(ctx, tx, roomID)
	if err != nil {
		return domain.Room{}, nil, err
	}
	if len(existing) > 0 {
		if err := tx.Commit(ctx); err != nil {
			return domain.Room{}, nil, fmt.Errorf("commit existing restaurant candidates transaction: %w", err)
		}
		return room, existing, nil
	}
	if room.Status != domain.RoomStatusRestaurantSearching {
		return domain.Room{}, nil, repository.ErrRestaurantSearchNotActive
	}
	if len(candidates) == 0 || len(candidates) > domain.MaxRestaurantCandidates {
		return domain.Room{}, nil, fmt.Errorf("save restaurant candidates: invalid candidate count %d", len(candidates))
	}

	stored := make([]domain.RestaurantCandidate, 0, len(candidates))
	for index, candidate := range candidates {
		candidate.RoomID = roomID
		candidate.Position = int16(index + 1)
		err := tx.QueryRow(ctx, `
			INSERT INTO restaurant_candidates (
				room_id, restaurant_id, position, name, address, photo_url, opening_hours, closed_days,
				dinner_budget, access, station_name, detail_url, latitude, longitude, source
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
			RETURNING created_at
		`,
			candidate.RoomID, candidate.RestaurantID, candidate.Position, candidate.Name,
			candidate.Address, candidate.PhotoURL, candidate.OpeningHours, candidate.ClosedDays, candidate.DinnerBudget,
			candidate.Access, candidate.StationName, candidate.DetailURL,
			candidate.Latitude, candidate.Longitude, candidate.Source,
		).Scan(&candidate.CreatedAt)
		if err != nil {
			return domain.Room{}, nil, fmt.Errorf("insert restaurant candidate: %w", err)
		}
		stored = append(stored, candidate)
	}

	err = tx.QueryRow(ctx, `
		UPDATE rooms
		SET status = 'restaurant_voting', version = version + 1, updated_at = NOW()
		WHERE id = $1
		RETURNING id, join_code, status, version, expires_at, created_at, updated_at
	`, roomID).Scan(
		&room.ID, &room.JoinCode, &room.Status, &room.Version,
		&room.ExpiresAt, &room.CreatedAt, &room.UpdatedAt,
	)
	if err != nil {
		return domain.Room{}, nil, fmt.Errorf("advance room to restaurant voting: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.Room{}, nil, fmt.Errorf("commit restaurant candidates transaction: %w", err)
	}
	return room, stored, nil
}

func listRestaurantCandidates(ctx context.Context, queryer rowsQueryer, roomID string) ([]domain.RestaurantCandidate, error) {
	rows, err := queryer.Query(ctx, `
		SELECT room_id, restaurant_id, position, name, address, photo_url, opening_hours, closed_days,
		       dinner_budget, access, station_name, detail_url, latitude, longitude, source, created_at
		FROM restaurant_candidates
		WHERE room_id = $1
		ORDER BY position ASC
	`, roomID)
	if err != nil {
		return nil, fmt.Errorf("query restaurant candidates: %w", err)
	}
	defer rows.Close()

	candidates := make([]domain.RestaurantCandidate, 0, domain.MaxRestaurantCandidates)
	for rows.Next() {
		var candidate domain.RestaurantCandidate
		if err := rows.Scan(
			&candidate.RoomID, &candidate.RestaurantID, &candidate.Position, &candidate.Name,
			&candidate.Address, &candidate.PhotoURL, &candidate.OpeningHours, &candidate.ClosedDays, &candidate.DinnerBudget,
			&candidate.Access, &candidate.StationName, &candidate.DetailURL,
			&candidate.Latitude, &candidate.Longitude, &candidate.Source, &candidate.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan restaurant candidate: %w", err)
		}
		candidates = append(candidates, candidate)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read restaurant candidates: %w", err)
	}
	return candidates, nil
}
