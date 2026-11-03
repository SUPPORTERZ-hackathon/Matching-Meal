package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"meal/backend/internal/domain"
	"meal/backend/internal/repository"
)

type RestaurantVotingRepository struct {
	pool *pgxpool.Pool
}

type restaurantVotingTransaction struct {
	tx pgx.Tx
}

func NewRestaurantVotingRepository(pool *pgxpool.Pool) *RestaurantVotingRepository {
	return &RestaurantVotingRepository{pool: pool}
}

func (restaurantRepository *RestaurantVotingRepository) WithinTransaction(
	ctx context.Context,
	operation func(repository.RestaurantVotingTransaction) error,
) error {
	tx, err := restaurantRepository.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin restaurant voting transaction: %w", err)
	}
	defer func() { rollback(tx) }()

	if err := operation(&restaurantVotingTransaction{tx: tx}); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit restaurant voting transaction: %w", err)
	}
	return nil
}

func (restaurantRepository *RestaurantVotingRepository) FindState(
	ctx context.Context,
	roomID string,
	currentParticipantID string,
) (domain.RestaurantVotingState, error) {
	return findRestaurantVotingState(ctx, restaurantRepository.pool, roomID, currentParticipantID)
}

func (transaction *restaurantVotingTransaction) FindRoomByIDForUpdate(ctx context.Context, roomID string) (domain.Room, error) {
	var room domain.Room
	err := transaction.tx.QueryRow(ctx, `
		SELECT id, join_code, status, version, expires_at, created_at, updated_at
		FROM rooms
		WHERE id = $1
		FOR UPDATE
	`, roomID).Scan(
		&room.ID, &room.JoinCode, &room.Status, &room.Version,
		&room.ExpiresAt, &room.CreatedAt, &room.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Room{}, repository.ErrRoomNotFound
	}
	if err != nil {
		return domain.Room{}, fmt.Errorf("find restaurant voting room for update: %w", err)
	}
	return room, nil
}

func (transaction *restaurantVotingTransaction) ListCandidates(ctx context.Context, roomID string) ([]domain.RestaurantCandidate, error) {
	return listRestaurantCandidates(ctx, transaction.tx, roomID)
}

func (transaction *restaurantVotingTransaction) FindSubmission(
	ctx context.Context,
	roomID string,
	participantID string,
	candidates []domain.RestaurantCandidate,
) ([]domain.RestaurantVote, *time.Time, error) {
	var submittedAt time.Time
	if err := transaction.tx.QueryRow(ctx, `
		SELECT submitted_at
		FROM restaurant_vote_submissions
		WHERE room_id = $1 AND participant_id = $2
	`, roomID, participantID).Scan(&submittedAt); errors.Is(err, pgx.ErrNoRows) {
		return nil, nil, repository.ErrRestaurantSubmissionNotFound
	} else if err != nil {
		return nil, nil, fmt.Errorf("find restaurant vote submission: %w", err)
	}

	rows, err := transaction.tx.Query(ctx, `
		SELECT v.restaurant_id, v.choice
		FROM restaurant_votes v
		JOIN restaurant_candidates c
		  ON c.room_id = v.room_id AND c.restaurant_id = v.restaurant_id
		WHERE v.room_id = $1 AND v.participant_id = $2
		ORDER BY c.position ASC
	`, roomID, participantID)
	if err != nil {
		return nil, nil, fmt.Errorf("query submitted restaurant votes: %w", err)
	}
	defer rows.Close()

	votes := make([]domain.RestaurantVote, 0, len(candidates))
	for rows.Next() {
		var vote domain.RestaurantVote
		if err := rows.Scan(&vote.RestaurantID, &vote.Choice); err != nil {
			return nil, nil, fmt.Errorf("scan submitted restaurant vote: %w", err)
		}
		votes = append(votes, vote)
	}
	if err := rows.Err(); err != nil {
		return nil, nil, fmt.Errorf("read submitted restaurant votes: %w", err)
	}
	normalized, err := domain.NormalizeRestaurantVotes(votes, candidates)
	if err != nil {
		return nil, nil, fmt.Errorf("stored restaurant votes are inconsistent: %w", err)
	}
	return normalized, &submittedAt, nil
}

