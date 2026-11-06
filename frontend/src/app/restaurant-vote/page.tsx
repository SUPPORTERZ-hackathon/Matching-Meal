import type { Metadata } from "next";
import { GENRES } from "@/features/genre-vote/genres";
import { PROTOTYPE_ROOM_ID } from "@/features/genre-vote/prototype-config";
import { RestaurantVotePrototype } from "@/features/restaurant-vote/restaurant-vote-prototype";
import { createMockRestaurants } from "@/features/restaurant-vote/prototype-data";
import { resolveRestaurantGenre } from "@/features/restaurant-vote/route-data";
import { notFound } from "next/navigation";
import { isDevelopmentDemo, type QueryValue } from "@/features/ui-flow/development-demo";
import { FlowMessage } from "@/features/ui-flow/flow-message";
import { RestaurantVotingEntry } from "@/features/restaurant-voting-api/restaurant-voting-entry";
import { isRoomId } from "@/features/room/room-data";

export const metadata: Metadata = { title: "店舗投票 | メシマッチ", description: "候補店舗を確認して投票します。", robots: { index: false, follow: false } };
type RestaurantVotePageProps = { searchParams: Promise<{ genre?: QueryValue; demo?: QueryValue; room?: QueryValue }> };

export default async function RestaurantVotePage({ searchParams }: RestaurantVotePageProps) {
  const query = await searchParams;
  if (query.room !== undefined) return <RestaurantVotingEntry key={typeof query.room === "string" ? query.room : "invalid"}
    roomId={typeof query.room === "string" && isRoomId(query.room) ? query.room.toLowerCase() : undefined} screen="vote" />;
  if (query.room === undefined && query.demo === "1" && process.env.NODE_ENV !== "development") notFound();
  if (!isDevelopmentDemo(query.demo, process.env.NODE_ENV, query.room)) return <FlowMessage step="shop" title="ルーム情報を確認してください" description="参加したタブでジャンル結果から進んでください。店舗候補と投票状況の取得には、ルームの参加情報が必要です。" />;
  const genre = resolveRestaurantGenre(query.genre, GENRES);
  // 明示的な開発デモだけで架空候補を使用する。実ルームは上のAPI入口へ渡す。
  return <RestaurantVotePrototype key={genre?.id ?? "invalid"} genre={genre} restaurants={genre ? createMockRestaurants(genre) : []} roomId={PROTOTYPE_ROOM_ID} />;
}
