import type { Metadata, Viewport } from "next";
import { GENRE_ICON_PATH, GENRE_MANIFEST_PATH, GENRE_THEME_COLOR } from "@/features/genre-vote/prototype-config";
import { GenreVoteWaitingPreview } from "@/features/genre-vote-waiting/genre-vote-waiting-preview";
import { isDevelopmentDemo, type QueryValue } from "@/features/ui-flow/development-demo";
import { FlowMessage } from "@/features/ui-flow/flow-message";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "ジャンル投票待機 | メシマッチ",
  description: "みんなのジャンル投票の完了を待つUIプロトタイプ。",
  manifest: GENRE_MANIFEST_PATH,
  appleWebApp: { capable: true, title: "メシマッチ", statusBarStyle: "default" },
  icons: { apple: `${GENRE_ICON_PATH}/apple-180.png`, icon: `${GENRE_ICON_PATH}/icon-192.png` },
};
export const viewport: Viewport = { themeColor: GENRE_THEME_COLOR };

type WaitingPageProps = { searchParams: Promise<{ demo?: QueryValue; room?: QueryValue }> };
export default async function GenreVoteWaitingPage({ searchParams }: WaitingPageProps) {
  const query = await searchParams;
  if (query.room === undefined && query.demo === "1" && process.env.NODE_ENV !== "development") notFound();
  return isDevelopmentDemo(query.demo, process.env.NODE_ENV, query.room) ? <GenreVoteWaitingPreview />
    : <FlowMessage step="genre" title="投票状況の取得は準備中です" description="参加者の投票完了状況と結果の取得は、まだ接続されていません。" />;
}
