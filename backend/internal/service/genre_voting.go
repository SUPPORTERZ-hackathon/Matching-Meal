package service

import (
	"context"
	"errors"
	"fmt"

	"meal/backend/internal/domain"
	"meal/backend/internal/repository"
	"meal/backend/internal/security"
)

var (
	ErrGenreVotingNotActive    = errors.New("genre voting not active")
	ErrVoteAlreadySubmitted    = errors.New("genre vote already submitted")
	ErrGenreVotingInconsistent = errors.New("genre voting state inconsistent")
)

type RandomIndexSelector interface {
	SelectIndex(upperBound int) (int, error)
}

type GenreVotingService struct {
	repository     repository.GenreVotingRepository
	roomRepository repository.RoomRepository
	selector       RandomIndexSelector
	clock          Clock
}

func NewGenreVotingService(
	genreRepository repository.GenreVotingRepository,
	roomRepository repository.RoomRepository,
	selector RandomIndexSelector,
	clock Clock,
) *GenreVotingService {
	return &GenreVotingService{
		repository: genreRepository, roomRepository: roomRepository, selector: selector, clock: clock,
	}
}

func (service *GenreVotingService) Submit(
	ctx context.Context,
	rawRoomID string,
	sessionToken string,
	rawVotes []domain.GenreVote,
) (domain.GenreVotingState, error) {
	operationContext, cancel := context.WithTimeout(ctx, roomOperationTimeout)
	defer cancel()

	roomID, participant, votes, err := service.validateAndAuthenticate(operationContext, rawRoomID, sessionToken, rawVotes)
	if err != nil {
		return domain.GenreVotingState{}, err
	}

	var result domain.GenreVotingState
	err = service.repository.WithinTransaction(operationContext, func(transaction repository.GenreVotingTransaction) error {
		room, err := transaction.FindRoomByIDForUpdate(operationContext, roomID)
		if errors.Is(err, repository.ErrRoomNotFound) {
			return ErrRoomNotFound
		}
		if err != nil {
			return err
		}
		if room.Status == domain.RoomStatusExpired || !service.clock.Now().Before(room.ExpiresAt) {
			return ErrRoomNotFound
		}

		storedVotes, _, err := transaction.FindSubmission(operationContext, participant.ID)
		switch {
		case err == nil:
			if !domain.GenreVotesEqual(storedVotes, votes) {
				return ErrVoteAlreadySubmitted
			}
			result, err = transaction.FindState(operationContext, roomID, participant.ID)
			if err != nil {
				return err
			}
			return validateGenreVotingState(result)
		case !errors.Is(err, repository.ErrGenreSubmissionNotFound):
			return err
		}

		if room.Status != domain.RoomStatusGenreVoting {
			return ErrGenreVotingNotActive
		}
		if _, err := transaction.InsertSubmission(operationContext, participant.ID, votes); err != nil {
			return err
		}
		participantCount, err := transaction.CountParticipants(operationContext, roomID)
		if err != nil {
			return err
		}
		submissionCount, err := transaction.CountSubmissions(operationContext, roomID)
		if err != nil {
			return err
		}
		if participantCount <= 0 || submissionCount <= 0 || submissionCount > participantCount {
			return ErrGenreVotingInconsistent
		}

		if submissionCount == participantCount {
			if err := service.decideGenre(operationContext, transaction, roomID); err != nil {
				return err
			}
			if _, err := transaction.AdvanceToRestaurantSearching(operationContext, roomID); err != nil {
				return err
			}
		} else if _, err := transaction.IncrementRoomVersion(operationContext, roomID); err != nil {
			return err
		}

		result, err = transaction.FindState(operationContext, roomID, participant.ID)
		if err != nil {
			return err
		}
		return validateGenreVotingState(result)
	})
	if err != nil {
		return domain.GenreVotingState{}, err
	}
	return result, nil
}

