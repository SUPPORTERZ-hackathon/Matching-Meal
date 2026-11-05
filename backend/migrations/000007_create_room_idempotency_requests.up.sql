CREATE TABLE room_idempotency_requests (
    operation TEXT NOT NULL,
    key_hash BYTEA NOT NULL,
    request_fingerprint BYTEA NOT NULL,
    state TEXT NOT NULL,
    room_id UUID,
    participant_id UUID,
    response_room_status TEXT,
    response_room_version BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    CONSTRAINT room_idempotency_requests_pk PRIMARY KEY (operation, key_hash),
    CONSTRAINT room_idempotency_requests_operation_valid CHECK (operation IN ('create_room', 'join_room')),
    CONSTRAINT room_idempotency_requests_key_hash_valid CHECK (octet_length(key_hash) = 32),
    CONSTRAINT room_idempotency_requests_fingerprint_valid CHECK (octet_length(request_fingerprint) = 32),
    CONSTRAINT room_idempotency_requests_state_valid CHECK (state IN ('pending', 'completed')),
    CONSTRAINT room_idempotency_requests_status_valid CHECK (
        response_room_status IS NULL OR response_room_status IN (
            'lobby', 'genre_voting', 'restaurant_searching', 'restaurant_voting', 'decided', 'expired'
        )
    ),
    CONSTRAINT room_idempotency_requests_version_valid CHECK (
        response_room_version IS NULL OR response_room_version > 0
    ),
    CONSTRAINT room_idempotency_requests_completion_valid CHECK (
        (state = 'pending' AND room_id IS NULL AND participant_id IS NULL
            AND response_room_status IS NULL AND response_room_version IS NULL AND expires_at IS NULL)
        OR
        (state = 'completed' AND room_id IS NOT NULL AND participant_id IS NOT NULL
            AND response_room_status IS NOT NULL AND response_room_version IS NOT NULL AND expires_at IS NOT NULL)
    ),
    CONSTRAINT room_idempotency_requests_room_fk FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE CASCADE,
    CONSTRAINT room_idempotency_requests_participant_fk FOREIGN KEY (participant_id) REFERENCES participants (id) ON DELETE CASCADE
);
