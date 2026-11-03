package service

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"meal/backend/internal/domain"
	"meal/backend/internal/repository"
	"meal/backend/internal/security"
)

var (
	ErrRestaurantCandidatesMismatch = errors.New("restaurant candidates mismatch")
	ErrRestaurantVotingNotActive    = errors.New("restaurant voting not active")
	ErrRestaurantVotingNotReady     = errors.New("restaurant voting not ready")
	ErrRestaurantVotingInconsistent = errors.New("restaurant voting state inconsistent")
)

type RestaurantVotingService struct {
	repository     repository.RestaurantVotingRepository
	roomRepository repository.RoomRepository
	selector       RandomIndexSelector
	clock          Clock
}

func NewRestaurantVotingService(
	restaurantRepository repository.RestaurantVotingRepository,
	roomRepository repository.RoomRepository,
	selector RandomIndexSelector,
	clock Clock,
) *RestaurantVotingService {
	return &RestaurantVotingService{
		repository: restaurantRepository, roomRepository: roomRepository, selector: selector, clock: clock,
	}
}

func (service *RestaurantVotingService) Submit(
	ctx context.Context,
	rawRoomID string,
	sessionToken string,
	rawVotes []domain.RestaurantVote,
) (domain.RestaurantVotingState, error) {
	operationContext, cancel := context.WithTimeout(ctx, roomOperationTimeout)
	defer cancel()

	roomID, err := domain.NormalizeRoomID(rawRoomID)
	if err != nil {
		return domain.RestaurantVotingState{}, err
	}
	if err := validateRestaurantVoteInput(rawVotes); err != nil {
		return domain.RestaurantVotingState{}, err
	}
	participant, err := service.authenticate(operationContext, roomID, sessionToken)
	if err != nil {
		return domain.RestaurantVotingState{}, err
	}

	var result domain.RestaurantVotingState
	err = service.repository.WithinTransaction(operationContext, func(transaction repository.RestaurantVotingTransaction) error {
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

		candidates, err := transaction.ListCandidates(operationContext, roomID)
		if err != nil {
			return err
		}
		votes, err := normalizeRestaurantVotesForCandidates(rawVotes, candidates)
		if err != nil {
			return err
		}

		storedVotes, _, err := transaction.FindSubmission(operationContext, roomID, participant.ID, candidates)
		switch {
		case err == nil:
			if !domain.RestaurantVotesEqual(storedVotes, votes) {
				return ErrVoteAlreadySubmitted
			}
			result, err = transaction.FindState(operationContext, roomID, participant.ID)
			if err != nil {
				return err
			}
			return validateRestaurantVotingState(result)
		case !errors.Is(err, repository.ErrRestaurantSubmissionNotFound):
			return err
		}

		if room.Status != domain.RoomStatusRestaurantVoting {
			return ErrRestaurantVotingNotActive
		}
		if _, err := transaction.InsertSubmission(operationContext, roomID, participant.ID, votes); err != nil {
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
			return ErrRestaurantVotingInconsistent
		}

		if submissionCount == participantCount {
			if err := service.decideRestaurant(operationContext, transaction, roomID, candidates); err != nil {
				return err
			}
			if _, err := transaction.AdvanceToDecided(operationContext, roomID); err != nil {
				return err
			}
		} else if _, err := transaction.IncrementRoomVersion(operationContext, roomID); err != nil {
			return err
		}

		result, err = transaction.FindState(operationContext, roomID, participant.ID)
		if err != nil {
			return err
		}
		return validateRestaurantVotingState(result)
	})
	if err != nil {
		return domain.RestaurantVotingState{}, err
	}
	return result, nil
}

func (service *RestaurantVotingService) GetState(
	ctx context.Context,
	rawRoomID string,
	sessionToken string,
) (domain.RestaurantVotingState, error) {
	operationContext, cancel := context.WithTimeout(ctx, roomOperationTimeout)
	defer cancel()

	roomID, err := domain.NormalizeRoomID(rawRoomID)
	if err != nil {
		return domain.RestaurantVotingState{}, err
	}
	participant, err := service.authenticate(operationContext, roomID, sessionToken)
	if err != nil {
		return domain.RestaurantVotingState{}, err
	}
	state, err := service.repository.FindState(operationContext, roomID, participant.ID)
	if errors.Is(err, repository.ErrRoomNotFound) {
		return domain.RestaurantVotingState{}, ErrRoomNotFound
	}
	if err != nil {
		return domain.RestaurantVotingState{}, err
	}
	if state.Room.Status == domain.RoomStatusExpired || !service.clock.Now().Before(state.Room.ExpiresAt) {
		return domain.RestaurantVotingState{}, ErrRoomNotFound
	}
	if state.Room.Status != domain.RoomStatusRestaurantVoting && state.Room.Status != domain.RoomStatusDecided {
		return domain.RestaurantVotingState{}, ErrRestaurantVotingNotReady
	}
	if err := validateRestaurantVotingState(state); err != nil {
		return domain.RestaurantVotingState{}, err
	}
	return state, nil
}

