package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"meal/backend/internal/domain"
	"meal/backend/internal/repository"
)

type roomRepositoryStub struct {
	errors                   []error
	calls                    []repository.CreateRoomParams
	transaction              *roomTransactionStub
	transactionCalls         int
	authenticatedParticipant domain.Participant
	authenticationError      error
	stateRoom                domain.Room
	stateParticipants        []domain.Participant
	stateError               error
	requestedTokenHash       []byte
	requestedRoomID          string
}

func (stub *roomRepositoryStub) FindParticipantBySessionTokenHash(_ context.Context, sessionTokenHash []byte) (domain.Participant, error) {
	stub.requestedTokenHash = sessionTokenHash
	return stub.authenticatedParticipant, stub.authenticationError
}

func (stub *roomRepositoryStub) FindStateByID(_ context.Context, roomID string) (domain.Room, []domain.Participant, error) {
	stub.requestedRoomID = roomID
	return stub.stateRoom, stub.stateParticipants, stub.stateError
}

func (stub *roomRepositoryStub) Create(_ context.Context, params repository.CreateRoomParams) (domain.Room, domain.Participant, error) {
	stub.calls = append(stub.calls, params)
	callIndex := len(stub.calls) - 1
	if callIndex < len(stub.errors) && stub.errors[callIndex] != nil {
		return domain.Room{}, domain.Participant{}, stub.errors[callIndex]
	}
	params.Room.CreatedAt = time.Date(2026, time.October, 29, 10, 0, 0, 0, time.UTC)
	params.Room.UpdatedAt = params.Room.CreatedAt
	params.Host.JoinedAt = params.Room.CreatedAt
	return params.Room, params.Host, nil
}

func (stub *roomRepositoryStub) WithinTransaction(_ context.Context, operation func(repository.RoomTransaction) error) error {
	stub.transactionCalls++
	return operation(stub.transaction)
}

type roomTransactionStub struct {
	room                domain.Room
	findError           error
	participantCount    int
	countError          error
	participants        []domain.Participant
	listError           error
	insertError         error
	incrementError      error
	updateStatusError   error
	updateStatusCalls   int
	requestedJoinCode   string
	requestedRoomID     string
	insertedParticipant domain.Participant
	insertedTokenHash   []byte
}

func (stub *roomTransactionStub) FindByJoinCodeForUpdate(_ context.Context, joinCode string) (domain.Room, error) {
	stub.requestedJoinCode = joinCode
	return stub.room, stub.findError
}

func (stub *roomTransactionStub) FindByIDForUpdate(_ context.Context, roomID string) (domain.Room, error) {
	stub.requestedRoomID = roomID
	return stub.room, stub.findError
}

func (stub *roomTransactionStub) CountParticipants(_ context.Context, _ string) (int, error) {
	return stub.participantCount, stub.countError
}

func (stub *roomTransactionStub) ListParticipants(_ context.Context, _ string) ([]domain.Participant, error) {
	return stub.participants, stub.listError
}

func (stub *roomTransactionStub) InsertParticipant(_ context.Context, participant domain.Participant, sessionTokenHash []byte) (domain.Participant, error) {
	stub.insertedParticipant = participant
	stub.insertedTokenHash = sessionTokenHash
	if stub.insertError != nil {
		return domain.Participant{}, stub.insertError
	}
	participant.JoinedAt = time.Date(2026, time.October, 29, 10, 0, 0, 0, time.UTC)
	return participant, nil
}

func (stub *roomTransactionStub) IncrementRoomVersion(_ context.Context, _ string) (domain.Room, error) {
	if stub.incrementError != nil {
		return domain.Room{}, stub.incrementError
	}
	room := stub.room
	room.Version++
	return room, nil
}

func (stub *roomTransactionStub) UpdateRoomStatus(_ context.Context, _ string, status domain.RoomStatus) (domain.Room, error) {
	stub.updateStatusCalls++
	if stub.updateStatusError != nil {
		return domain.Room{}, stub.updateStatusError
	}
	room := stub.room
	room.Status = status
	room.Version++
	return room, nil
}

