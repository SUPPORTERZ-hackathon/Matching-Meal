import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GenreVoteWaitingPreview } from "@/features/genre-vote-waiting/genre-vote-waiting-preview";

export const metadata: Metadata = { title: "ジャンル投票待機・開発プレビュー | メシマッチ", robots: { index: false, follow: false } };

export default function GenreVoteWaitingPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <GenreVoteWaitingPreview />;
}
