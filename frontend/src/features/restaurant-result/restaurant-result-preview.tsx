"use client";

import { useState } from "react";
import Link from "next/link";
import { GENRES } from "../genre-vote/genres";
import { PROTOTYPE_ROOM_ID } from "../genre-vote/prototype-config";
import { createMockRestaurants, DEFAULT_RESTAURANT_GENRE_ID, restaurantVoteUrl } from "../restaurant-vote/prototype-data";
import type { RestaurantCandidate } from "../restaurant-vote/restaurant-data";
import { RestaurantResultScreen } from "./restaurant-result-screen";
import { createMockRestaurantResult, restaurantResultUrl } from "./prototype-data";
import type { RestaurantResultData } from "./result-data";
import styles from "./restaurant-result.module.css";

type Scenario = "normal" | "long-shop" | "long-genre" | "no-photo" | "broken-photo" | "missing-info" | "no-result" | "partial" | "no-votes" | "zero-voters" | "zero-percent" | "one-third" | "three-quarters";
const SCENARIOS: readonly { id: Scenario; label: string }[] = [
  { id: "normal", label: "通常のサンプル結果" }, { id: "long-shop", label: "長い店舗名" }, { id: "long-genre", label: "長いジャンル名" },
  { id: "no-photo", label: "写真なし" }, { id: "broken-photo", label: "画像読み込み失敗" }, { id: "missing-info", label: "店舗情報欠損" },
  { id: "no-result", label: "結果データなし" }, { id: "partial", label: "一部の参加者が支持" }, { id: "no-votes", label: "投票内訳なし" },
  { id: "zero-voters", label: "投票0人・集計待ち" }, { id: "zero-percent", label: "マッチ率0%" }, { id: "one-third", label: "マッチ率33%" }, { id: "three-quarters", label: "マッチ率75%" },
];
const BROKEN_PHOTO_PATH = "/restaurants/preview-result-missing.webp";

export function RestaurantResultPreview() {
  const [genreId, setGenreId] = useState<string>(DEFAULT_RESTAURANT_GENRE_ID);
  const [restaurantId, setRestaurantId] = useState<string>(() => createMockRestaurants(GENRES[0])[0].id);
  const [scenario, setScenario] = useState<Scenario>("normal");
  const genre = GENRES.find((item) => item.id === genreId);
  const genres = scenario === "long-genre" ? GENRES.map((item) => item.id === genreId ? { ...item, name: "季節の料理とみんなでゆっくり楽しむとても長いジャンル名の表示確認" } : item) : GENRES;
  const restaurants: readonly RestaurantCandidate[] = genre ? createMockRestaurants(genre).map((restaurant) => scenario === "long-shop" ? { ...restaurant, name: "サンプル店 季節の料理とみんなで楽しむとても長い名前のレストラン" }
    : scenario === "broken-photo" ? { ...restaurant, photoUrl: BROKEN_PHOTO_PATH }
      : scenario === "missing-info" ? { id: restaurant.id, name: restaurant.name, source: "mock" } : restaurant) : [];
  const base = createMockRestaurantResult(genreId, restaurantId);
  const result: RestaurantResultData | null = scenario === "no-result" ? null : scenario === "partial" ? { ...base, votes: { likes: 2, total: 3 } }
    : scenario === "zero-voters" ? { ...base, votes: { likes: 0, total: 0 } } : scenario === "zero-percent" ? { ...base, votes: { likes: 0, total: 3 } }
      : scenario === "one-third" ? { ...base, votes: { likes: 1, total: 3 } } : scenario === "three-quarters" ? { ...base, votes: { likes: 3, total: 4 } }
        : scenario === "no-votes" ? { genreId, restaurantId } : base;

  return <RestaurantResultScreen result={result} genres={genres} restaurants={restaurants} roomId={PROTOTYPE_ROOM_ID} isPrototype>
    <section className={styles.previewControls} aria-labelledby="restaurant-result-preview-heading">
      <h2 id="restaurant-result-preview-heading">店舗結果・開発用プレビュー</h2>
      <p>共有の架空店舗と明示したサンプル内訳です。店舗の実位置は未登録のため、マップは無効です。集計・API通信・演出は行いません。</p>
      <label htmlFor="result-preview-genre">決定ジャンル</label><select id="result-preview-genre" value={genreId} onChange={(event) => setGenreId(event.target.value)}>{GENRES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      <label htmlFor="result-preview-shop">決定店舗</label><select id="result-preview-shop" value={restaurantId} onChange={(event) => setRestaurantId(event.target.value)}>{genre && createMockRestaurants(genre).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
      <label htmlFor="result-preview-scenario">表示状態</label><select id="result-preview-scenario" value={scenario} onChange={(event) => { const next = SCENARIOS.find((item) => item.id === event.target.value); if (next) setScenario(next.id); }}>{SCENARIOS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
      <p>写真なし・座標なしは通常のモックでも確認できます。</p>
      <p><Link href={restaurantResultUrl(genreId, restaurantId, { demo: true })}>同じIDのデモ結果画面を見る</Link></p>
      <p><Link href={restaurantVoteUrl(genreId)}>このジャンルで店舗投票から確認する</Link></p>
    </section>
  </RestaurantResultScreen>;
}
