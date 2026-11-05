package service

import (
	"bytes"
	"context"
	"errors"
	"testing"
	"time"

	"meal/backend/internal/domain"
	"meal/backend/internal/repository"
	"meal/backend/internal/security"
)

type idempotencyRoomRepositoryStub struct {
	*roomRepositoryStub
	claim            repository.RoomIdempotencyClaim
	createReplayRoom domain.Room
	createReplayHost domain.Participant
	joinReplayRoom   domain.Room
	joinReplayMember domain.Participant
	replayed         bool
	idempotencyError error
}

func (stub *idempotencyRoomRepositoryStub) CreateIdempotent(
	ctx context.Context,
	claim repository.RoomIdempotencyClaim,
	params repository.CreateRoomParams,
) (domain.Room, domain.Participant, bool, error) {
	stub.claim = claim
	if stub.idempotencyError != nil {
		return domain.Room{}, domain.Participant{}, false, stub.idempotencyError
	}
	if stub.replayed {
		return stub.createReplayRoom, stub.createReplayHost, true, nil
	}
	room, participant, err := stub.Create(ctx, params)
	return room, participant, false, err
}

func (stub *idempotencyRoomRepositoryStub) WithinIdempotentTransaction(
	_ context.Context,
	claim repository.RoomIdempotencyClaim,
	operation func(repository.RoomTransaction) (domain.Room, domain.Participant, error),
) (domain.Room, domain.Participant, bool, error) {
	stub.claim = claim
	if stub.idempotencyError != nil {
		return domain.Room{}, domain.Participant{}, false, stub.idempotencyError
	}
	if stub.replayed {
		return stub.joinReplayRoom, stub.joinReplayMember, true, nil
	}
	room, participant, err := operation(stub.transaction)
	return room, participant, false, err
}

func TestRoomServiceCreateWithIdempotency(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, time.November, 4, 9, 0, 0, 0, time.UTC)
	base := &roomRepositoryStub{}
	repositoryStub := &idempotencyRoomRepositoryStub{roomRepositoryStub: base}
	generator := &generatorStub{uuids: []string{"room-id", "participant-id"}, codes: []string{"ABCDEFGH"}}
	key := bytes.Repeat([]byte{0x45}, security.MinIdempotencyHMACKeyBytes)
	roomService := NewRoomService(baseRepository(repositoryStub), generator, clockStub{now: now}, WithRoomIdempotencyKey(key))

	result, err := roomService.CreateWithIdempotency(context.Background(), validCreateRoomInput(" ひかる "), "550e8400-e29b-41d4-a716-446655440000")
	if err != nil {
		t.Fatalf("CreateWithIdempotency() error = %v", err)
	}
	if result.IdempotencyReplayed || result.SessionToken == "" || len(base.calls) != 1 {
		t.Fatalf("CreateWithIdempotency() result = %+v, calls = %d", result, len(base.calls))
	}
	if repositoryStub.claim.Operation != repository.RoomIdempotencyCreate || len(repositoryStub.claim.KeyHash) != 32 || len(repositoryStub.claim.RequestFingerprint) != 32 {
		t.Fatalf("claim = %+v", repositoryStub.claim)
	}
	if !bytes.Equal(base.calls[0].SessionTokenHash, security.HashSessionToken(result.SessionToken)) {
		t.Fatal("stored token hash does not match response token")
	}
}

