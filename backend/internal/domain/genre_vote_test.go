package domain

import (
	"errors"
	"os"
	"reflect"
	"regexp"
	"testing"
)

func TestGenreIDsMatchFrontend(t *testing.T) {
	source, err := os.ReadFile("../../../frontend/src/features/genre-vote/genres.ts")
	if errors.Is(err, os.ErrNotExist) {
		t.Skip("frontend source is not mounted in the backend-only test environment")
	}
	if err != nil {
		t.Fatalf("read frontend genres: %v", err)
	}
	matches := regexp.MustCompile(`id: "([^"]+)"`).FindAllSubmatch(source, -1)
	frontendIDs := make([]string, 0, len(matches))
	for _, match := range matches {
		frontendIDs = append(frontendIDs, string(match[1]))
	}
	if !reflect.DeepEqual(frontendIDs, GenreIDs()) {
		t.Fatalf("frontend genre IDs = %v, backend = %v", frontendIDs, GenreIDs())
	}
}

func TestNormalizeGenreVotes(t *testing.T) {
	votes := make([]GenreVote, 0, GenreCount)
	ids := GenreIDs()
	for index := len(ids) - 1; index >= 0; index-- {
		votes = append(votes, GenreVote{GenreID: ids[index], Choice: GenreVoteChoiceSkip})
	}

	normalized, err := NormalizeGenreVotes(votes)
	if err != nil {
		t.Fatalf("NormalizeGenreVotes() error = %v", err)
	}
	for index, genreID := range ids {
		if normalized[index].GenreID != genreID {
			t.Fatalf("normalized[%d] = %q, want %q", index, normalized[index].GenreID, genreID)
		}
	}
}

func TestNormalizeGenreVotesRejectsInvalidSets(t *testing.T) {
	valid := make([]GenreVote, 0, GenreCount)
	for _, genreID := range GenreIDs() {
		valid = append(valid, GenreVote{GenreID: genreID, Choice: GenreVoteChoiceLike})
	}
	tests := map[string][]GenreVote{
		"missing":        valid[:GenreCount-1],
		"duplicate":      append(append([]GenreVote{}, valid[:GenreCount-1]...), valid[0]),
		"unknown":        append(append([]GenreVote{}, valid[:GenreCount-1]...), GenreVote{GenreID: "unknown", Choice: GenreVoteChoiceLike}),
		"invalid choice": append(append([]GenreVote{}, valid[:GenreCount-1]...), GenreVote{GenreID: GenreIDs()[GenreCount-1], Choice: "maybe"}),
	}
	for name, votes := range tests {
		t.Run(name, func(t *testing.T) {
			if _, err := NormalizeGenreVotes(votes); !errors.Is(err, ErrInvalidGenreVotes) {
				t.Fatalf("NormalizeGenreVotes() error = %v", err)
			}
		})
	}
}

func TestGenreWinnerCandidates(t *testing.T) {
	counts := make(map[string]int, GenreCount)
	for _, id := range GenreIDs() {
		counts[id] = 0
	}
	counts["ramen"] = 3
	counts["sushi-seafood"] = 3

	candidates, maximum, method, err := GenreWinnerCandidates(counts)
	if err != nil {
		t.Fatalf("GenreWinnerCandidates() error = %v", err)
	}
	if !reflect.DeepEqual(candidates, []string{"ramen", "sushi-seafood"}) || maximum != 3 || method != GenreDecisionRandomTie {
		t.Fatalf("result = %v, %d, %q", candidates, maximum, method)
	}

	counts["ramen"] = 4
	candidates, maximum, method, err = GenreWinnerCandidates(counts)
	if err != nil || !reflect.DeepEqual(candidates, []string{"ramen"}) || maximum != 4 || method != GenreDecisionMostLikes {
		t.Fatalf("single winner result = %v, %d, %q, %v", candidates, maximum, method, err)
	}

	for id := range counts {
		counts[id] = 0
	}
	candidates, maximum, method, err = GenreWinnerCandidates(counts)
	if err != nil || len(candidates) != GenreCount || maximum != 0 || method != GenreDecisionRandomAllSkipped {
		t.Fatalf("all skipped result = %v, %d, %q, %v", candidates, maximum, method, err)
	}
}
