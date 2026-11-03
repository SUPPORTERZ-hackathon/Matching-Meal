package domain

import (
	"errors"
	"math"
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

func TestNewRoomSearchCondition(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name        string
		latitude    float64
		longitude   float64
		searchRange int
		expectsOK   bool
	}{
		{name: "accepts minimum values", latitude: -90, longitude: -180, searchRange: 1, expectsOK: true},
		{name: "accepts maximum values", latitude: 90, longitude: 180, searchRange: 5, expectsOK: true},
		{name: "rejects latitude below range", latitude: -90.1, longitude: 0, searchRange: 3},
		{name: "rejects longitude above range", latitude: 0, longitude: 180.1, searchRange: 3},
		{name: "rejects range zero", latitude: 0, longitude: 0, searchRange: 0},
		{name: "rejects range six", latitude: 0, longitude: 0, searchRange: 6},
		{name: "rejects NaN", latitude: math.NaN(), longitude: 0, searchRange: 3},
		{name: "rejects infinity", latitude: 0, longitude: math.Inf(1), searchRange: 3},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			condition, err := NewRoomSearchCondition("room-id", test.latitude, test.longitude, test.searchRange)
			if test.expectsOK {
				if err != nil {
					t.Fatalf("NewRoomSearchCondition() error = %v", err)
				}
				if condition.RoomID != "room-id" || condition.Range != int16(test.searchRange) {
					t.Fatalf("condition = %+v", condition)
				}
				return
			}
			if !errors.Is(err, ErrInvalidSearchCondition) {
				t.Fatalf("NewRoomSearchCondition() error = %v, want ErrInvalidSearchCondition", err)
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
