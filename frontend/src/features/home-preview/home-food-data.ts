import type { Genre } from "../genre-vote/genres";

type HomePhotoPosition = "left" | "center" | "right";
type HomeFeaturedGenre = { readonly position: HomePhotoPosition; readonly genre?: Genre };
const HOME_PHOTO_POSITIONS: readonly { position: HomePhotoPosition; genreId: string }[] = [
  { position: "left", genreId: "cafe" },
  { position: "center", genreId: "ramen" },
  { position: "right", genreId: "sushi-seafood" },
];

export function getHomeFeaturedGenres(genres: readonly Genre[]): readonly HomeFeaturedGenre[] {
  return HOME_PHOTO_POSITIONS.map(({ position, genreId }) => ({ position, genre: genres.find((genre) => genre.id === genreId) }));
}
