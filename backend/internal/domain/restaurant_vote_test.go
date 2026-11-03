package domain

import (
	"errors"
	"reflect"
	"testing"
)

func restaurantVoteCandidates(ids ...string) []RestaurantCandidate {
	candidates := make([]RestaurantCandidate, 0, len(ids))
	for index, id := range ids {
		candidates = append(candidates, RestaurantCandidate{RestaurantID: id, Position: int16(index + 1)})
	}
	return candidates
}

func TestNormalizeRestaurantVotes(t *testing.T) {
	candidates := restaurantVoteCandidates("J001", "J002", "J003")
	votes := []RestaurantVote{
		{RestaurantID: "J003", Choice: RestaurantVoteChoiceSkip},
		{RestaurantID: "J001", Choice: RestaurantVoteChoiceLike},
		{RestaurantID: "J002", Choice: RestaurantVoteChoiceSkip},
	}

	normalized, err := NormalizeRestaurantVotes(votes, candidates)
	if err != nil {
		t.Fatalf("NormalizeRestaurantVotes() error = %v", err)
	}
	want := []RestaurantVote{
		{RestaurantID: "J001", Choice: RestaurantVoteChoiceLike},
		{RestaurantID: "J002", Choice: RestaurantVoteChoiceSkip},
		{RestaurantID: "J003", Choice: RestaurantVoteChoiceSkip},
	}
	if !reflect.DeepEqual(normalized, want) {
		t.Fatalf("NormalizeRestaurantVotes() = %+v, want %+v", normalized, want)
	}
}

func TestNormalizeRestaurantVotesRejectsInvalidSets(t *testing.T) {
	candidates := restaurantVoteCandidates("J001", "J002")
	valid := []RestaurantVote{
		{RestaurantID: "J001", Choice: RestaurantVoteChoiceLike},
		{RestaurantID: "J002", Choice: RestaurantVoteChoiceSkip},
	}
	tests := map[string]struct {
		votes      []RestaurantVote
		candidates []RestaurantCandidate
	}{
		"missing":             {votes: valid[:1], candidates: candidates},
		"duplicate":           {votes: []RestaurantVote{valid[0], valid[0]}, candidates: candidates},
		"unknown":             {votes: []RestaurantVote{valid[0], {RestaurantID: "J999", Choice: RestaurantVoteChoiceSkip}}, candidates: candidates},
		"blank id":            {votes: []RestaurantVote{valid[0], {RestaurantID: " ", Choice: RestaurantVoteChoiceSkip}}, candidates: candidates},
		"invalid choice":      {votes: []RestaurantVote{valid[0], {RestaurantID: "J002", Choice: "maybe"}}, candidates: candidates},
		"candidate gap":       {votes: valid, candidates: []RestaurantCandidate{{RestaurantID: "J001", Position: 1}, {RestaurantID: "J002", Position: 3}}},
		"too many":            {votes: make([]RestaurantVote, MaxRestaurantCandidates+1), candidates: make([]RestaurantCandidate, MaxRestaurantCandidates+1)},
		"no candidates":       {votes: nil, candidates: nil},
		"duplicate candidate": {votes: valid, candidates: restaurantVoteCandidates("J001", "J001")},
	}
	for name, test := range tests {
		t.Run(name, func(t *testing.T) {
			if _, err := NormalizeRestaurantVotes(test.votes, test.candidates); !errors.Is(err, ErrInvalidRestaurantVotes) {
				t.Fatalf("NormalizeRestaurantVotes() error = %v", err)
			}
		})
	}
}

func TestRestaurantWinnerCandidates(t *testing.T) {
	candidates := restaurantVoteCandidates("J001", "J002", "J003")
	tests := map[string]struct {
		counts     map[string]int
		wantIDs    []string
		wantCount  int
		wantMethod RestaurantDecisionMethod
	}{
		"single winner": {
			counts: map[string]int{"J001": 3, "J002": 2, "J003": 1}, wantIDs: []string{"J001"},
			wantCount: 3, wantMethod: RestaurantDecisionMostLikes,
		},
		"tie": {
			counts: map[string]int{"J001": 2, "J002": 1, "J003": 2}, wantIDs: []string{"J001", "J003"},
			wantCount: 2, wantMethod: RestaurantDecisionRandomTie,
		},
		"all skipped": {
			counts: map[string]int{"J001": 0, "J002": 0, "J003": 0}, wantIDs: []string{"J001", "J002", "J003"},
			wantCount: 0, wantMethod: RestaurantDecisionRandomAllSkipped,
		},
	}
	for name, test := range tests {
		t.Run(name, func(t *testing.T) {
			ids, count, method, err := RestaurantWinnerCandidates(candidates, test.counts)
			if err != nil || !reflect.DeepEqual(ids, test.wantIDs) || count != test.wantCount || method != test.wantMethod {
				t.Fatalf("RestaurantWinnerCandidates() = %v, %d, %q, %v", ids, count, method, err)
			}
		})
	}
}

func TestRestaurantWinnerCandidatesSingleAllSkipped(t *testing.T) {
	candidates := restaurantVoteCandidates("J001")
	ids, count, method, err := RestaurantWinnerCandidates(candidates, map[string]int{"J001": 0})
	if err != nil || !reflect.DeepEqual(ids, []string{"J001"}) || count != 0 || method != RestaurantDecisionRandomAllSkipped {
		t.Fatalf("RestaurantWinnerCandidates() = %v, %d, %q, %v", ids, count, method, err)
	}
}

func TestRestaurantWinnerCandidatesRejectsInvalidCounts(t *testing.T) {
	candidates := restaurantVoteCandidates("J001", "J002")
	for name, counts := range map[string]map[string]int{
		"missing":  {"J001": 1},
		"unknown":  {"J001": 1, "J999": 0},
		"negative": {"J001": 1, "J002": -1},
	} {
		t.Run(name, func(t *testing.T) {
			if _, _, _, err := RestaurantWinnerCandidates(candidates, counts); !errors.Is(err, ErrInvalidRestaurantVotes) {
				t.Fatalf("RestaurantWinnerCandidates() error = %v", err)
			}
		})
	}
}
