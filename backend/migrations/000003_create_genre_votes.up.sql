ALTER TABLE rooms DROP CONSTRAINT rooms_status_valid;
ALTER TABLE rooms ADD CONSTRAINT rooms_status_valid CHECK (
    status IN ('lobby', 'genre_voting', 'restaurant_searching', 'restaurant_voting', 'decided', 'expired')
);

CREATE TABLE genre_vote_submissions (
    participant_id UUID PRIMARY KEY,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT genre_vote_submissions_participant_fk
        FOREIGN KEY (participant_id) REFERENCES participants (id) ON DELETE CASCADE
);

CREATE TABLE genre_votes (
    participant_id UUID NOT NULL,
    genre_id VARCHAR(40) NOT NULL,
    choice TEXT NOT NULL,
    CONSTRAINT genre_votes_pk PRIMARY KEY (participant_id, genre_id),
    CONSTRAINT genre_votes_submission_fk
        FOREIGN KEY (participant_id) REFERENCES genre_vote_submissions (participant_id) ON DELETE CASCADE,
    CONSTRAINT genre_votes_genre_valid CHECK (genre_id IN (
        'ramen', 'sushi-seafood', 'yakiniku', 'steak-hamburg',
        'curry', 'soba-udon', 'teishoku', 'italian',
        'chinese', 'korean', 'asian', 'hamburger',
        'okonomiyaki-takoyaki', 'nabe-shabushabu', 'izakaya', 'cafe'
    )),
    CONSTRAINT genre_votes_choice_valid CHECK (choice IN ('like', 'skip'))
);

CREATE TABLE genre_vote_results (
    room_id UUID PRIMARY KEY,
    genre_id VARCHAR(40) NOT NULL,
    like_count INTEGER NOT NULL,
    decision_method TEXT NOT NULL,
    decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT genre_vote_results_room_fk FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE CASCADE,
    CONSTRAINT genre_vote_results_genre_valid CHECK (genre_id IN (
        'ramen', 'sushi-seafood', 'yakiniku', 'steak-hamburg',
        'curry', 'soba-udon', 'teishoku', 'italian',
        'chinese', 'korean', 'asian', 'hamburger',
        'okonomiyaki-takoyaki', 'nabe-shabushabu', 'izakaya', 'cafe'
    )),
    CONSTRAINT genre_vote_results_like_count_valid CHECK (like_count >= 0),
    CONSTRAINT genre_vote_results_method_valid CHECK (
        decision_method IN ('most_likes', 'random_tie', 'random_all_skipped')
    )
);
