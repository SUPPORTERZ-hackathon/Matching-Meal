import type { Metadata, Viewport } from "next";
import { GENRES } from "@/features/genre-vote/genres";
import { GENRE_ICON_PATH, GENRE_THEME_COLOR, PROTOTYPE_ROOM_ID } from "@/features/genre-vote/prototype-config";
import { GenreResultScreen } from "@/features/genre-result/genre-result-screen";
import { MOCK_GENRE_RESULT } from "@/features/genre-result/prototype-data";

export const metadata: Metadata = {
  title: "ジャンル投票結果 | メシマッチ",
  description: "決定した料理ジャンルを発表するUIプロトタイプ。",
  icons: { apple: `${GENRE_ICON_PATH}/apple-180.png`, icon: `${GENRE_ICON_PATH}/icon-192.png` },
};
export const viewport: Viewport = { themeColor: GENRE_THEME_COLOR };

export default function GenreResultPage() {
  // 将来の集計APIとの境界。現在は投票と同期しないサンプル結果を供給する。
  return <GenreResultScreen result={MOCK_GENRE_RESULT} genres={GENRES} roomId={PROTOTYPE_ROOM_ID} isPrototype />;
}
