DROP TABLE genre_vote_results;
DROP TABLE genre_votes;
DROP TABLE genre_vote_submissions;

UPDATE rooms SET status = 'genre_voting' WHERE status = 'restaurant_searching';
ALTER TABLE rooms DROP CONSTRAINT rooms_status_valid;
ALTER TABLE rooms ADD CONSTRAINT rooms_status_valid CHECK (
    status IN ('lobby', 'genre_voting', 'restaurant_voting', 'decided', 'expired')
);
