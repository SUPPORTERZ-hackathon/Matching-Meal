import { GenreVotingEntry } from "../genre-voting-api/genre-voting-entry";

export function RoomGenreEntry({ roomId }: { roomId?: string }) {
  return <GenreVotingEntry roomId={roomId} screen="vote" />;
}
