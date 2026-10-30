"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GENRES } from "../genre-vote/genres";
import { PROTOTYPE_ROOM_ID } from "../genre-vote/prototype-config";
import { RestaurantVoteScreen } from "./restaurant-vote-screen";
import { createMockRestaurants, DEFAULT_RESTAURANT_GENRE_ID, restaurantVoteUrl, restaurantWaitingUrl } from "./prototype-data";
import type { RestaurantCandidate } from "./restaurant-data";
import type { RestaurantVote } from "./vote-state";
import styles from "./restaurant-vote.module.css";

type PreviewScenario = "normal" | "long" | "missing" | "broken" | "empty" | "invalid";
const SCENARIOS: readonly { id: PreviewScenario; label: string }[] = [
  { id: "normal", label: "通常・写真未登録" }, { id: "long", label: "長い店舗情報" }, { id: "missing", label: "情報欠損" },
  { id: "broken", label: "画像読み込み失敗" }, { id: "empty", label: "候補なし" }, { id: "invalid", label: "重複ID" },
];
const BROKEN_PREVIEW_PHOTO = "/restaurants/preview-not-found.webp";

export function RestaurantVotePreview() {
  const [genreId, setGenreId] = useState<string>(DEFAULT_RESTAURANT_GENRE_ID);
  const [scenario, setScenario] = useState<PreviewScenario>("normal");
  const [revision, setRevision] = useState<number>(0);
  const [completedVotes, setCompletedVotes] = useState<readonly RestaurantVote[]>([]);
  const genre = GENRES.find((item) => item.id === genreId) ?? GENRES[0];
  const restaurants = useMemo<readonly RestaurantCandidate[]>(() => {
    const base = createMockRestaurants(genre);
    if (scenario === "empty") return [];
    if (scenario === "invalid") return [base[0], base[0]];
    return base.map((restaurant) => scenario === "missing" ? { id: restaurant.id, name: restaurant.name, source: "mock" }
      : scenario === "broken" ? { ...restaurant, photoUrl: BROKEN_PREVIEW_PHOTO }
        : scenario === "long" ? { ...restaurant, name: "サンプル店 とても長い名前の季節のごはんとみんなで楽しむ食卓のレストラン", openingHours: "月〜金 11:30〜15:00（料理ラストオーダー14:30）、17:00〜23:00（料理ラストオーダー22:00）。土・日・祝日は営業時間が異なります。", access: "サンプル駅の東改札を出て商店街を進み、サンプル通りの交差点を右折した先のサンプルビル2階です。エレベーターをご利用ください。" } : restaurant);
  }, [genre, scenario]);
  function restart() { setRevision((current) => current + 1); setCompletedVotes([]); }

  return <>
    <RestaurantVoteScreen key={`${genre.id}:${scenario}:${revision}`} genre={genre} restaurants={restaurants} roomId={PROTOTYPE_ROOM_ID} onComplete={setCompletedVotes} />
    <section className={styles.previewControls} aria-labelledby="restaurant-preview-heading">
      <h2 id="restaurant-preview-heading">店舗投票・開発用プレビュー</h2>
      <p>架空データです。投票はメモリ内のみで、再読み込み・条件変更・再開始でリセットします。このページでは完了後の記録を確認できます。</p>
      <label htmlFor="restaurant-preview-genre">ジャンル</label>
      <select id="restaurant-preview-genre" value={genre.id} onChange={(event) => { setGenreId(event.target.value); setCompletedVotes([]); }}>{GENRES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      <div className={styles.previewActions}>{SCENARIOS.map((item) => <Button key={item.id} type="button" variant="outline" aria-pressed={scenario === item.id} onClick={() => { setScenario(item.id); restart(); }}>{item.label}</Button>)}</div>
      <Button type="button" variant="soft" onClick={restart}>投票を最初から確認</Button>
      <output aria-live="polite" data-restaurant-records>完了時の記録 {completedVotes.length}件{completedVotes.map((vote) => <p key={vote.restaurantId}>{vote.restaurantId}：{vote.choice === "like" ? "ここがいい" : "見送り"}</p>)}</output>
      <p><Link href={restaurantVoteUrl(genre.id)}>通常画面から待機まで操作する</Link></p>
      <p><Link href={restaurantWaitingUrl(genre.id)}>待機画面を見る（独立モック）</Link></p>
    </section>
  </>;
}
