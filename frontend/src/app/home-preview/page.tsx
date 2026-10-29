
import type { Metadata } from "next";
import { HomePreviewScreen } from "@/features/home-preview/home-preview-screen";

export const metadata: Metadata = {
  title: "ホーム画面プレビュー | メシマッチ",
  description: "メシマッチのホーム画面UIプレビュー。",
};

export default function HomePreviewPage() {
  return <HomePreviewScreen />;
}
