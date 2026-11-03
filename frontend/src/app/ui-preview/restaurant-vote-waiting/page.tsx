import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RestaurantVoteWaitingPreview } from "@/features/restaurant-vote-waiting/restaurant-vote-waiting-preview";

export const metadata: Metadata = { title: "店舗投票待機・開発プレビュー | メシマッチ", robots: { index: false, follow: false } };

type WaitingPreviewPageProps = { searchParams: Promise<{ genre?: string | string[] }> };
export default async function RestaurantVoteWaitingPreviewPage({ searchParams }: WaitingPreviewPageProps) {
  if (process.env.NODE_ENV !== "development") notFound();
  const query = await searchParams;
  const genreId = Array.isArray(query.genre) ? "" : query.genre;
  return <RestaurantVoteWaitingPreview key={genreId ?? "sample"} initialGenreId={genreId} />;
}
