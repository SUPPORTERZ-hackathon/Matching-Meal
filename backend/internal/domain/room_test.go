package domain

import (
	"errors"
	"strings"
	"testing"
)

func TestNormalizeNickname(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name      string
		input     string
		expected  string
		expectsOK bool
	}{
		{name: "trims surrounding whitespace", input: " ひかる ", expected: "ひかる", expectsOK: true},
		{name: "accepts maximum length", input: strings.Repeat("あ", NicknameMaxLength), expected: strings.Repeat("あ", NicknameMaxLength), expectsOK: true},
		{name: "rejects blank", input: "　 ", expectsOK: false},
		{name: "rejects over maximum length", input: strings.Repeat("a", NicknameMaxLength+1), expectsOK: false},
		{name: "rejects control characters", input: "ひかる\nさん", expectsOK: false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			actual, err := NormalizeNickname(test.input)
			if test.expectsOK {
				if err != nil {
					t.Fatalf("NormalizeNickname() error = %v", err)
				}
				if actual != test.expected {
					t.Fatalf("NormalizeNickname() = %q, want %q", actual, test.expected)
				}
				return
			}
			if !errors.Is(err, ErrInvalidNickname) {
				t.Fatalf("NormalizeNickname() error = %v, want ErrInvalidNickname", err)
			}
		})
	}
}
