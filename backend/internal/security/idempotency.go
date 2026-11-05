package security

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
)

const MinIdempotencyHMACKeyBytes = 32

func DecodeIdempotencyHMACKey(encoded string) ([]byte, bool) {
	if encoded == "" {
		return nil, false
	}
	key, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil || len(key) < MinIdempotencyHMACKeyBytes {
		return nil, false
	}
	return key, true
}

func HashIdempotencyKey(key string) []byte {
	hash := sha256.Sum256([]byte(key))
	return hash[:]
}

func DeriveIdempotentSessionToken(key []byte, operation string, idempotencyKey string, participantID string) (string, []byte, bool) {
	if len(key) < MinIdempotencyHMACKeyBytes {
		return "", nil, false
	}
	mac := hmac.New(sha256.New, key)
	writeHMACField(mac, "room-session-v1")
	writeHMACField(mac, operation)
	writeHMACField(mac, idempotencyKey)
	writeHMACField(mac, participantID)
	token := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return token, HashSessionToken(token), true
}

type hashWriter interface {
	Write([]byte) (int, error)
}

func writeHMACField(writer hashWriter, value string) {
	var length [4]byte
	binary.BigEndian.PutUint32(length[:], uint32(len(value)))
	_, _ = writer.Write(length[:])
	_, _ = writer.Write([]byte(value))
}
