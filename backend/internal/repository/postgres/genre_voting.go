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

type GenreVotingRepository struct {
	pool *pgxpool.Pool
}

type genreVotingTransaction struct {
	tx pgx.Tx
}

type rowsQueryer interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
}

func NewGenreVotingRepository(pool *pgxpool.Pool) *GenreVotingRepository {
	return &GenreVotingRepository{pool: pool}
}

func (genreRepository *GenreVotingRepository) WithinTransaction(ctx context.Context, operation func(repository.GenreVotingTransaction) error) error {
	tx, err := genreRepository.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin genre voting transaction: %w", err)
	}
	defer func() { rollback(tx) }()

	if err := operation(&genreVotingTransaction{tx: tx}); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit genre voting transaction: %w", err)
	}
	return nil
}

func (genreRepository *GenreVotingRepository) FindState(ctx context.Context, roomID string, currentParticipantID string) (domain.GenreVotingState, error) {
	return findGenreVotingState(ctx, genreRepository.pool, roomID, currentParticipantID)
}

func (transaction *genreVotingTransaction) FindRoomByIDForUpdate(ctx context.Context, roomID string) (domain.Room, error) {
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
		return domain.Room{}, fmt.Errorf("find genre voting room for update: %w", err)
	}
	return room, nil
}

func (transaction *genreVotingTransaction) FindSubmission(ctx context.Context, participantID string) ([]domain.GenreVote, *time.Time, error) {
	var submittedAt time.Time
	if err := transaction.tx.QueryRow(ctx, `
		SELECT submitted_at FROM genre_vote_submissions WHERE participant_id = $1
	`, participantID).Scan(&submittedAt); errors.Is(err, pgx.ErrNoRows) {
		return nil, nil, repository.ErrGenreSubmissionNotFound
	} else if err != nil {
		return nil, nil, fmt.Errorf("find genre vote submission: %w", err)
	}

	rows, err := transaction.tx.Query(ctx, `
		SELECT genre_id, choice FROM genre_votes WHERE participant_id = $1
	`, participantID)
	if err != nil {
		return nil, nil, fmt.Errorf("query submitted genre votes: %w", err)
	}
	defer rows.Close()
	votes := make([]domain.GenreVote, 0, domain.GenreCount)
	for rows.Next() {
		var vote domain.GenreVote
		if err := rows.Scan(&vote.GenreID, &vote.Choice); err != nil {
			return nil, nil, fmt.Errorf("scan submitted genre vote: %w", err)
		}
		votes = append(votes, vote)
	}
	if err := rows.Err(); err != nil {
		return nil, nil, fmt.Errorf("read submitted genre votes: %w", err)
	}
	normalized, err := domain.NormalizeGenreVotes(votes)
	if err != nil {
		return nil, nil, fmt.Errorf("stored genre votes are inconsistent: %w", err)
	}
	return normalized, &submittedAt, nil
}

func (transaction *genreVotingTransaction) InsertSubmission(ctx context.Context, participantID string, votes []domain.GenreVote) (time.Time, error) {
	var submittedAt time.Time
	if err := transaction.tx.QueryRow(ctx, `
		INSERT INTO genre_vote_submissions (participant_id)
		VALUES ($1)
		RETURNING submitted_at
	`, participantID).Scan(&submittedAt); err != nil {
		return time.Time{}, fmt.Errorf("insert genre vote submission: %w", err)
	}
	for _, vote := range votes {
		if _, err := transaction.tx.Exec(ctx, `
			INSERT INTO genre_votes (participant_id, genre_id, choice)
			VALUES ($1, $2, $3)
		`, participantID, vote.GenreID, vote.Choice); err != nil {
			return time.Time{}, fmt.Errorf("insert genre vote: %w", err)
		}
	}
	return submittedAt, nil
}

func (transaction *genreVotingTransaction) CountParticipants(ctx context.Context, roomID string) (int, error) {
	var count int
	if err := transaction.tx.QueryRow(ctx, `SELECT COUNT(*) FROM participants WHERE room_id = $1`, roomID).Scan(&count); err != nil {
		return 0, fmt.Errorf("count genre voting participants: %w", err)
	}
	return count, nil
}

