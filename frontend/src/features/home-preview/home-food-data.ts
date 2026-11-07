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

const HOME_CAROUSEL_IDS = ["cafe", "ramen", "sushi-seafood", "yakiniku", "italian"] as const;

export function getHomeCarouselGenres(genres: readonly Genre[]): readonly (Genre | undefined)[] {
  return HOME_CAROUSEL_IDS.map((id) => genres.find((genre) => genre.id === id));
}

export function getCarouselSlot(index: number, activeIndex: number, count: number): number {
  const offset = (index - activeIndex + count) % count;
  return offset > Math.floor(count / 2) ? offset - count : offset;
}

const SWIPE_DISTANCE_PX = 40;
const HORIZONTAL_INTENT_RATIO = 1.25;

export function getCarouselSwipeStep(dx: number, dy: number): -1 | 0 | 1 {
  if (Math.abs(dx) < SWIPE_DISTANCE_PX || Math.abs(dx) <= Math.abs(dy) * HORIZONTAL_INTENT_RATIO) return 0;
  return dx < 0 ? 1 : -1;
}
