CREATE TABLE rooms (
    id UUID PRIMARY KEY,
    join_code VARCHAR(8) NOT NULL,
    status TEXT NOT NULL,
    version BIGINT NOT NULL DEFAULT 1,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT rooms_join_code_unique UNIQUE (join_code),
    CONSTRAINT rooms_status_valid CHECK (status IN ('lobby', 'genre_voting', 'restaurant_voting', 'decided', 'expired')),
    CONSTRAINT rooms_version_positive CHECK (version > 0)
);

CREATE TABLE participants (
    id UUID PRIMARY KEY,
    room_id UUID NOT NULL,
    nickname VARCHAR(20) NOT NULL,
    role TEXT NOT NULL,
    session_token_hash BYTEA NOT NULL,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT participants_room_fk FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE CASCADE,
    CONSTRAINT participants_role_valid CHECK (role IN ('host', 'member')),
    CONSTRAINT participants_nickname_not_blank CHECK (length(btrim(nickname)) > 0),
    CONSTRAINT participants_session_token_hash_unique UNIQUE (session_token_hash)
);

CREATE INDEX participants_room_id_idx ON participants (room_id);
CREATE UNIQUE INDEX participants_one_host_per_room_idx ON participants (room_id) WHERE role = 'host';
