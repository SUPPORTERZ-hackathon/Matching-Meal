import type { MetadataRoute } from "next";
import { GENRE_BACKGROUND_COLOR, GENRE_ICON_PATH, GENRE_THEME_COLOR, GENRE_VOTE_PATH, PWA_ICON_SIZES } from "@/features/genre-vote/prototype-config";

export function createGenreManifest(): MetadataRoute.Manifest {
  return {
    id: GENRE_VOTE_PATH,
    name: "メシマッチ・ジャンル投票プロトタイプ",
    short_name: "メシマッチ",
    description: "今日の食べたい気分を選ぶジャンル投票プロトタイプ",
    lang: "ja",
    start_url: GENRE_VOTE_PATH,
    scope: GENRE_VOTE_PATH,
    display: "standalone",
    background_color: GENRE_BACKGROUND_COLOR,
    theme_color: GENRE_THEME_COLOR,
    icons: PWA_ICON_SIZES.map((size) => ({ src: `${GENRE_ICON_PATH}/icon-${size}.png`, sizes: `${size}x${size}`, type: "image/png", purpose: "any" })),
  };
}