func TestRoomServiceCreateIdempotencyReplayAndConflict(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, time.November, 4, 9, 0, 0, 0, time.UTC)
	key := bytes.Repeat([]byte{0x46}, security.MinIdempotencyHMACKeyBytes)
	idempotencyKey := "550e8400-e29b-41d4-a716-446655440001"
	replayRoom := domain.Room{ID: "stored-room", JoinCode: "ABCDEFGH", Status: domain.RoomStatusLobby, Version: 1, ExpiresAt: now.Add(time.Hour)}
	replayHost := domain.Participant{ID: "stored-host", RoomID: replayRoom.ID, Nickname: "ひかる", Role: domain.ParticipantRoleHost}
	repositoryStub := &idempotencyRoomRepositoryStub{
		roomRepositoryStub: &roomRepositoryStub{}, replayed: true, createReplayRoom: replayRoom, createReplayHost: replayHost,
	}
	roomService := NewRoomService(baseRepository(repositoryStub), &generatorStub{
		uuids: []string{"unused-room-1", "unused-host-1", "unused-room-2", "unused-host-2"},
		codes: []string{"UNUSED12", "UNUSED34"},
	}, clockStub{now: now}, WithRoomIdempotencyKey(key))

	result, err := roomService.CreateWithIdempotency(context.Background(), validCreateRoomInput("ひかる"), idempotencyKey)
	if err != nil {
		t.Fatalf("CreateWithIdempotency() replay error = %v", err)
	}
	expectedToken, _, _ := security.DeriveIdempotentSessionToken(key, string(repository.RoomIdempotencyCreate), idempotencyKey, replayHost.ID)
	if !result.IdempotencyReplayed || result.Room.ID != replayRoom.ID || result.SessionToken != expectedToken {
		t.Fatalf("replay result = %+v", result)
	}

	repositoryStub.replayed = false
	repositoryStub.idempotencyError = repository.ErrIdempotencyConflict
	_, err = roomService.CreateWithIdempotency(context.Background(), validCreateRoomInput("ひかる"), idempotencyKey)
	if !errors.Is(err, ErrIdempotencyConflict) {
		t.Fatalf("CreateWithIdempotency() error = %v, want ErrIdempotencyConflict", err)
	}
}

func TestRoomServiceJoinIdempotencyReplay(t *testing.T) {
	t.Parallel()
	now := time.Date(2026, time.November, 4, 9, 0, 0, 0, time.UTC)
	key := bytes.Repeat([]byte{0x47}, security.MinIdempotencyHMACKeyBytes)
	idempotencyKey := "550e8400-e29b-41d4-a716-446655440002"
	replayRoom := domain.Room{ID: "stored-room", JoinCode: "ABCDEFGH", Status: domain.RoomStatusLobby, Version: 2, ExpiresAt: now.Add(time.Hour)}
	replayMember := domain.Participant{ID: "stored-member", RoomID: replayRoom.ID, Nickname: "同名", Role: domain.ParticipantRoleMember}
	repositoryStub := &idempotencyRoomRepositoryStub{
		roomRepositoryStub: &roomRepositoryStub{}, replayed: true, joinReplayRoom: replayRoom, joinReplayMember: replayMember,
	}
	roomService := NewRoomService(baseRepository(repositoryStub), &generatorStub{}, clockStub{now: now}, WithRoomIdempotencyKey(key))

	result, err := roomService.JoinWithIdempotency(context.Background(), "abcdefgh", " 同名 ", idempotencyKey)
	if err != nil {
		t.Fatalf("JoinWithIdempotency() error = %v", err)
	}
	expectedToken, _, _ := security.DeriveIdempotentSessionToken(key, string(repository.RoomIdempotencyJoin), idempotencyKey, replayMember.ID)
	if !result.IdempotencyReplayed || result.SessionToken != expectedToken || result.Participant.ID != replayMember.ID {
		t.Fatalf("JoinWithIdempotency() result = %+v", result)
	}
}

func TestRoomServiceRejectsUnavailableIdempotency(t *testing.T) {
	t.Parallel()
	roomService := NewRoomService(&roomRepositoryStub{}, &generatorStub{}, clockStub{})
	_, err := roomService.CreateWithIdempotency(context.Background(), validCreateRoomInput("ひかる"), "550e8400-e29b-41d4-a716-446655440003")
	if !errors.Is(err, ErrIdempotencyUnavailable) {
		t.Fatalf("CreateWithIdempotency() error = %v, want ErrIdempotencyUnavailable", err)
	}
}

func baseRepository(stub *idempotencyRoomRepositoryStub) repository.RoomRepository {
	return stub
}
