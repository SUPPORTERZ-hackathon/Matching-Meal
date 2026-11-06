import type { Metadata } from "next";
import { GENRES } from "@/features/genre-vote/genres";
import { GenreVotePrototype } from "@/features/genre-vote/genre-vote-prototype";
import { RoomGenreEntry } from "@/features/room/room-genre-entry";
import { isRoomId } from "@/features/room/room-data";
import { notFound } from "next/navigation";
import { isDevelopmentDemo } from "@/features/ui-flow/development-demo";
import { FlowMessage } from "@/features/ui-flow/flow-message";
import { PROTOTYPE_ROOM_ID } from "@/features/genre-vote/prototype-config";

export const metadata: Metadata = {
  title: "ジャンル投票 | メシマッチ",
  description: `${GENRES.length}ジャンルから今日の食べたい気分を選ぶUIプロトタイプ。`,
};

type GenreVotePageProps = { searchParams: Promise<{ room?: string | string[]; demo?: string | string[] }> };
export default async function GenreVotePage({ searchParams }: GenreVotePageProps) {
  const query = await searchParams, raw = query.room;
  if (raw !== undefined) return <RoomGenreEntry key={typeof raw === "string" ? raw : "invalid"} roomId={typeof raw === "string" && isRoomId(raw) ? raw.toLowerCase() : undefined} />;
  if (query.demo === "1" && process.env.NODE_ENV !== "development") notFound();
  return isDevelopmentDemo(query.demo, process.env.NODE_ENV) ? <GenreVotePrototype genres={GENRES} roomId={PROTOTYPE_ROOM_ID} />
    : <FlowMessage step="genre" title="ルーム情報を確認してください" description="実ルームの投票には参加情報が必要です。ホームからルームを作成するか、招待リンクを開いてください。" />;
}
