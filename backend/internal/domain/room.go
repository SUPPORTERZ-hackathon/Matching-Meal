package domain

import (
	"errors"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"
)

type RoomStatus string

const (
	RoomStatusLobby            RoomStatus = "lobby"
	RoomStatusGenreVoting      RoomStatus = "genre_voting"
	RoomStatusRestaurantVoting RoomStatus = "restaurant_voting"
	RoomStatusDecided          RoomStatus = "decided"
	RoomStatusExpired          RoomStatus = "expired"

	RoomJoinCodeLength   = 8
	RoomJoinCodeAlphabet = "23456789ABCDEFGHJKMNPQRSTVWXYZ"
	MaxRoomParticipants  = 20
	NicknameMaxLength    = 20
	SessionTokenBytes    = 32
	InitialRoomVersion   = 1
	DefaultRoomLifetime  = 24 * time.Hour
)

type ParticipantRole string

const (
	ParticipantRoleHost   ParticipantRole = "host"
	ParticipantRoleMember ParticipantRole = "member"
)

var (
	ErrInvalidJoinCode = errors.New("invalid join code")
	ErrInvalidNickname = errors.New("invalid nickname")
)

type Room struct {
	ID        string
	JoinCode  string
	Status    RoomStatus
	Version   int64
	ExpiresAt time.Time
	CreatedAt time.Time
	UpdatedAt time.Time
}

type Participant struct {
	ID       string
	RoomID   string
	Nickname string
	Role     ParticipantRole
	JoinedAt time.Time
}

func NormalizeNickname(value string) (string, error) {
	nickname := strings.TrimSpace(value)
	length := utf8.RuneCountInString(nickname)
	if length == 0 || length > NicknameMaxLength {
		return "", ErrInvalidNickname
	}
	for _, character := range nickname {
		if unicode.IsControl(character) {
			return "", ErrInvalidNickname
		}
	}
	return nickname, nil
}

func NormalizeJoinCode(value string) (string, error) {
	joinCode := strings.ToUpper(strings.TrimSpace(value))
	if utf8.RuneCountInString(joinCode) != RoomJoinCodeLength {
		return "", ErrInvalidJoinCode
	}
	for _, character := range joinCode {
		if !strings.ContainsRune(RoomJoinCodeAlphabet, character) {
			return "", ErrInvalidJoinCode
		}
	}
	return joinCode, nil
}
