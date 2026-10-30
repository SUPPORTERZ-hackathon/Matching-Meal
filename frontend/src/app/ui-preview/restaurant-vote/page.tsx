import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RestaurantVotePreview } from "@/features/restaurant-vote/restaurant-vote-preview";

export const metadata: Metadata = { title: "店舗投票・開発プレビュー | メシマッチ", robots: { index: false, follow: false } };

export default function RestaurantVotePreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <RestaurantVotePreview />;
}
