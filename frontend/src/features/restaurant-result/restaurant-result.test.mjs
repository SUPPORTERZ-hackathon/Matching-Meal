import test from "node:test";
import assert from "node:assert/strict";
import { createGoogleMapsUrl } from "./maps-url.ts";
import { resolveRestaurantResult, calculateMatchRate } from "./result-data.ts";
import { createMockRestaurantResult, restaurantResultUrl, isRestaurantDemo } from "./prototype-data.ts";
import { GENRES } from "../genre-vote/genres.ts";
import { createMockRestaurants } from "../restaurant-vote/prototype-data.ts";
import { toRestaurantCandidate } from "../restaurant-vote/restaurant-data.ts";

test("Maps URLsにapi=1とエンコードした座標を含め、キーやAPI通信を使わない", () => {
  const url = createGoogleMapsUrl({ latitude: 35.5, longitude: 139.75 });
  assert.equal(url, "https://www.google.com/maps/search/?api=1&query=35.5%2C139.75");
  const parsed = new URL(url);
  assert.equal(parsed.searchParams.get("query"), "35.5,139.75");
  assert.equal(parsed.searchParams.has("key"), false);
});

test("座標の0と境界値は有効、欠損・文字列・非有限・範囲外はリンクを生成しない", () => {
  for (const coordinates of [{ latitude: 0, longitude: 0 }, { latitude: -90, longitude: 180 }, { latitude: 90, longitude: -180 }]) assert(createGoogleMapsUrl(coordinates));
  for (const coordinates of [undefined, {}, { latitude: 35 }, { longitude: 139 }, { latitude: "35", longitude: 139 }, { latitude: null, longitude: 139 }, { latitude: NaN, longitude: 139 }, { latitude: 35, longitude: Infinity }, { latitude: 90.01, longitude: 0 }, { latitude: 0, longitude: -180.01 }]) assert.equal(createGoogleMapsUrl(coordinates), undefined);
});

test("16ジャンルの固定IDから日本語名と既存店舗を参照し、同一モックを重複定義しない", () => {
  for (const genre of GENRES) {
    const candidates = createMockRestaurants(genre);
    const input = createMockRestaurantResult(genre.id, candidates[1].id);
    const view = resolveRestaurantResult(input, GENRES, candidates);
    assert.equal(view.genre, genre);
    assert.equal(view.genre.name, genre.name);
    assert.equal(view.restaurant, candidates[1]);
    assert.equal(view.unanimous, true);
    assert.equal(createGoogleMapsUrl(view.restaurant.coordinates), undefined);
  }
});

test("決定IDは入力を使い、支持数から勝者や同票ルールを推測しない", () => {
  const candidates = createMockRestaurants(GENRES[0]);
  const result = { genreId: "ramen", restaurantId: candidates[3].id, votes: { likes: 1, total: 3 } };
  const before = structuredClone(result);
  const view = resolveRestaurantResult(result, GENRES, candidates);
  assert.equal(view.restaurant.id, candidates[3].id);
  assert.equal(view.unanimous, false);
  assert.deepEqual(result, before);
});

test("欠損結果・未知のジャンル/店舗・重複候補・空名を別データで補完しない", () => {
  const candidates = createMockRestaurants(GENRES[0]);
  const result = createMockRestaurantResult("ramen", candidates[0].id);
  assert.equal(resolveRestaurantResult(null, GENRES, candidates), null);
  assert.equal(resolveRestaurantResult({ ...result, genreId: "not-found" }, GENRES, candidates), null);
  assert.equal(resolveRestaurantResult({ ...result, restaurantId: "not-found" }, GENRES, candidates), null);
  assert.equal(resolveRestaurantResult(result, GENRES, []), null);
  assert.equal(resolveRestaurantResult(result, GENRES, [candidates[0], candidates[0]]), null);
  assert.equal(resolveRestaurantResult(result, GENRES, [{ ...candidates[0], name: " " }]), null);
});

test("不正な票数を拒否し、内訳なしや0/0を満場一致にしない", () => {
  const candidates = createMockRestaurants(GENRES[0]);
  const result = createMockRestaurantResult("ramen", candidates[0].id);
  for (const votes of [{ likes: -1, total: 3 }, { likes: 4, total: 3 }, { likes: 1.5, total: 3 }, { likes: 1, total: NaN }, { likes: Infinity, total: 3 }, { likes: 0, total: -1 }]) assert.equal(resolveRestaurantResult({ ...result, votes }, GENRES, candidates), null);
  assert.equal(resolveRestaurantResult({ ...result, votes: undefined }, GENRES, candidates).unanimous, false);
  assert.equal(resolveRestaurantResult({ ...result, votes: { likes: 0, total: 0 } }, GENRES, candidates).unanimous, false);
});

test("結果URLにジャンルIDと店舗IDの両方を渡し、区切り文字もエンコードする", () => {
  const url = restaurantResultUrl("sushi-seafood", "mock-restaurant-komorebi");
  assert.equal(url, "/restaurant-result?genre=sushi-seafood&restaurant=mock-restaurant-komorebi");
  assert.equal(restaurantResultUrl("a&b", "c/d"), "/restaurant-result?genre=a%26b&restaurant=c%2Fd");
});

test("住所は公式部分型から任意で取り込み、欠損時に架空住所を補完しない", () => {
  assert.equal(toRestaurantCandidate({ id: "a", name: "入力データ", address: " 入力された住所 " }).address, "入力された住所");
  assert.equal(toRestaurantCandidate({ id: "a", name: "入力データ", address: null }).address, undefined);
  assert.equal(toRestaurantCandidate({ id: "a", name: "入力データ", address: " " }).address, undefined);
});

test("マッチ率は投票済みの支持数/ここがいい＋見送りで四捨五入する", () => {
  for (const [likes, skips, expected] of [[0, 3, 0], [1, 2, 33], [2, 1, 67], [3, 1, 75], [3, 0, 100], [1, 7, 13]]) {
    assert.equal(calculateMatchRate({ likes, total: likes + skips }), expected);
  }
  // ルームに何人いても、渡すtotalは対象店舗へ投票済みの人数のみ。
  const resultWithUnvotedParticipants = { likes: 2, total: 3, unvotedParticipants: 9 };
  assert.equal(calculateMatchRate(resultWithUnvotedParticipants), 67);
});

test("0人と未取得は集計待ち、0%とは区別し、不正な内訳を数値化しない", () => {
  assert.equal(calculateMatchRate({ likes: 0, total: 0 }), null);
  assert.equal(calculateMatchRate(), null);
  assert.equal(calculateMatchRate({ likes: 0, total: 3 }), 0);
  for (const votes of [{ likes: -1, total: 3 }, { likes: 4, total: 3 }, { likes: 1, total: 0 }, { likes: .5, total: 3 }, { likes: NaN, total: 3 }, { likes: 1, total: Infinity }]) assert.equal(calculateMatchRate(votes), null);
});

test("単一のdemo=1のみ有効にし、結果URLに両IDと明示デモを渡す", () => {
  assert.equal(isRestaurantDemo("1"), true);
  for (const value of [undefined, "", "0", "true", "01", ["1"], ["1", "1"]]) assert.equal(isRestaurantDemo(value), false);
  assert.equal(restaurantResultUrl("italian", "mock-restaurant-akari", { demo: true }), "/restaurant-result?genre=italian&restaurant=mock-restaurant-akari&demo=1");
  assert.equal(new URL(restaurantResultUrl("italian", "mock-restaurant-akari"), "https://example.test").searchParams.has("demo"), false);
});
