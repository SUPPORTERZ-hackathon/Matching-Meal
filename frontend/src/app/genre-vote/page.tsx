import type { Metadata, Viewport } from "next";
import { GENRES } from "@/features/genre-vote/genres";
import { GenreVotePrototype } from "@/features/genre-vote/genre-vote-prototype";
import { RoomGenreEntry } from "@/features/room/room-genre-entry";
import { isRoomId } from "@/features/room/room-data";
import { GENRE_ICON_PATH, GENRE_MANIFEST_PATH, GENRE_THEME_COLOR, PROTOTYPE_ROOM_ID } from "@/features/genre-vote/prototype-config";

export const metadata: Metadata = {
  title: "ジャンル投票 | メシマッチ",
  description: `${GENRES.length}ジャンルから今日の食べたい気分を選ぶUIプロトタイプ。`,
  manifest: GENRE_MANIFEST_PATH,
  appleWebApp: { capable: true, title: "メシマッチ", statusBarStyle: "default" },
  icons: { apple: `${GENRE_ICON_PATH}/apple-180.png`, icon: `${GENRE_ICON_PATH}/icon-192.png` },
};
export const viewport: Viewport = { themeColor: GENRE_THEME_COLOR };

type GenreVotePageProps = { searchParams: Promise<{ room?: string | string[] }> };
export default async function GenreVotePage({ searchParams }: GenreVotePageProps) {
  const raw = (await searchParams).room;
  if (raw !== undefined) return <RoomGenreEntry key={typeof raw === "string" ? raw : "invalid"} roomId={typeof raw === "string" && isRoomId(raw) ? raw.toLowerCase() : undefined} genres={GENRES} />;
  return <GenreVotePrototype genres={GENRES} roomId={PROTOTYPE_ROOM_ID} />;
}
