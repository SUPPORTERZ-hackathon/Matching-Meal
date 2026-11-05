package service

import (
	"crypto/sha256"
	"encoding/binary"
	"hash"
	"math"

	"meal/backend/internal/domain"
	"meal/backend/internal/repository"
	"meal/backend/internal/security"
)

func newRoomIdempotencyClaim(
	operation repository.RoomIdempotencyOperation,
	key string,
	fingerprint []byte,
) repository.RoomIdempotencyClaim {
	return repository.RoomIdempotencyClaim{
		Operation: operation, KeyHash: security.HashIdempotencyKey(key), RequestFingerprint: fingerprint,
	}
}

func createRoomFingerprint(nickname string, condition domain.RoomSearchCondition) []byte {
	digest := sha256.New()
	writeFingerprintString(digest, "create-room-v1")
	writeFingerprintString(digest, nickname)
	writeFingerprintUint64(digest, math.Float64bits(condition.Latitude))
	writeFingerprintUint64(digest, math.Float64bits(condition.Longitude))
	writeFingerprintUint64(digest, uint64(condition.Range))
	return digest.Sum(nil)
}

func joinRoomFingerprint(joinCode string, nickname string) []byte {
	digest := sha256.New()
	writeFingerprintString(digest, "join-room-v1")
	writeFingerprintString(digest, joinCode)
	writeFingerprintString(digest, nickname)
	return digest.Sum(nil)
}

func writeFingerprintString(digest hash.Hash, value string) {
	writeFingerprintUint64(digest, uint64(len(value)))
	_, _ = digest.Write([]byte(value))
}

func writeFingerprintUint64(digest hash.Hash, value uint64) {
	var encoded [8]byte
	binary.BigEndian.PutUint64(encoded[:], value)
	_, _ = digest.Write(encoded[:])
}