func (transaction *genreVotingTransaction) CountSubmissions(ctx context.Context, roomID string) (int, error) {
	var count int
	if err := transaction.tx.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM genre_vote_submissions s
		JOIN participants p ON p.id = s.participant_id
		WHERE p.room_id = $1
	`, roomID).Scan(&count); err != nil {
		return 0, fmt.Errorf("count genre vote submissions: %w", err)
	}
	return count, nil
}

func (transaction *genreVotingTransaction) AggregateLikeCounts(ctx context.Context, roomID string) (map[string]int, error) {
	counts := make(map[string]int, domain.GenreCount)
	for _, genreID := range domain.GenreIDs() {
		counts[genreID] = 0
	}
	rows, err := transaction.tx.Query(ctx, `
		SELECT v.genre_id, COUNT(*)
		FROM genre_votes v
		JOIN participants p ON p.id = v.participant_id
		WHERE p.room_id = $1 AND v.choice = 'like'
		GROUP BY v.genre_id
	`, roomID)
	if err != nil {
		return nil, fmt.Errorf("aggregate genre likes: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var genreID string
		var count int
		if err := rows.Scan(&genreID, &count); err != nil {
			return nil, fmt.Errorf("scan genre like count: %w", err)
		}
		if _, exists := counts[genreID]; !exists {
			return nil, fmt.Errorf("aggregate genre likes: unknown stored genre %q", genreID)
		}
		counts[genreID] = count
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read genre like counts: %w", err)
	}
	return counts, nil
}

func (transaction *genreVotingTransaction) InsertResult(ctx context.Context, result domain.GenreVoteResult) (domain.GenreVoteResult, error) {
	err := transaction.tx.QueryRow(ctx, `
		INSERT INTO genre_vote_results (room_id, genre_id, like_count, decision_method)
		VALUES ($1, $2, $3, $4)
		RETURNING decided_at
	`, result.RoomID, result.GenreID, result.LikeCount, result.DecisionMethod).Scan(&result.DecidedAt)
	if err != nil {
		return domain.GenreVoteResult{}, fmt.Errorf("insert genre vote result: %w", err)
	}
	return result, nil
}

func (transaction *genreVotingTransaction) IncrementRoomVersion(ctx context.Context, roomID string) (domain.Room, error) {
	return updateGenreVotingRoom(ctx, transaction.tx, `
		UPDATE rooms SET version = version + 1, updated_at = NOW() WHERE id = $1
		RETURNING id, join_code, status, version, expires_at, created_at, updated_at
	`, roomID)
}

func (transaction *genreVotingTransaction) AdvanceToRestaurantSearching(ctx context.Context, roomID string) (domain.Room, error) {
	return updateGenreVotingRoom(ctx, transaction.tx, `
		UPDATE rooms
		SET status = 'restaurant_searching', version = version + 1, updated_at = NOW()
		WHERE id = $1
		RETURNING id, join_code, status, version, expires_at, created_at, updated_at
	`, roomID)
}

func (transaction *genreVotingTransaction) FindState(ctx context.Context, roomID string, currentParticipantID string) (domain.GenreVotingState, error) {
	return findGenreVotingState(ctx, transaction.tx, roomID, currentParticipantID)
}

func updateGenreVotingRoom(ctx context.Context, tx pgx.Tx, query string, roomID string) (domain.Room, error) {
	var room domain.Room
	err := tx.QueryRow(ctx, query, roomID).Scan(
		&room.ID, &room.JoinCode, &room.Status, &room.Version,
		&room.ExpiresAt, &room.CreatedAt, &room.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Room{}, repository.ErrRoomNotFound
	}
	if err != nil {
		return domain.Room{}, fmt.Errorf("update genre voting room: %w", err)
	}
	return room, nil
}

func findGenreVotingState(ctx context.Context, queryer rowsQueryer, roomID string, currentParticipantID string) (domain.GenreVotingState, error) {
	rows, err := queryer.Query(ctx, `
		SELECT
			r.id, r.join_code, r.status, r.version, r.expires_at, r.created_at, r.updated_at,
			p.id, p.room_id, p.nickname, p.role, p.joined_at,
			s.submitted_at,
			COUNT(s.participant_id) OVER (), COUNT(*) OVER (),
			result.genre_id, result.like_count, result.decision_method, result.decided_at
		FROM rooms r
		JOIN participants p ON p.room_id = r.id
		LEFT JOIN genre_vote_submissions s ON s.participant_id = p.id
		LEFT JOIN genre_vote_results result ON result.room_id = r.id
		WHERE r.id = $1
		ORDER BY p.joined_at ASC, p.id ASC
	`, roomID)
	if err != nil {
		return domain.GenreVotingState{}, fmt.Errorf("query genre voting state: %w", err)
	}
	defer rows.Close()

	state := domain.GenreVotingState{CurrentParticipantID: currentParticipantID, Participants: make([]domain.GenreVotingParticipant, 0)}
	for rows.Next() {
		var participant domain.Participant
		var submittedAt pgtype.Timestamptz
		var resultGenreID pgtype.Text
		var resultLikeCount pgtype.Int4
		var resultMethod pgtype.Text
		var resultDecidedAt pgtype.Timestamptz
		if err := rows.Scan(
			&state.Room.ID, &state.Room.JoinCode, &state.Room.Status, &state.Room.Version,
			&state.Room.ExpiresAt, &state.Room.CreatedAt, &state.Room.UpdatedAt,
			&participant.ID, &participant.RoomID, &participant.Nickname, &participant.Role, &participant.JoinedAt,
			&submittedAt, &state.SubmittedParticipantCount, &state.TotalParticipantCount,
			&resultGenreID, &resultLikeCount, &resultMethod, &resultDecidedAt,
		); err != nil {
			return domain.GenreVotingState{}, fmt.Errorf("scan genre voting state: %w", err)
		}
		submitted := submittedAt.Valid
		state.Participants = append(state.Participants, domain.GenreVotingParticipant{Participant: participant, Submitted: submitted})
		if participant.ID == currentParticipantID && submitted {
			value := submittedAt.Time
			state.Submitted = true
			state.SubmittedAt = &value
		}
		if resultGenreID.Valid {
			state.Result = &domain.GenreVoteResult{
				RoomID: roomID, GenreID: resultGenreID.String, LikeCount: int(resultLikeCount.Int32),
				DecisionMethod: domain.GenreDecisionMethod(resultMethod.String), DecidedAt: resultDecidedAt.Time,
			}
		}
	}
	if err := rows.Err(); err != nil {
		return domain.GenreVotingState{}, fmt.Errorf("read genre voting state: %w", err)
	}
	if len(state.Participants) == 0 {
		return domain.GenreVotingState{}, repository.ErrRoomNotFound
	}
	return state, nil
}
