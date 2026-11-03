DROP TABLE restaurant_vote_results;
DROP TABLE restaurant_votes;
DROP TABLE restaurant_vote_submissions;

ALTER TABLE participants DROP CONSTRAINT participants_room_id_id_unique;
