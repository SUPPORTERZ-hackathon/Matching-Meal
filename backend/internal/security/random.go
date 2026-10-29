package security

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"math/big"

	"meal/backend/internal/domain"
)

const (
	uuidByteLength     = 16
	uuidVersionIndex   = 6
	uuidVariantIndex   = 8
	uuidVersionMask    = 0x0f
	uuidVersionFour    = 0x40
	uuidVariantMask    = 0x3f
	uuidVariantRFC4122 = 0x80
)

type Generator interface {
	UUID() (string, error)
	JoinCode() (string, error)
	SessionToken() (string, []byte, error)
}

type RandomGenerator struct{}

func (RandomGenerator) UUID() (string, error) {
	bytes := make([]byte, uuidByteLength)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("generate uuid: %w", err)
	}
	bytes[uuidVersionIndex] = (bytes[uuidVersionIndex] & uuidVersionMask) | uuidVersionFour
	bytes[uuidVariantIndex] = (bytes[uuidVariantIndex] & uuidVariantMask) | uuidVariantRFC4122
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", bytes[0:4], bytes[4:6], bytes[6:8], bytes[8:10], bytes[10:16]), nil
}

func (RandomGenerator) JoinCode() (string, error) {
	code := make([]byte, domain.RoomJoinCodeLength)
	alphabetLength := big.NewInt(int64(len(domain.RoomJoinCodeAlphabet)))
	for index := range code {
		value, err := rand.Int(rand.Reader, alphabetLength)
		if err != nil {
			return "", fmt.Errorf("generate join code: %w", err)
		}
		code[index] = domain.RoomJoinCodeAlphabet[value.Int64()]
	}
	return string(code), nil
}

func (RandomGenerator) SessionToken() (string, []byte, error) {
	bytes := make([]byte, domain.SessionTokenBytes)
	if _, err := rand.Read(bytes); err != nil {
		return "", nil, fmt.Errorf("generate session token: %w", err)
	}
	token := base64.RawURLEncoding.EncodeToString(bytes)
	return token, HashSessionToken(token), nil
}

func HashSessionToken(token string) []byte {
	hash := sha256.Sum256([]byte(token))
	return hash[:]
}
