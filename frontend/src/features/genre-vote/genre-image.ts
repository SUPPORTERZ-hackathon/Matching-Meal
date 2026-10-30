import type { Genre } from "./genres";

const LOCAL_GENRE_IMAGE_PREFIXES = ["/images/genres/", "/genres/"] as const;

export function getGenreImagePath(genre?: Genre): string | undefined {
  const path = genre?.imagePath;
  if (!path || path.includes("\\") || path.split("/").includes("..")) return;
  return LOCAL_GENRE_IMAGE_PREFIXES.some((prefix) => path.startsWith(prefix)) ? path : undefined;
}
