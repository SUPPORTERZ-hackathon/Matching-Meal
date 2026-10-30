import type { Genre } from "../genre-vote/genres";

export function resolveRestaurantGenre(value: string | string[] | undefined, genres: readonly Genre[]): Genre | undefined {
  if (typeof value !== "string" || !value) return;
  return genres.find((genre) => genre.id === value);
}