func (transaction *restaurantVotingTransaction) InsertSubmission(
	ctx context.Context,
	roomID string,
	participantID string,
	votes []domain.RestaurantVote,
) (time.Time, error) {
	var submittedAt time.Time
	if err := transaction.tx.QueryRow(ctx, `
		INSERT INTO restaurant_vote_submissions (room_id, participant_id)
		VALUES ($1, $2)
		RETURNING submitted_at
	`, roomID, participantID).Scan(&submittedAt); err != nil {
		return time.Time{}, fmt.Errorf("insert restaurant vote submission: %w", err)
	}
	for _, vote := range votes {
		if _, err := transaction.tx.Exec(ctx, `
			INSERT INTO restaurant_votes (room_id, participant_id, restaurant_id, choice)
			VALUES ($1, $2, $3, $4)
		`, roomID, participantID, vote.RestaurantID, vote.Choice); err != nil {
			return time.Time{}, fmt.Errorf("insert restaurant vote: %w", err)
		}
	}
	return submittedAt, nil
}

func (transaction *restaurantVotingTransaction) CountParticipants(ctx context.Context, roomID string) (int, error) {
	var count int
	if err := transaction.tx.QueryRow(ctx, `SELECT COUNT(*) FROM participants WHERE room_id = $1`, roomID).Scan(&count); err != nil {
		return 0, fmt.Errorf("count restaurant voting participants: %w", err)
	}
	return count, nil
}

func (transaction *restaurantVotingTransaction) CountSubmissions(ctx context.Context, roomID string) (int, error) {
	var count int
	if err := transaction.tx.QueryRow(ctx, `
		SELECT COUNT(*) FROM restaurant_vote_submissions WHERE room_id = $1
	`, roomID).Scan(&count); err != nil {
		return 0, fmt.Errorf("count restaurant vote submissions: %w", err)
	}
	return count, nil
}

