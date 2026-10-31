import type { Metadata, Viewport } from "next";
import { GENRES } from "@/features/genre-vote/genres";
import { GENRE_ICON_PATH, GENRE_THEME_COLOR, PROTOTYPE_ROOM_ID } from "@/features/genre-vote/prototype-config";
import { GenreResultPrototype } from "@/features/genre-result/genre-result-prototype";
import { MOCK_GENRE_RESULT } from "@/features/genre-result/prototype-data";
import { notFound } from "next/navigation";
import { isDevelopmentDemo, type QueryValue } from "@/features/ui-flow/development-demo";
import { FlowMessage } from "@/features/ui-flow/flow-message";
import { FixedBottomAction } from "@/components/common/fixed-bottom-action";
import { BottomAction } from "@/components/common/bottom-action";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "ジャンル投票結果 | メシマッチ",
  description: "決定した料理ジャンルを発表するUIプロトタイプ。",
  icons: { apple: `${GENRE_ICON_PATH}/apple-180.png`, icon: `${GENRE_ICON_PATH}/icon-192.png` },
};
export const viewport: Viewport = { themeColor: GENRE_THEME_COLOR };

type GenreResultPageProps = { searchParams: Promise<{ demo?: QueryValue; room?: QueryValue }> };
export default async function GenreResultPage({ searchParams }: GenreResultPageProps) {
  const query = await searchParams;
  if (query.room === undefined && query.demo === "1" && process.env.NODE_ENV !== "development") notFound();
  if (isDevelopmentDemo(query.demo, process.env.NODE_ENV, query.room)) return <GenreResultPrototype result={MOCK_GENRE_RESULT} genres={GENRES} roomId={PROTOTYPE_ROOM_ID} />;
  return <FlowMessage step="genre" title="ジャンル結果の取得は準備中です" description="投票結果の取得はまだ接続されていません。決定したジャンルを確認できるまで、お店探しには進めません。" bottomAction={<FixedBottomAction><BottomAction><Button type="button" variant="primary" size="meal" disabled>このジャンルでお店を探す</Button></BottomAction></FixedBottomAction>} />;
}