type generatorStub struct {
	uuids     []string
	uuidIndex int
	codes     []string
	codeIndex int
	token     string
	hash      []byte
}

func (stub *generatorStub) UUID() (string, error) {
	value := stub.uuids[stub.uuidIndex]
	stub.uuidIndex++
	return value, nil
}

func (stub *generatorStub) JoinCode() (string, error) {
	value := stub.codes[stub.codeIndex]
	stub.codeIndex++
	return value, nil
}

func (stub *generatorStub) SessionToken() (string, []byte, error) {
	return stub.token, stub.hash, nil
}

type clockStub struct {
	now time.Time
}

func (stub clockStub) Now() time.Time {
	return stub.now
}

func TestRoomServiceCreate(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, time.October, 29, 9, 0, 0, 0, time.UTC)
	repositoryStub := &roomRepositoryStub{}
	generator := &generatorStub{
		uuids: []string{"room-id", "participant-id"}, codes: []string{"ABCDEFGH"},
		token: "plain-token", hash: []byte("token-hash"),
	}
	roomService := NewRoomService(repositoryStub, generator, clockStub{now: now})

	result, err := roomService.Create(context.Background(), " ひかる ")
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if result.Room.ID != "room-id" || result.Room.JoinCode != "ABCDEFGH" || result.Room.Status != domain.RoomStatusLobby {
		t.Fatalf("Create() room = %+v", result.Room)
	}
	if result.Room.ExpiresAt != now.Add(domain.DefaultRoomLifetime) {
		t.Fatalf("Create() expiresAt = %v", result.Room.ExpiresAt)
	}
	if result.Participant.ID != "participant-id" || result.Participant.Nickname != "ひかる" || result.Participant.Role != domain.ParticipantRoleHost {
		t.Fatalf("Create() participant = %+v", result.Participant)
	}
	if result.SessionToken != "plain-token" {
		t.Fatalf("Create() token = %q", result.SessionToken)
	}
	if len(repositoryStub.calls) != 1 || string(repositoryStub.calls[0].SessionTokenHash) != "token-hash" {
		t.Fatalf("repository calls = %+v", repositoryStub.calls)
	}
}

func TestRoomServiceCreateRetriesJoinCodeConflict(t *testing.T) {
	t.Parallel()
	repositoryStub := &roomRepositoryStub{errors: []error{repository.ErrJoinCodeConflict, nil}}
	generator := &generatorStub{
		uuids: []string{"room-id", "participant-id"}, codes: []string{"CONFLICT", "AVAILABLE"},
		token: "plain-token", hash: []byte("token-hash"),
	}
	roomService := NewRoomService(repositoryStub, generator, clockStub{now: time.Now()})

	result, err := roomService.Create(context.Background(), "同名OK")
	if err != nil {
		t.Fatalf("Create() error = %v", err)
	}
	if result.Room.JoinCode != "AVAILABLE" || len(repositoryStub.calls) != 2 {
		t.Fatalf("Create() joinCode = %q, calls = %d", result.Room.JoinCode, len(repositoryStub.calls))
	}
}

func TestRoomServiceCreateRejectsInvalidNicknameBeforePersistence(t *testing.T) {
	t.Parallel()
	repositoryStub := &roomRepositoryStub{}
	roomService := NewRoomService(repositoryStub, &generatorStub{}, clockStub{})

	_, err := roomService.Create(context.Background(), " ")
	if !errors.Is(err, domain.ErrInvalidNickname) {
		t.Fatalf("Create() error = %v, want ErrInvalidNickname", err)
	}
	if len(repositoryStub.calls) != 0 {
		t.Fatalf("repository calls = %d, want 0", len(repositoryStub.calls))
	}
}

