package security

import (
	"bytes"
	"encoding/base64"
	"testing"
)

func TestDecodeIdempotencyHMACKey(t *testing.T) {
	t.Parallel()
	valid := bytes.Repeat([]byte{0x42}, MinIdempotencyHMACKeyBytes)
	decoded, ok := DecodeIdempotencyHMACKey(base64.StdEncoding.EncodeToString(valid))
	if !ok || !bytes.Equal(decoded, valid) {
		t.Fatalf("DecodeIdempotencyHMACKey() = %x, %v", decoded, ok)
	}
	for _, encoded := range []string{"", "invalid", base64.StdEncoding.EncodeToString(valid[:MinIdempotencyHMACKeyBytes-1])} {
		if _, ok := DecodeIdempotencyHMACKey(encoded); ok {
			t.Fatalf("DecodeIdempotencyHMACKey(%q) accepted invalid key", encoded)
		}
	}
}

func TestDeriveIdempotentSessionToken(t *testing.T) {
	t.Parallel()
	key := bytes.Repeat([]byte{0x24}, MinIdempotencyHMACKeyBytes)
	token, tokenHash, ok := DeriveIdempotentSessionToken(key, "join_room", "550e8400-e29b-41d4-a716-446655440000", "participant-id")
	if !ok || token == "" || len(tokenHash) != 32 {
		t.Fatalf("DeriveIdempotentSessionToken() = %q, %x, %v", token, tokenHash, ok)
	}
	repeated, repeatedHash, ok := DeriveIdempotentSessionToken(key, "join_room", "550e8400-e29b-41d4-a716-446655440000", "participant-id")
	if !ok || repeated != token || !bytes.Equal(repeatedHash, tokenHash) {
		t.Fatal("same inputs did not produce the same token")
	}
	different, _, _ := DeriveIdempotentSessionToken(key, "join_room", "550e8400-e29b-41d4-a716-446655440000", "other-participant")
	if different == token {
		t.Fatal("different participant produced the same token")
	}
	if _, _, ok := DeriveIdempotentSessionToken(key[:MinIdempotencyHMACKeyBytes-1], "join_room", "key", "participant"); ok {
		t.Fatal("short HMAC key was accepted")
	}
}
