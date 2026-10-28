import type { Genre } from "./genres";

export type VoteChoice = "like" | "skip";
export type GenreVote = {
  readonly genreId: string;
  readonly choice: VoteChoice;
};

export function undoGenreVote(votes: readonly GenreVote[]): readonly GenreVote[] {
  return votes.length === 0 ? votes : votes.slice(0, -1);
}

export function recordGenreVote(
  votes: readonly GenreVote[],
  genres: readonly Genre[],
  vote: GenreVote,
): readonly GenreVote[] {
  const expectedGenre = genres[votes.length];
  if (expectedGenre?.id !== vote.genreId || votes.some((item) => item.genreId === vote.genreId)) {
    return votes;
  }
  return [...votes, vote];
}