func (service *RestaurantVotingService) authenticate(
	ctx context.Context,
	roomID string,
	sessionToken string,
) (domain.Participant, error) {
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

func (service *RestaurantVotingService) decideRestaurant(
	ctx context.Context,
	transaction repository.RestaurantVotingTransaction,
	roomID string,
	candidates []domain.RestaurantCandidate,
) error {
	counts, err := transaction.AggregateLikeCounts(ctx, roomID, candidates)
	if err != nil {
		return err
	}
	winners, likeCount, method, err := domain.RestaurantWinnerCandidates(candidates, counts)
	if err != nil || len(winners) == 0 {
		return ErrRestaurantVotingInconsistent
	}
	winnerIndex := 0
	if len(winners) > 1 {
		winnerIndex, err = service.selector.SelectIndex(len(winners))
		if err != nil {
			return fmt.Errorf("select restaurant winner: %w", err)
		}
		if winnerIndex < 0 || winnerIndex >= len(winners) {
			return ErrRestaurantVotingInconsistent
		}
	}
	_, err = transaction.InsertResult(ctx, domain.RestaurantVoteResult{
		RoomID: roomID, RestaurantID: winners[winnerIndex], LikeCount: likeCount, DecisionMethod: method,
	})
	return err
}

func validateRestaurantVoteInput(votes []domain.RestaurantVote) error {
	if len(votes) == 0 || len(votes) > domain.MaxRestaurantCandidates {
		return domain.ErrInvalidRestaurantVotes
	}
	seen := make(map[string]struct{}, len(votes))
	for _, vote := range votes {
		if strings.TrimSpace(vote.RestaurantID) == "" ||
			(vote.Choice != domain.RestaurantVoteChoiceLike && vote.Choice != domain.RestaurantVoteChoiceSkip) {
			return domain.ErrInvalidRestaurantVotes
		}
		if _, exists := seen[vote.RestaurantID]; exists {
			return domain.ErrInvalidRestaurantVotes
		}
		seen[vote.RestaurantID] = struct{}{}
	}
	return nil
}

func normalizeRestaurantVotesForCandidates(
	votes []domain.RestaurantVote,
	candidates []domain.RestaurantCandidate,
) ([]domain.RestaurantVote, error) {
	if len(candidates) == 0 || len(candidates) > domain.MaxRestaurantCandidates {
		return nil, ErrRestaurantVotingInconsistent
	}
	seen := make(map[string]struct{}, len(candidates))
	for index, candidate := range candidates {
		if candidate.Position != int16(index+1) || strings.TrimSpace(candidate.RestaurantID) == "" {
			return nil, ErrRestaurantVotingInconsistent
		}
		if _, exists := seen[candidate.RestaurantID]; exists {
			return nil, ErrRestaurantVotingInconsistent
		}
		seen[candidate.RestaurantID] = struct{}{}
	}
	if len(votes) != len(candidates) {
		return nil, ErrRestaurantCandidatesMismatch
	}
	for _, vote := range votes {
		if _, exists := seen[vote.RestaurantID]; !exists {
			return nil, ErrRestaurantCandidatesMismatch
		}
	}
	normalized, err := domain.NormalizeRestaurantVotes(votes, candidates)
	if err != nil {
		return nil, ErrRestaurantVotingInconsistent
	}
	return normalized, nil
}

func validateRestaurantVotingState(state domain.RestaurantVotingState) error {
	if state.TotalParticipantCount <= 0 || state.SubmittedParticipantCount < 0 ||
		state.SubmittedParticipantCount > state.TotalParticipantCount ||
		len(state.Participants) != state.TotalParticipantCount {
		return ErrRestaurantVotingInconsistent
	}
	if state.Room.Status == domain.RoomStatusRestaurantVoting && state.Result != nil {
		return ErrRestaurantVotingInconsistent
	}
	if state.Room.Status == domain.RoomStatusDecided {
		if state.Result == nil || state.Result.RestaurantID == "" ||
			state.Result.Restaurant.RestaurantID != state.Result.RestaurantID {
			return ErrRestaurantVotingInconsistent
		}
	}
	return nil
}
