import type { Metadata } from "next";
import { PROTOTYPE_ROOM_ID } from "@/features/genre-vote/prototype-config";
import { RestaurantVoteWaitingScreen } from "@/features/restaurant-vote-waiting/restaurant-vote-waiting-screen";
import { MOCK_RESTAURANT_PARTICIPANTS } from "@/features/restaurant-vote-waiting/prototype-data";

export const metadata: Metadata = { title: "店舗投票待機 | メシマッチ", description: "参加者の店舗投票完了を待つ画面のUIプロトタイプ。", robots: { index: false, follow: false } };

export default function RestaurantVoteWaitingPage() {
  return <RestaurantVoteWaitingScreen participants={MOCK_RESTAURANT_PARTICIPANTS} roomId={PROTOTYPE_ROOM_ID} />;
}
