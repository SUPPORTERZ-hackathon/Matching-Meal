import type { Metadata } from "next";
import { GenreVoteWaitingPreview } from "@/features/genre-vote-waiting/genre-vote-waiting-preview";
import { isDevelopmentDemo, type QueryValue } from "@/features/ui-flow/development-demo";
import { FlowMessage } from "@/features/ui-flow/flow-message";
import { notFound } from "next/navigation";
import { GenreVotingEntry } from "@/features/genre-voting-api/genre-voting-entry";
import { normalizeVotingRoomId } from "@/features/genre-voting-api/genre-voting-data";

export const metadata: Metadata = {
  title: "ジャンル投票待機 | メシマッチ",
  description: "みんなのジャンル投票の完了を待つUIプロトタイプ。",
};

type WaitingPageProps = { searchParams: Promise<{ demo?: QueryValue; room?: QueryValue }> };
export default async function GenreVoteWaitingPage({ searchParams }: WaitingPageProps) {
  const query = await searchParams;
  if (query.room !== undefined) return <GenreVotingEntry key={typeof query.room === "string" ? query.room : "invalid"} roomId={normalizeVotingRoomId(query.room)} screen="waiting" />;
  if (query.room === undefined && query.demo === "1" && process.env.NODE_ENV !== "development") notFound();
  return isDevelopmentDemo(query.demo, process.env.NODE_ENV, query.room) ? <GenreVoteWaitingPreview />
    : <FlowMessage step="genre" title="ルーム情報を確認してください" description="参加したタブから投票を開いてください。ルーム情報なしでは投票状況を表示できません。" />;
}
