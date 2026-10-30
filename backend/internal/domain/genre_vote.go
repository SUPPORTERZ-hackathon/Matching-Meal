package domain

import (
	"errors"
	"slices"
	"time"
)

type GenreVoteChoice string
type GenreDecisionMethod string

const (
	GenreVoteChoiceLike GenreVoteChoice = "like"
	GenreVoteChoiceSkip GenreVoteChoice = "skip"

	GenreDecisionMostLikes        GenreDecisionMethod = "most_likes"
	GenreDecisionRandomTie        GenreDecisionMethod = "random_tie"
	GenreDecisionRandomAllSkipped GenreDecisionMethod = "random_all_skipped"
	GenreCount                                        = 16
)

var (
	ErrInvalidGenreVotes = errors.New("invalid genre votes")
	genreIDs             = [...]string{
		"ramen", "sushi-seafood", "yakiniku", "steak-hamburg",
		"curry", "soba-udon", "teishoku", "italian",
		"chinese", "korean", "asian", "hamburger",
		"okonomiyaki-takoyaki", "nabe-shabushabu", "izakaya", "cafe",
	}
)

type GenreVote struct {
	GenreID string
	Choice  GenreVoteChoice
}

type GenreVoteResult struct {
	RoomID         string
	GenreID        string
	LikeCount      int
	DecisionMethod GenreDecisionMethod
	DecidedAt      time.Time
}

type GenreVotingParticipant struct {
	Participant Participant
	Submitted   bool
}

type GenreVotingState struct {
	Room                      Room
	CurrentParticipantID      string
	Submitted                 bool
	SubmittedAt               *time.Time
	SubmittedParticipantCount int
	TotalParticipantCount     int
	Participants              []GenreVotingParticipant
	Result                    *GenreVoteResult
}

func GenreIDs() []string {
	return slices.Clone(genreIDs[:])
}

func NormalizeGenreVotes(votes []GenreVote) ([]GenreVote, error) {
	if len(votes) != GenreCount {
		return nil, ErrInvalidGenreVotes
	}

	byGenre := make(map[string]GenreVoteChoice, GenreCount)
	for _, vote := range votes {
		if vote.Choice != GenreVoteChoiceLike && vote.Choice != GenreVoteChoiceSkip {
			return nil, ErrInvalidGenreVotes
		}
		if _, exists := byGenre[vote.GenreID]; exists {
			return nil, ErrInvalidGenreVotes
		}
		byGenre[vote.GenreID] = vote.Choice
	}

	normalized := make([]GenreVote, 0, GenreCount)
	for _, genreID := range genreIDs {
		choice, exists := byGenre[genreID]
		if !exists {
			return nil, ErrInvalidGenreVotes
		}
		normalized = append(normalized, GenreVote{GenreID: genreID, Choice: choice})
	}
	return normalized, nil
}

func GenreVotesEqual(left []GenreVote, right []GenreVote) bool {
	return slices.Equal(left, right)
}

func GenreWinnerCandidates(likeCounts map[string]int) ([]string, int, GenreDecisionMethod, error) {
	maximum := -1
	candidates := make([]string, 0, GenreCount)
	for _, genreID := range genreIDs {
		count, exists := likeCounts[genreID]
		if !exists || count < 0 {
			return nil, 0, "", ErrInvalidGenreVotes
		}
		switch {
		case count > maximum:
			maximum = count
			candidates = []string{genreID}
		case count == maximum:
			candidates = append(candidates, genreID)
		}
	}

	decisionMethod := GenreDecisionMostLikes
	if maximum == 0 {
		decisionMethod = GenreDecisionRandomAllSkipped
	} else if len(candidates) > 1 {
		decisionMethod = GenreDecisionRandomTie
	}
	return candidates, maximum, decisionMethod, nil
}
