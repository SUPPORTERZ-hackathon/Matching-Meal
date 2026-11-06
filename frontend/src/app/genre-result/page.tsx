import type { Metadata } from "next";
import { GENRES } from "@/features/genre-vote/genres";
import { PROTOTYPE_ROOM_ID } from "@/features/genre-vote/prototype-config";
import { GenreResultPrototype } from "@/features/genre-result/genre-result-prototype";
import { MOCK_GENRE_RESULT } from "@/features/genre-result/prototype-data";
import { notFound } from "next/navigation";
import { isDevelopmentDemo, type QueryValue } from "@/features/ui-flow/development-demo";
import { FlowMessage } from "@/features/ui-flow/flow-message";
import { FixedBottomAction } from "@/components/common/fixed-bottom-action";
import { BottomAction } from "@/components/common/bottom-action";
import { Button } from "@/components/ui/button";
import { GenreVotingEntry } from "@/features/genre-voting-api/genre-voting-entry";
import { normalizeVotingRoomId } from "@/features/genre-voting-api/genre-voting-data";

export const metadata: Metadata = {
  title: "ジャンル投票結果 | メシマッチ",
  description: "決定した料理ジャンルを発表するUIプロトタイプ。",
};

type GenreResultPageProps = { searchParams: Promise<{ demo?: QueryValue; room?: QueryValue }> };
export default async function GenreResultPage({ searchParams }: GenreResultPageProps) {
  const query = await searchParams;
  if (query.room !== undefined) return <GenreVotingEntry key={typeof query.room === "string" ? query.room : "invalid"} roomId={normalizeVotingRoomId(query.room)} screen="result" />;
  if (query.room === undefined && query.demo === "1" && process.env.NODE_ENV !== "development") notFound();
  if (isDevelopmentDemo(query.demo, process.env.NODE_ENV, query.room)) return <GenreResultPrototype result={MOCK_GENRE_RESULT} genres={GENRES} roomId={PROTOTYPE_ROOM_ID} />;
  return <FlowMessage step="genre" title="ルーム情報を確認してください" description="参加したタブから結果を開いてください。ルーム情報なしでは投票結果を表示できません。" bottomAction={<FixedBottomAction><BottomAction><Button type="button" variant="primary" size="meal" disabled>このジャンルでお店を探す</Button></BottomAction></FixedBottomAction>} />;
}
