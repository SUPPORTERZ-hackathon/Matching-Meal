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

func TestNormalizeJoinCode(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name      string
		input     string
		expected  string
		expectsOK bool
	}{
		{name: "normalizes lowercase and whitespace", input: " eb9ty3ts ", expected: "EB9TY3TS", expectsOK: true},
		{name: "rejects short code", input: "ABC", expectsOK: false},
		{name: "rejects ambiguous character", input: "ABCDEF0H", expectsOK: false},
		{name: "rejects symbol", input: "ABCDEF-H", expectsOK: false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			actual, err := NormalizeJoinCode(test.input)
			if test.expectsOK {
				if err != nil {
					t.Fatalf("NormalizeJoinCode() error = %v", err)
				}
				if actual != test.expected {
					t.Fatalf("NormalizeJoinCode() = %q, want %q", actual, test.expected)
				}
				return
			}
			if !errors.Is(err, ErrInvalidJoinCode) {
				t.Fatalf("NormalizeJoinCode() error = %v, want ErrInvalidJoinCode", err)
			}
		})
	}
}

func TestNormalizeRoomID(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name      string
		input     string
		expected  string
		expectsOK bool
	}{
		{name: "normalizes uppercase and whitespace", input: " 550E8400-E29B-41D4-A716-446655440000 ", expected: "550e8400-e29b-41d4-a716-446655440000", expectsOK: true},
		{name: "rejects short value", input: "room-id", expectsOK: false},
		{name: "rejects misplaced separators", input: "550e8400e29b-41d4-a716-446655440000", expectsOK: false},
		{name: "rejects non hexadecimal characters", input: "550e8400-e29b-41d4-a716-44665544000z", expectsOK: false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			actual, err := NormalizeRoomID(test.input)
			if test.expectsOK {
				if err != nil {
					t.Fatalf("NormalizeRoomID() error = %v", err)
				}
				if actual != test.expected {
					t.Fatalf("NormalizeRoomID() = %q, want %q", actual, test.expected)
				}
				return
			}
			if !errors.Is(err, ErrInvalidRoomID) {
				t.Fatalf("NormalizeRoomID() error = %v, want ErrInvalidRoomID", err)
			}
		})
	}
}
