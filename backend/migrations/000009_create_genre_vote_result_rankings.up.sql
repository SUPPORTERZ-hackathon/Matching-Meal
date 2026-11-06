CREATE TABLE genre_vote_result_rankings (
    room_id UUID NOT NULL,
    rank SMALLINT NOT NULL,
    genre_id VARCHAR(40) NOT NULL,
    like_count INTEGER NOT NULL,
    tie_break_applied BOOLEAN NOT NULL,
    CONSTRAINT genre_vote_result_rankings_pk PRIMARY KEY (room_id, rank),
    CONSTRAINT genre_vote_result_rankings_genre_unique UNIQUE (room_id, genre_id),
    CONSTRAINT genre_vote_result_rankings_result_fk
        FOREIGN KEY (room_id) REFERENCES genre_vote_results (room_id) ON DELETE CASCADE,
    CONSTRAINT genre_vote_result_rankings_rank_valid CHECK (rank BETWEEN 1 AND 3),
    CONSTRAINT genre_vote_result_rankings_genre_valid CHECK (genre_id IN (
        'ramen', 'sushi-seafood', 'yakiniku', 'steak-hamburg',
        'curry', 'soba-udon', 'teishoku', 'italian',
        'chinese', 'korean', 'asian', 'hamburger',
        'okonomiyaki-takoyaki', 'nabe-shabushabu', 'izakaya', 'cafe'
    )),
    CONSTRAINT genre_vote_result_rankings_like_count_valid CHECK (like_count >= 0)
);