func TestRoomServiceJoin(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, time.October, 29, 9, 0, 0, 0, time.UTC)
	transaction := &roomTransactionStub{
		room: domain.Room{
			ID: "room-id", JoinCode: "EB9TY3TS", Status: domain.RoomStatusLobby,
			Version: 1, ExpiresAt: now.Add(time.Hour),
		},
		participantCount: 1,
	}
	repositoryStub := &roomRepositoryStub{transaction: transaction}
	generator := &generatorStub{
		uuids: []string{"participant-id"}, token: "plain-token", hash: []byte("token-hash"),
	}
	roomService := NewRoomService(repositoryStub, generator, clockStub{now: now})

	result, err := roomService.Join(context.Background(), " eb9ty3ts ", " ひかる ")
	if err != nil {
		t.Fatalf("Join() error = %v", err)
	}
	if transaction.requestedJoinCode != "EB9TY3TS" {
		t.Fatalf("requested join code = %q", transaction.requestedJoinCode)
	}
	if result.Room.Version != 2 || result.Participant.Role != domain.ParticipantRoleMember {
		t.Fatalf("Join() result = %+v", result)
	}
	if result.Participant.Nickname != "ひかる" || result.SessionToken != "plain-token" {
		t.Fatalf("Join() result = %+v", result)
	}
	if transaction.insertedParticipant.ID != "participant-id" || string(transaction.insertedTokenHash) != "token-hash" {
		t.Fatalf("inserted participant = %+v, hash = %q", transaction.insertedParticipant, transaction.insertedTokenHash)
	}
}

func TestRoomServiceJoinRejectsUnavailableRoom(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, time.October, 29, 9, 0, 0, 0, time.UTC)
	tests := []struct {
		name          string
		room          domain.Room
		findError     error
		count         int
		expectedError error
	}{
		{name: "not found", findError: repository.ErrRoomNotFound, expectedError: ErrRoomNotFound},
		{name: "expired", room: domain.Room{Status: domain.RoomStatusLobby, ExpiresAt: now}, expectedError: ErrRoomNotFound},
		{name: "voting started", room: domain.Room{Status: domain.RoomStatusGenreVoting, ExpiresAt: now.Add(time.Hour)}, expectedError: ErrRoomNotJoinable},
		{name: "capacity reached", room: domain.Room{Status: domain.RoomStatusLobby, ExpiresAt: now.Add(time.Hour)}, count: domain.MaxRoomParticipants, expectedError: ErrRoomCapacityReached},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			transaction := &roomTransactionStub{room: test.room, findError: test.findError, participantCount: test.count}
			repositoryStub := &roomRepositoryStub{transaction: transaction}
			roomService := NewRoomService(repositoryStub, &generatorStub{}, clockStub{now: now})

			_, err := roomService.Join(context.Background(), "EB9TY3TS", "同名OK")
			if !errors.Is(err, test.expectedError) {
				t.Fatalf("Join() error = %v, want %v", err, test.expectedError)
			}
			if transaction.insertedParticipant.ID != "" {
				t.Fatalf("participant inserted on rejected join: %+v", transaction.insertedParticipant)
			}
		})
	}
}

func TestRoomServiceJoinRejectsInvalidInputBeforeTransaction(t *testing.T) {
	t.Parallel()
	repositoryStub := &roomRepositoryStub{}
	roomService := NewRoomService(repositoryStub, &generatorStub{}, clockStub{})

	_, err := roomService.Join(context.Background(), "invalid", "ひかる")
	if !errors.Is(err, domain.ErrInvalidJoinCode) {
		t.Fatalf("Join() error = %v, want ErrInvalidJoinCode", err)
	}
	if repositoryStub.transactionCalls != 0 {
		t.Fatalf("transaction calls = %d, want 0", repositoryStub.transactionCalls)
	}
}

func TestRoomServiceGetState(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, time.October, 29, 9, 0, 0, 0, time.UTC)
	roomID := "550e8400-e29b-41d4-a716-446655440000"
	participants := []domain.Participant{
		{ID: "host-id", RoomID: roomID, Nickname: "同名", Role: domain.ParticipantRoleHost},
		{ID: "member-id", RoomID: roomID, Nickname: "同名", Role: domain.ParticipantRoleMember},
	}
	repositoryStub := &roomRepositoryStub{
		authenticatedParticipant: participants[1],
		stateRoom:                domain.Room{ID: roomID, JoinCode: "EB9TY3TS", Status: domain.RoomStatusLobby, Version: 2, ExpiresAt: now.Add(time.Hour)},
		stateParticipants:        participants,
	}
	roomService := NewRoomService(repositoryStub, &generatorStub{}, clockStub{now: now})

	result, err := roomService.GetState(context.Background(), " 550E8400-E29B-41D4-A716-446655440000 ", "plain-token")
	if err != nil {
		t.Fatalf("GetState() error = %v", err)
	}
	if repositoryStub.requestedRoomID != roomID {
		t.Fatalf("requested room id = %q", repositoryStub.requestedRoomID)
	}
	if len(repositoryStub.requestedTokenHash) != 32 {
		t.Fatalf("token hash length = %d, want 32", len(repositoryStub.requestedTokenHash))
	}
	if result.CurrentParticipantID != "member-id" || len(result.Participants) != 2 {
		t.Fatalf("GetState() result = %+v", result)
	}
}

