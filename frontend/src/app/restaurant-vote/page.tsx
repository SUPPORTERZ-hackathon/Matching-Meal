import type { Metadata } from "next";
import { GENRES } from "@/features/genre-vote/genres";
import { PROTOTYPE_ROOM_ID } from "@/features/genre-vote/prototype-config";
import { RestaurantVotePrototype } from "@/features/restaurant-vote/restaurant-vote-prototype";
import { createMockRestaurants } from "@/features/restaurant-vote/prototype-data";
import { resolveRestaurantGenre } from "@/features/restaurant-vote/route-data";
import { notFound } from "next/navigation";
import { isDevelopmentDemo, type QueryValue } from "@/features/ui-flow/development-demo";
import { FlowMessage } from "@/features/ui-flow/flow-message";

export const metadata: Metadata = { title: "店舗投票 | メシマッチ", description: "架空店舗の候補にボタンで投票するUIプロトタイプ。", robots: { index: false, follow: false } };
type RestaurantVotePageProps = { searchParams: Promise<{ genre?: QueryValue; demo?: QueryValue; room?: QueryValue }> };

export default async function RestaurantVotePage({ searchParams }: RestaurantVotePageProps) {
  const query = await searchParams;
  if (query.room === undefined && query.demo === "1" && process.env.NODE_ENV !== "development") notFound();
  if (!isDevelopmentDemo(query.demo, process.env.NODE_ENV, query.room)) return <FlowMessage step="shop" title="店舗候補の取得は準備中です" description="決定ジャンルに対応する店舗候補の取得と投票の送信は、まだ接続されていません。" />;
  const genre = resolveRestaurantGenre(query.genre, GENRES);
  // 将来は取得済みの表示用データを渡す。ここでは通信せず、架空候補のみを生成する。
  return <RestaurantVotePrototype key={genre?.id ?? "invalid"} genre={genre} restaurants={genre ? createMockRestaurants(genre) : []} roomId={PROTOTYPE_ROOM_ID} />;
}
