ALTER TABLE participants
    ADD CONSTRAINT participants_room_id_id_unique UNIQUE (room_id, id);

CREATE TABLE restaurant_vote_submissions (
    room_id UUID NOT NULL,
    participant_id UUID NOT NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT restaurant_vote_submissions_pk PRIMARY KEY (room_id, participant_id),
    CONSTRAINT restaurant_vote_submissions_participant_fk
        FOREIGN KEY (room_id, participant_id) REFERENCES participants (room_id, id) ON DELETE CASCADE
);

CREATE TABLE restaurant_votes (
    room_id UUID NOT NULL,
    participant_id UUID NOT NULL,
    restaurant_id VARCHAR(32) NOT NULL,
    choice TEXT NOT NULL,
    CONSTRAINT restaurant_votes_pk PRIMARY KEY (room_id, participant_id, restaurant_id),
    CONSTRAINT restaurant_votes_submission_fk
        FOREIGN KEY (room_id, participant_id)
        REFERENCES restaurant_vote_submissions (room_id, participant_id) ON DELETE CASCADE,
    CONSTRAINT restaurant_votes_candidate_fk
        FOREIGN KEY (room_id, restaurant_id)
        REFERENCES restaurant_candidates (room_id, restaurant_id) ON DELETE CASCADE,
    CONSTRAINT restaurant_votes_choice_valid CHECK (choice IN ('like', 'skip'))
);

CREATE TABLE restaurant_vote_results (
    room_id UUID PRIMARY KEY,
    restaurant_id VARCHAR(32) NOT NULL,
    like_count INTEGER NOT NULL,
    decision_method TEXT NOT NULL,
    decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT restaurant_vote_results_room_fk
        FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE CASCADE,
    CONSTRAINT restaurant_vote_results_candidate_fk
        FOREIGN KEY (room_id, restaurant_id)
        REFERENCES restaurant_candidates (room_id, restaurant_id) ON DELETE CASCADE,
    CONSTRAINT restaurant_vote_results_like_count_valid CHECK (like_count >= 0),
    CONSTRAINT restaurant_vote_results_method_valid CHECK (
        decision_method IN ('most_likes', 'random_tie', 'random_all_skipped')
    )
);