func TestRoomServiceGetStateRejectsUnauthorizedAndForbidden(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, time.October, 29, 9, 0, 0, 0, time.UTC)
	roomID := "550e8400-e29b-41d4-a716-446655440000"
	otherRoomID := "6ba7b810-9dad-41d1-80b4-00c04fd430c8"
	tests := []struct {
		name          string
		token         string
		participant   domain.Participant
		authError     error
		expectedError error
	}{
		{name: "empty token", expectedError: ErrUnauthorized},
		{name: "unknown token", token: "unknown", authError: repository.ErrParticipantNotFound, expectedError: ErrUnauthorized},
		{name: "participant from another room", token: "valid", participant: domain.Participant{RoomID: otherRoomID}, expectedError: ErrForbidden},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			repositoryStub := &roomRepositoryStub{authenticatedParticipant: test.participant, authenticationError: test.authError}
			roomService := NewRoomService(repositoryStub, &generatorStub{}, clockStub{now: now})
			_, err := roomService.GetState(context.Background(), roomID, test.token)
			if !errors.Is(err, test.expectedError) {
				t.Fatalf("GetState() error = %v, want %v", err, test.expectedError)
			}
		})
	}
}

func TestRoomServiceGetStateRejectsMissingOrExpiredRoom(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, time.October, 29, 9, 0, 0, 0, time.UTC)
	roomID := "550e8400-e29b-41d4-a716-446655440000"
	tests := []struct {
		name       string
		room       domain.Room
		stateError error
	}{
		{name: "missing", stateError: repository.ErrRoomNotFound},
		{name: "expired", room: domain.Room{ID: roomID, ExpiresAt: now}},
		{name: "marked expired", room: domain.Room{ID: roomID, Status: domain.RoomStatusExpired, ExpiresAt: now.Add(time.Hour)}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			repositoryStub := &roomRepositoryStub{
				authenticatedParticipant: domain.Participant{ID: "participant-id", RoomID: roomID},
				stateRoom:                test.room, stateParticipants: []domain.Participant{{ID: "participant-id"}}, stateError: test.stateError,
			}
			roomService := NewRoomService(repositoryStub, &generatorStub{}, clockStub{now: now})
			_, err := roomService.GetState(context.Background(), roomID, "valid-token")
			if !errors.Is(err, ErrRoomNotFound) {
				t.Fatalf("GetState() error = %v, want ErrRoomNotFound", err)
			}
		})
	}
}

func TestRoomServiceStartGenreVoting(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, time.October, 29, 9, 0, 0, 0, time.UTC)
	roomID := "550e8400-e29b-41d4-a716-446655440000"
	participants := []domain.Participant{
		{ID: "host-id", RoomID: roomID, Role: domain.ParticipantRoleHost},
		{ID: "member-id", RoomID: roomID, Role: domain.ParticipantRoleMember},
	}
	transaction := &roomTransactionStub{
		room:             domain.Room{ID: roomID, Status: domain.RoomStatusLobby, Version: 2, ExpiresAt: now.Add(time.Hour)},
		participantCount: 2,
		participants:     participants,
	}
	repositoryStub := &roomRepositoryStub{
		transaction:              transaction,
		authenticatedParticipant: participants[0],
	}
	roomService := NewRoomService(repositoryStub, &generatorStub{}, clockStub{now: now})

	result, err := roomService.StartGenreVoting(context.Background(), roomID, "host-token")
	if err != nil {
		t.Fatalf("StartGenreVoting() error = %v", err)
	}
	if result.Room.Status != domain.RoomStatusGenreVoting || result.Room.Version != 3 {
		t.Fatalf("StartGenreVoting() room = %+v", result.Room)
	}
	if result.CurrentParticipantID != "host-id" || len(result.Participants) != 2 {
		t.Fatalf("StartGenreVoting() result = %+v", result)
	}
	if transaction.requestedRoomID != roomID || transaction.updateStatusCalls != 1 {
		t.Fatalf("transaction room = %q, updates = %d", transaction.requestedRoomID, transaction.updateStatusCalls)
	}
}

