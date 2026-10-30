import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RestaurantResultPreview } from "@/features/restaurant-result/restaurant-result-preview";

export const metadata: Metadata = { title: "店舗結果・開発プレビュー | メシマッチ", robots: { index: false, follow: false } };

export default function RestaurantResultPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <RestaurantResultPreview />;
}