func (service *GenreVotingService) GetState(ctx context.Context, rawRoomID string, sessionToken string) (domain.GenreVotingState, error) {
	operationContext, cancel := context.WithTimeout(ctx, roomOperationTimeout)
	defer cancel()

	roomID, err := domain.NormalizeRoomID(rawRoomID)
	if err != nil {
		return domain.GenreVotingState{}, err
	}
	participant, err := service.authenticate(operationContext, roomID, sessionToken)
	if err != nil {
		return domain.GenreVotingState{}, err
	}
	state, err := service.repository.FindState(operationContext, roomID, participant.ID)
	if errors.Is(err, repository.ErrRoomNotFound) {
		return domain.GenreVotingState{}, ErrRoomNotFound
	}
	if err != nil {
		return domain.GenreVotingState{}, err
	}
	if state.Room.Status == domain.RoomStatusExpired || !service.clock.Now().Before(state.Room.ExpiresAt) {
		return domain.GenreVotingState{}, ErrRoomNotFound
	}
	if err := validateGenreVotingState(state); err != nil {
		return domain.GenreVotingState{}, err
	}
	return state, nil
}

func (service *GenreVotingService) validateAndAuthenticate(
	ctx context.Context,
	rawRoomID string,
	sessionToken string,
	rawVotes []domain.GenreVote,
) (string, domain.Participant, []domain.GenreVote, error) {
	roomID, err := domain.NormalizeRoomID(rawRoomID)
	if err != nil {
		return "", domain.Participant{}, nil, err
	}
	votes, err := domain.NormalizeGenreVotes(rawVotes)
	if err != nil {
		return "", domain.Participant{}, nil, err
	}
	participant, err := service.authenticate(ctx, roomID, sessionToken)
	if err != nil {
		return "", domain.Participant{}, nil, err
	}
	return roomID, participant, votes, nil
}

func (service *GenreVotingService) authenticate(ctx context.Context, roomID string, sessionToken string) (domain.Participant, error) {
	if sessionToken == "" {
		return domain.Participant{}, ErrUnauthorized
	}
	participant, err := service.roomRepository.FindParticipantBySessionTokenHash(ctx, security.HashSessionToken(sessionToken))
	if errors.Is(err, repository.ErrParticipantNotFound) {
		return domain.Participant{}, ErrUnauthorized
	}
	if err != nil {
		return domain.Participant{}, err
	}
	if participant.RoomID != roomID {
		return domain.Participant{}, ErrForbidden
	}
	return participant, nil
}

func (service *GenreVotingService) decideGenre(
	ctx context.Context,
	transaction repository.GenreVotingTransaction,
	roomID string,
) error {
	counts, err := transaction.AggregateLikeCounts(ctx, roomID)
	if err != nil {
		return err
	}
	candidates, likeCount, method, err := domain.GenreWinnerCandidates(counts)
	if err != nil || len(candidates) == 0 {
		return ErrGenreVotingInconsistent
	}
	winnerIndex := 0
	if len(candidates) > 1 {
		winnerIndex, err = service.selector.SelectIndex(len(candidates))
		if err != nil {
			return fmt.Errorf("select genre winner: %w", err)
		}
		if winnerIndex < 0 || winnerIndex >= len(candidates) {
			return ErrGenreVotingInconsistent
		}
	}
	_, err = transaction.InsertResult(ctx, domain.GenreVoteResult{
		RoomID: roomID, GenreID: candidates[winnerIndex], LikeCount: likeCount, DecisionMethod: method,
	})
	return err
}

func validateGenreVotingState(state domain.GenreVotingState) error {
	if state.TotalParticipantCount <= 0 || state.SubmittedParticipantCount < 0 || state.SubmittedParticipantCount > state.TotalParticipantCount {
		return ErrGenreVotingInconsistent
	}
	if len(state.Participants) != state.TotalParticipantCount {
		return ErrGenreVotingInconsistent
	}
	if state.Room.Status == domain.RoomStatusGenreVoting && state.Result != nil {
		return ErrGenreVotingInconsistent
	}
	switch state.Room.Status {
	case domain.RoomStatusRestaurantSearching, domain.RoomStatusRestaurantVoting, domain.RoomStatusDecided:
		if state.Result == nil {
			return ErrGenreVotingInconsistent
		}
	}
	return nil
}
