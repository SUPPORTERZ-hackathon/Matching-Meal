package domain

import "errors"

const (
	IdempotencyKeyMinLength = 16
	IdempotencyKeyMaxLength = 128
)

var ErrInvalidIdempotencyKey = errors.New("invalid idempotency key")

func ValidateIdempotencyKey(key string) error {
	if len(key) < IdempotencyKeyMinLength || len(key) > IdempotencyKeyMaxLength {
		return ErrInvalidIdempotencyKey
	}
	for _, character := range key {
		if character >= 'a' && character <= 'z' || character >= 'A' && character <= 'Z' ||
			character >= '0' && character <= '9' || character == '-' || character == '_' {
			continue
		}
		return ErrInvalidIdempotencyKey
	}
	return nil
}
