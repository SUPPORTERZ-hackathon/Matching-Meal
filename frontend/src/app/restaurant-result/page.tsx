import type { Metadata } from "next";
import { GENRES } from "@/features/genre-vote/genres";
import { PROTOTYPE_ROOM_ID } from "@/features/genre-vote/prototype-config";
import { createMockRestaurants } from "@/features/restaurant-vote/prototype-data";
import { resolveRestaurantGenre } from "@/features/restaurant-vote/route-data";
import { createMockRestaurantResult } from "@/features/restaurant-result/prototype-data";
import { RestaurantResultScreen } from "@/features/restaurant-result/restaurant-result-screen";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isDevelopmentDemo } from "@/features/ui-flow/development-demo";

export const metadata: Metadata = { title: "お店が決定！ | メシマッチ", description: "決定した店舗を表示する静的UIプロトタイプ。", robots: { index: false, follow: false } };
type RestaurantResultPageProps = { searchParams: Promise<{ genre?: string | string[]; restaurant?: string | string[]; demo?: string | string[]; room?: string | string[] }> };

export default async function RestaurantResultPage({ searchParams }: RestaurantResultPageProps) {
  const query = await searchParams;
  const genre = resolveRestaurantGenre(query.genre, GENRES);
  if (query.room === undefined && query.demo === "1" && process.env.NODE_ENV !== "development") notFound();
  const demo = isDevelopmentDemo(query.demo, process.env.NODE_ENV, query.room);
  // 正式な結果取得は未実装。明示デモ以外ではモックを正式結果として供給しない。
  const result = demo && genre && typeof query.restaurant === "string" && query.restaurant ? createMockRestaurantResult(genre.id, query.restaurant) : null;
  return <RestaurantResultScreen result={result} genres={GENRES} restaurants={genre && demo ? createMockRestaurants(genre) : []} roomId={demo ? PROTOTYPE_ROOM_ID : undefined} isPrototype={demo}>{!demo && <p className="meal-flow-notice">正式な店舗結果の取得は準備中です。<Link href="/home-preview">ホームに戻る</Link></p>}</RestaurantResultScreen>;
}
