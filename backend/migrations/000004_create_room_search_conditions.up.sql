CREATE TABLE room_search_conditions (
    room_id UUID PRIMARY KEY,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    search_range SMALLINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT room_search_conditions_room_fk FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE CASCADE,
    CONSTRAINT room_search_conditions_latitude_valid CHECK (latitude BETWEEN -90 AND 90),
    CONSTRAINT room_search_conditions_longitude_valid CHECK (longitude BETWEEN -180 AND 180),
    CONSTRAINT room_search_conditions_range_valid CHECK (search_range BETWEEN 1 AND 5)
);
