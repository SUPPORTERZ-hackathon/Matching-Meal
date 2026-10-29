import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RestaurantVoteWaitingPreview } from "@/features/restaurant-vote-waiting/restaurant-vote-waiting-preview";

export const metadata: Metadata = { title: "店舗投票待機・開発プレビュー | メシマッチ", robots: { index: false, follow: false } };

export default function RestaurantVoteWaitingPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <RestaurantVoteWaitingPreview />;
}