func TestRoomServiceStartGenreVotingIsIdempotent(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, time.October, 29, 9, 0, 0, 0, time.UTC)
	roomID := "550e8400-e29b-41d4-a716-446655440000"
	host := domain.Participant{ID: "host-id", RoomID: roomID, Role: domain.ParticipantRoleHost}
	transaction := &roomTransactionStub{
		room:         domain.Room{ID: roomID, Status: domain.RoomStatusGenreVoting, Version: 3, ExpiresAt: now.Add(time.Hour)},
		participants: []domain.Participant{host, {ID: "member-id", RoomID: roomID, Role: domain.ParticipantRoleMember}},
	}
	repositoryStub := &roomRepositoryStub{transaction: transaction, authenticatedParticipant: host}
	roomService := NewRoomService(repositoryStub, &generatorStub{}, clockStub{now: now})

	result, err := roomService.StartGenreVoting(context.Background(), roomID, "host-token")
	if err != nil {
		t.Fatalf("StartGenreVoting() error = %v", err)
	}
	if result.Room.Version != 3 || transaction.updateStatusCalls != 0 {
		t.Fatalf("idempotent result = %+v, updates = %d", result, transaction.updateStatusCalls)
	}
}

func TestRoomServiceStartGenreVotingRejectsInvalidConditions(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, time.October, 29, 9, 0, 0, 0, time.UTC)
	roomID := "550e8400-e29b-41d4-a716-446655440000"
	tests := []struct {
		name             string
		participantRole  domain.ParticipantRole
		participantCount int
		room             domain.Room
		expectedError    error
	}{
		{name: "member", participantRole: domain.ParticipantRoleMember, room: domain.Room{ID: roomID, Status: domain.RoomStatusLobby, ExpiresAt: now.Add(time.Hour)}, expectedError: ErrHostRequired},
		{name: "not enough participants", participantRole: domain.ParticipantRoleHost, participantCount: 1, room: domain.Room{ID: roomID, Status: domain.RoomStatusLobby, ExpiresAt: now.Add(time.Hour)}, expectedError: ErrNotEnoughParticipants},
		{name: "invalid transition", participantRole: domain.ParticipantRoleHost, participantCount: 2, room: domain.Room{ID: roomID, Status: domain.RoomStatusRestaurantVoting, ExpiresAt: now.Add(time.Hour)}, expectedError: ErrInvalidRoomTransition},
		{name: "expired", participantRole: domain.ParticipantRoleHost, participantCount: 2, room: domain.Room{ID: roomID, Status: domain.RoomStatusLobby, ExpiresAt: now}, expectedError: ErrRoomNotFound},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			transaction := &roomTransactionStub{room: test.room, participantCount: test.participantCount}
			repositoryStub := &roomRepositoryStub{
				transaction:              transaction,
				authenticatedParticipant: domain.Participant{ID: "participant-id", RoomID: roomID, Role: test.participantRole},
			}
			roomService := NewRoomService(repositoryStub, &generatorStub{}, clockStub{now: now})
			_, err := roomService.StartGenreVoting(context.Background(), roomID, "token")
			if !errors.Is(err, test.expectedError) {
				t.Fatalf("StartGenreVoting() error = %v, want %v", err, test.expectedError)
			}
			if transaction.updateStatusCalls != 0 {
				t.Fatalf("status updates = %d, want 0", transaction.updateStatusCalls)
			}
		})
	}
}