func (transaction *restaurantVotingTransaction) AggregateLikeCounts(
	ctx context.Context,
	roomID string,
	candidates []domain.RestaurantCandidate,
) (map[string]int, error) {
	counts := make(map[string]int, len(candidates))
	for _, candidate := range candidates {
		counts[candidate.RestaurantID] = 0
	}
	rows, err := transaction.tx.Query(ctx, `
		SELECT restaurant_id, COUNT(*)
		FROM restaurant_votes
		WHERE room_id = $1 AND choice = 'like'
		GROUP BY restaurant_id
	`, roomID)
	if err != nil {
		return nil, fmt.Errorf("aggregate restaurant likes: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var restaurantID string
		var count int
		if err := rows.Scan(&restaurantID, &count); err != nil {
			return nil, fmt.Errorf("scan restaurant like count: %w", err)
		}
		if _, exists := counts[restaurantID]; !exists {
			return nil, fmt.Errorf("aggregate restaurant likes: unknown stored restaurant %q", restaurantID)
		}
		counts[restaurantID] = count
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read restaurant like counts: %w", err)
	}
	return counts, nil
}

func (transaction *restaurantVotingTransaction) InsertResult(
	ctx context.Context,
	result domain.RestaurantVoteResult,
) (domain.RestaurantVoteResult, error) {
	err := transaction.tx.QueryRow(ctx, `
		INSERT INTO restaurant_vote_results (room_id, restaurant_id, like_count, decision_method)
		VALUES ($1, $2, $3, $4)
		RETURNING decided_at
	`, result.RoomID, result.RestaurantID, result.LikeCount, result.DecisionMethod).Scan(&result.DecidedAt)
	if err != nil {
		return domain.RestaurantVoteResult{}, fmt.Errorf("insert restaurant vote result: %w", err)
	}
	return result, nil
}

func (transaction *restaurantVotingTransaction) IncrementRoomVersion(ctx context.Context, roomID string) (domain.Room, error) {
	return updateRestaurantVotingRoom(ctx, transaction.tx, `
		UPDATE rooms SET version = version + 1, updated_at = NOW() WHERE id = $1
		RETURNING id, join_code, status, version, expires_at, created_at, updated_at
	`, roomID)
}

func (transaction *restaurantVotingTransaction) AdvanceToDecided(ctx context.Context, roomID string) (domain.Room, error) {
	return updateRestaurantVotingRoom(ctx, transaction.tx, `
		UPDATE rooms
		SET status = 'decided', version = version + 1, updated_at = NOW()
		WHERE id = $1
		RETURNING id, join_code, status, version, expires_at, created_at, updated_at
	`, roomID)
}

func (transaction *restaurantVotingTransaction) FindState(
	ctx context.Context,
	roomID string,
	currentParticipantID string,
) (domain.RestaurantVotingState, error) {
	return findRestaurantVotingState(ctx, transaction.tx, roomID, currentParticipantID)
}

func updateRestaurantVotingRoom(ctx context.Context, tx pgx.Tx, query string, roomID string) (domain.Room, error) {
	var room domain.Room
	err := tx.QueryRow(ctx, query, roomID).Scan(
		&room.ID, &room.JoinCode, &room.Status, &room.Version,
		&room.ExpiresAt, &room.CreatedAt, &room.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Room{}, repository.ErrRoomNotFound
	}
	if err != nil {
		return domain.Room{}, fmt.Errorf("update restaurant voting room: %w", err)
	}
	return room, nil
}

func findRestaurantVotingState(
	ctx context.Context,
	queryer rowsQueryer,
	roomID string,
	currentParticipantID string,
) (domain.RestaurantVotingState, error) {
	rows, err := queryer.Query(ctx, `
		SELECT
			r.id, r.join_code, r.status, r.version, r.expires_at, r.created_at, r.updated_at,
			p.id, p.room_id, p.nickname, p.role, p.joined_at,
			s.submitted_at,
			COUNT(s.participant_id) OVER (), COUNT(*) OVER (),
			result.restaurant_id, result.like_count, result.decision_method, result.decided_at
		FROM rooms r
		JOIN participants p ON p.room_id = r.id
		LEFT JOIN restaurant_vote_submissions s
		  ON s.room_id = p.room_id AND s.participant_id = p.id
		LEFT JOIN restaurant_vote_results result ON result.room_id = r.id
		WHERE r.id = $1
		ORDER BY p.joined_at ASC, p.id ASC
	`, roomID)
	if err != nil {
		return domain.RestaurantVotingState{}, fmt.Errorf("query restaurant voting state: %w", err)
	}
	defer rows.Close()

	state := domain.RestaurantVotingState{
		CurrentParticipantID: currentParticipantID,
		Participants:         make([]domain.RestaurantVotingParticipant, 0),
	}
	for rows.Next() {
		var participant domain.Participant
		var submittedAt pgtype.Timestamptz
		var resultRestaurantID pgtype.Text
		var resultLikeCount pgtype.Int4
		var resultMethod pgtype.Text
		var resultDecidedAt pgtype.Timestamptz
		if err := rows.Scan(
			&state.Room.ID, &state.Room.JoinCode, &state.Room.Status, &state.Room.Version,
			&state.Room.ExpiresAt, &state.Room.CreatedAt, &state.Room.UpdatedAt,
			&participant.ID, &participant.RoomID, &participant.Nickname, &participant.Role, &participant.JoinedAt,
			&submittedAt, &state.SubmittedParticipantCount, &state.TotalParticipantCount,
			&resultRestaurantID, &resultLikeCount, &resultMethod, &resultDecidedAt,
		); err != nil {
			return domain.RestaurantVotingState{}, fmt.Errorf("scan restaurant voting state: %w", err)
		}
		submitted := submittedAt.Valid
		state.Participants = append(state.Participants, domain.RestaurantVotingParticipant{
			Participant: participant,
			Submitted:   submitted,
		})
		if participant.ID == currentParticipantID && submitted {
			value := submittedAt.Time
			state.Submitted = true
			state.SubmittedAt = &value
		}
		if resultRestaurantID.Valid {
			state.Result = &domain.RestaurantVoteResult{
				RoomID: roomID, RestaurantID: resultRestaurantID.String, LikeCount: int(resultLikeCount.Int32),
				DecisionMethod: domain.RestaurantDecisionMethod(resultMethod.String), DecidedAt: resultDecidedAt.Time,
			}
		}
	}
	if err := rows.Err(); err != nil {
		return domain.RestaurantVotingState{}, fmt.Errorf("read restaurant voting state: %w", err)
	}
	if len(state.Participants) == 0 {
		return domain.RestaurantVotingState{}, repository.ErrRoomNotFound
	}
	if state.Result != nil {
		candidates, err := listRestaurantCandidates(ctx, queryer, roomID)
		if err != nil {
			return domain.RestaurantVotingState{}, err
		}
		for _, candidate := range candidates {
			if candidate.RestaurantID == state.Result.RestaurantID {
				state.Result.Restaurant = candidate
				break
			}
		}
		if state.Result.Restaurant.RestaurantID == "" {
			return domain.RestaurantVotingState{}, fmt.Errorf("restaurant voting result references missing candidate")
		}
	}
	return state, nil
}
