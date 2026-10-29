import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GenreResultPreview } from "@/features/genre-result/genre-result-preview";

export const metadata: Metadata = { title: "ジャンル結果・開発プレビュー | メシマッチ", robots: { index: false, follow: false } };

export default function GenreResultPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <GenreResultPreview />;
}
