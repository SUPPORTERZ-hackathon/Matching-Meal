package domain

import (
	"errors"
	"strings"
	"testing"
)

func TestValidateIdempotencyKey(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name  string
		key   string
		valid bool
	}{
		{name: "uuid", key: "550e8400-e29b-41d4-a716-446655440000", valid: true},
		{name: "minimum", key: strings.Repeat("a", IdempotencyKeyMinLength), valid: true},
		{name: "maximum", key: strings.Repeat("Z", IdempotencyKeyMaxLength), valid: true},
		{name: "too short", key: strings.Repeat("a", IdempotencyKeyMinLength-1)},
		{name: "too long", key: strings.Repeat("a", IdempotencyKeyMaxLength+1)},
		{name: "space", key: "550e8400 e29b-41d4-a716"},
		{name: "unicode", key: "550e8400-e29b-操作キー"},
		{name: "comma", key: "550e8400-e29b,key"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			err := ValidateIdempotencyKey(test.key)
			if test.valid && err != nil {
				t.Fatalf("ValidateIdempotencyKey() error = %v", err)
			}
			if !test.valid && !errors.Is(err, ErrInvalidIdempotencyKey) {
				t.Fatalf("ValidateIdempotencyKey() error = %v, want ErrInvalidIdempotencyKey", err)
			}
		})
	}
}
