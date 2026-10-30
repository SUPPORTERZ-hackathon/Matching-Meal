import type { Genre } from "../genre-vote/genres";

export function resolveRestaurantGenre(value: string | string[] | undefined, genres: readonly Genre[], defaultId: string): Genre | undefined {
  if (Array.isArray(value)) return;
  return genres.find((genre) => genre.id === (value === undefined ? defaultId : value));
}
