import type { Metadata } from "next";
import { GENRES } from "@/features/genre-vote/genres";
import { PROTOTYPE_ROOM_ID } from "@/features/genre-vote/prototype-config";
import { RestaurantVotePrototype } from "@/features/restaurant-vote/restaurant-vote-prototype";
import { createMockRestaurants } from "@/features/restaurant-vote/prototype-data";
import { resolveRestaurantGenre } from "@/features/restaurant-vote/route-data";

export const metadata: Metadata = { title: "店舗投票 | メシマッチ", description: "架空店舗の候補にボタンで投票するUIプロトタイプ。", robots: { index: false, follow: false } };
type RestaurantVotePageProps = { searchParams: Promise<{ genre?: string | string[] }> };

export default async function RestaurantVotePage({ searchParams }: RestaurantVotePageProps) {
  const genre = resolveRestaurantGenre((await searchParams).genre, GENRES);
  // 将来は取得済みの表示用データを渡す。ここでは通信せず、架空候補のみを生成する。
  return <RestaurantVotePrototype key={genre?.id ?? "invalid"} genre={genre} restaurants={genre ? createMockRestaurants(genre) : []} roomId={PROTOTYPE_ROOM_ID} />;
}
