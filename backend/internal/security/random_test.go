package security

import (
	"crypto/sha256"
	"encoding/base64"
	"regexp"
	"testing"

	"meal/backend/internal/domain"
)

func TestRandomGeneratorUUID(t *testing.T) {
	t.Parallel()
	generator := RandomGenerator{}
	value, err := generator.UUID()
	if err != nil {
		t.Fatalf("UUID() error = %v", err)
	}
	pattern := regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)
	if !pattern.MatchString(value) {
		t.Fatalf("UUID() = %q, want RFC 4122 version 4 format", value)
	}
}

func TestRandomGeneratorJoinCode(t *testing.T) {
	t.Parallel()
	generator := RandomGenerator{}
	value, err := generator.JoinCode()
	if err != nil {
		t.Fatalf("JoinCode() error = %v", err)
	}
	pattern := regexp.MustCompile(`^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{8}$`)
	if len(value) != domain.RoomJoinCodeLength || !pattern.MatchString(value) {
		t.Fatalf("JoinCode() = %q, want an unambiguous 8-character code", value)
	}
}

func TestRandomGeneratorSessionToken(t *testing.T) {
	t.Parallel()
	generator := RandomGenerator{}
	token, hash, err := generator.SessionToken()
	if err != nil {
		t.Fatalf("SessionToken() error = %v", err)
	}
	decoded, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		t.Fatalf("decode SessionToken() = %v", err)
	}
	if len(decoded) != domain.SessionTokenBytes {
		t.Fatalf("decoded token length = %d, want %d", len(decoded), domain.SessionTokenBytes)
	}
	expectedHash := sha256.Sum256([]byte(token))
	if string(hash) != string(expectedHash[:]) {
		t.Fatal("SessionToken() hash does not match token SHA-256")
	}
	if token == base64.RawURLEncoding.EncodeToString(hash) {
		t.Fatal("SessionToken() returned the hash as the plain token")
	}
}

func TestHashSessionToken(t *testing.T) {
	t.Parallel()
	expected := sha256.Sum256([]byte("plain-token"))
	if actual := HashSessionToken("plain-token"); string(actual) != string(expected[:]) {
		t.Fatal("HashSessionToken() does not match SHA-256")
	}
}
