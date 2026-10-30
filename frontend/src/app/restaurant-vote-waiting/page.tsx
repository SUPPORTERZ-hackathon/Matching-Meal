import type { Metadata } from "next";
import { PROTOTYPE_ROOM_ID } from "@/features/genre-vote/prototype-config";
import { RestaurantVoteWaitingScreen } from "@/features/restaurant-vote-waiting/restaurant-vote-waiting-screen";
import { MOCK_RESTAURANT_PARTICIPANTS } from "@/features/restaurant-vote-waiting/prototype-data";
import { GENRES } from "@/features/genre-vote/genres";
import { createMockRestaurants } from "@/features/restaurant-vote/prototype-data";
import { resolveRestaurantGenre } from "@/features/restaurant-vote/route-data";
import { isRestaurantDemo } from "@/features/restaurant-result/prototype-data";
import { RestaurantDemoAction } from "@/features/restaurant-vote-waiting/restaurant-demo-action";

export const metadata: Metadata = { title: "店舗投票待機 | メシマッチ", description: "参加者の店舗投票完了を待つ画面のUIプロトタイプ。", robots: { index: false, follow: false } };

type WaitingPageProps = { searchParams: Promise<{ genre?: string | string[]; demo?: string | string[] }> };
export default async function RestaurantVoteWaitingPage({ searchParams }: WaitingPageProps) {
  const query = await searchParams;
  const demo = isRestaurantDemo(query.demo);
  const genre = resolveRestaurantGenre(query.genre, GENRES);
  // 表示用に先頭候補を選ぶだけで、勝者の決定や投票集計は行わない。
  const restaurant = demo && genre ? createMockRestaurants(genre)[0] : undefined;
  return <><RestaurantVoteWaitingScreen participants={MOCK_RESTAURANT_PARTICIPANTS} roomId={PROTOTYPE_ROOM_ID} />{demo && <RestaurantDemoAction genre={genre} restaurant={restaurant} />}</>;
}
