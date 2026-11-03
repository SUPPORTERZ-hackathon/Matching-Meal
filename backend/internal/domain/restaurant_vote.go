package domain

import (
	"errors"
	"slices"
	"strings"
	"time"
)

type RestaurantVoteChoice string
type RestaurantDecisionMethod string

const (
	RestaurantVoteChoiceLike RestaurantVoteChoice = "like"
	RestaurantVoteChoiceSkip RestaurantVoteChoice = "skip"

	RestaurantDecisionMostLikes        RestaurantDecisionMethod = "most_likes"
	RestaurantDecisionRandomTie        RestaurantDecisionMethod = "random_tie"
	RestaurantDecisionRandomAllSkipped RestaurantDecisionMethod = "random_all_skipped"
)

var ErrInvalidRestaurantVotes = errors.New("invalid restaurant votes")

type RestaurantVote struct {
	RestaurantID string
	Choice       RestaurantVoteChoice
}

type RestaurantVoteResult struct {
	RoomID         string
	RestaurantID   string
	LikeCount      int
	DecisionMethod RestaurantDecisionMethod
	DecidedAt      time.Time
	Restaurant     RestaurantCandidate
}

type RestaurantVotingParticipant struct {
	Participant Participant
	Submitted   bool
}

type RestaurantVotingState struct {
	Room                      Room
	CurrentParticipantID      string
	Submitted                 bool
	SubmittedAt               *time.Time
	SubmittedParticipantCount int
	TotalParticipantCount     int
	Participants              []RestaurantVotingParticipant
	Result                    *RestaurantVoteResult
}

func NormalizeRestaurantVotes(votes []RestaurantVote, candidates []RestaurantCandidate) ([]RestaurantVote, error) {
	if len(candidates) == 0 || len(candidates) > MaxRestaurantCandidates || len(votes) != len(candidates) {
		return nil, ErrInvalidRestaurantVotes
	}

	byRestaurant := make(map[string]RestaurantVoteChoice, len(votes))
	for _, vote := range votes {
		if strings.TrimSpace(vote.RestaurantID) == "" ||
			(vote.Choice != RestaurantVoteChoiceLike && vote.Choice != RestaurantVoteChoiceSkip) {
			return nil, ErrInvalidRestaurantVotes
		}
		if _, exists := byRestaurant[vote.RestaurantID]; exists {
			return nil, ErrInvalidRestaurantVotes
		}
		byRestaurant[vote.RestaurantID] = vote.Choice
	}

	normalized := make([]RestaurantVote, 0, len(candidates))
	seenCandidates := make(map[string]struct{}, len(candidates))
	for index, candidate := range candidates {
		if candidate.Position != int16(index+1) || strings.TrimSpace(candidate.RestaurantID) == "" {
			return nil, ErrInvalidRestaurantVotes
		}
		if _, exists := seenCandidates[candidate.RestaurantID]; exists {
			return nil, ErrInvalidRestaurantVotes
		}
		seenCandidates[candidate.RestaurantID] = struct{}{}
		choice, exists := byRestaurant[candidate.RestaurantID]
		if !exists {
			return nil, ErrInvalidRestaurantVotes
		}
		normalized = append(normalized, RestaurantVote{RestaurantID: candidate.RestaurantID, Choice: choice})
	}
	return normalized, nil
}

func RestaurantVotesEqual(left []RestaurantVote, right []RestaurantVote) bool {
	return slices.Equal(left, right)
}

func RestaurantWinnerCandidates(
	candidates []RestaurantCandidate,
	likeCounts map[string]int,
) ([]string, int, RestaurantDecisionMethod, error) {
	if len(candidates) == 0 || len(candidates) > MaxRestaurantCandidates || len(likeCounts) != len(candidates) {
		return nil, 0, "", ErrInvalidRestaurantVotes
	}

	maximum := -1
	winners := make([]string, 0, len(candidates))
	seen := make(map[string]struct{}, len(candidates))
	for index, candidate := range candidates {
		if candidate.Position != int16(index+1) || strings.TrimSpace(candidate.RestaurantID) == "" {
			return nil, 0, "", ErrInvalidRestaurantVotes
		}
		if _, exists := seen[candidate.RestaurantID]; exists {
			return nil, 0, "", ErrInvalidRestaurantVotes
		}
		seen[candidate.RestaurantID] = struct{}{}
		count, exists := likeCounts[candidate.RestaurantID]
		if !exists || count < 0 {
			return nil, 0, "", ErrInvalidRestaurantVotes
		}
		switch {
		case count > maximum:
			maximum = count
			winners = []string{candidate.RestaurantID}
		case count == maximum:
			winners = append(winners, candidate.RestaurantID)
		}
	}

	method := RestaurantDecisionMostLikes
	if maximum == 0 {
		method = RestaurantDecisionRandomAllSkipped
	} else if len(winners) > 1 {
		method = RestaurantDecisionRandomTie
	}
	return winners, maximum, method, nil
}
