import type { Metadata, Viewport } from "next";
import { GENRES } from "@/features/genre-vote/genres";
import { GenreVotePrototype } from "@/features/genre-vote/genre-vote-prototype";
import { RoomGenreEntry } from "@/features/room/room-genre-entry";
import { isRoomId } from "@/features/room/room-data";
import { notFound } from "next/navigation";
import { isDevelopmentDemo } from "@/features/ui-flow/development-demo";
import { FlowMessage } from "@/features/ui-flow/flow-message";
import { GENRE_ICON_PATH, GENRE_MANIFEST_PATH, GENRE_THEME_COLOR, PROTOTYPE_ROOM_ID } from "@/features/genre-vote/prototype-config";

export const metadata: Metadata = {
  title: "ジャンル投票 | メシマッチ",
  description: `${GENRES.length}ジャンルから今日の食べたい気分を選ぶUIプロトタイプ。`,
  manifest: GENRE_MANIFEST_PATH,
  appleWebApp: { capable: true, title: "メシマッチ", statusBarStyle: "default" },
  icons: { apple: `${GENRE_ICON_PATH}/apple-180.png`, icon: `${GENRE_ICON_PATH}/icon-192.png` },
};
export const viewport: Viewport = { themeColor: GENRE_THEME_COLOR };

type GenreVotePageProps = { searchParams: Promise<{ room?: string | string[]; demo?: string | string[] }> };
export default async function GenreVotePage({ searchParams }: GenreVotePageProps) {
  const query = await searchParams, raw = query.room;
  if (raw !== undefined) return <RoomGenreEntry key={typeof raw === "string" ? raw : "invalid"} roomId={typeof raw === "string" && isRoomId(raw) ? raw.toLowerCase() : undefined} />;
  if (query.demo === "1" && process.env.NODE_ENV !== "development") notFound();
  return isDevelopmentDemo(query.demo, process.env.NODE_ENV) ? <GenreVotePrototype genres={GENRES} roomId={PROTOTYPE_ROOM_ID} />
    : <FlowMessage step="genre" title="ルーム情報を確認してください" description="ジャンル投票の保存・同期はまだ接続されていません。実ルームの操作はホームから開始してください。" />;
}
