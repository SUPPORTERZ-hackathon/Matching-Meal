import test from "node:test";
import assert from "node:assert/strict";
import { toRestaurantCandidate, safeRestaurantDetailUrl, safeRestaurantPhotoUrl, hasValidRestaurantCandidates } from "./restaurant-data.ts";
import { recordRestaurantVote } from "./vote-state.ts";
import { createMockRestaurants, restaurantVoteUrl, restaurantWaitingUrl } from "./prototype-data.ts";
import { resolveRestaurantGenre } from "./route-data.ts";
import { GENRES } from "../genre-vote/genres.ts";

test("公式フィールドを表示用に変換し、ディナー予算と駅のアクセスを保持する", () => {
  const input = { id: " J000000000 ", name: " テスト入力 ", photo: { pc: { l: "https://example.test/large.jpg", m: "https://example.test/medium.jpg" } }, open: " 11:00〜23:00 ", close: " 水曜日 ", budget: { average: " ディナー3,000円 ", name: "2,001〜3,000円" }, access: "駅Aから徒歩8分", mobile_access: "駅Bから徒歩3分", station_name: " 駅B ", urls: { pc: "https://www.hotpepper.jp/strJ000000000/" }, lat: 35, lng: 139 };
  const before = structuredClone(input);
  const result = toRestaurantCandidate(input);
  assert.deepEqual(result, { id: "J000000000", name: "テスト入力", photoUrl: "https://example.test/large.jpg", openingHours: "11:00〜23:00", closedDays: "水曜日", dinnerBudget: "ディナー3,000円", access: "駅Bから徒歩3分", stationName: "駅B", detailUrl: input.urls.pc, coordinates: { latitude: 35, longitude: 139 }, source: "hotpepper" });
  assert.deepEqual(input, before);
});

test("写真/予算/アクセスの代替とnull/空欄を扱い、金額や徒歩時間を推測しない", () => {
  const result = toRestaurantCandidate({ id: "a", name: "A", photo: { pc: { l: "javascript:bad", m: "https://example.test/m.jpg" } }, budget: { average: " ", name: "2,001〜3,000円" }, mobile_access: " ", access: "駅よりバスでお越しください" });
  assert.equal(result.photoUrl, "https://example.test/m.jpg");
  assert.equal(result.dinnerBudget, "2,001〜3,000円");
  assert.equal(result.access, "駅よりバスでお越しください");
  const empty = toRestaurantCandidate({ id: "a", name: "A", open: null, close: " ", budget: null, photo: null, urls: null, lat: null, lng: null });
  for (const field of ["photoUrl", "openingHours", "closedDays", "dinnerBudget", "access", "stationName", "detailUrl", "coordinates"]) assert.equal(empty[field], undefined);
});

test("座標は有限・範囲内のペアのみ受け取り、不正な片側から位置を生成しない", () => {
  for (const [lat, lng] of [[91, 0], [0, -181], [NaN, 139], [35, Infinity], [35, undefined]]) assert.equal(toRestaurantCandidate({ id: "a", name: "A", lat, lng }).coordinates, undefined);
  assert.deepEqual(toRestaurantCandidate({ id: "a", name: "A", lat: 0, lng: 0 }).coordinates, { latitude: 0, longitude: 0 });
});

test("詳細はHTTPSの公式店舗パスだけを許可し、偽ドメイン/不正scheme/資格情報を拒否する", () => {
  // URLは構文テスト用。実店舗/検証済みモックとして画面には渡さない。
  assert.equal(safeRestaurantDetailUrl("https://www.hotpepper.jp/strJ000000000/?x=1"), "https://www.hotpepper.jp/strJ000000000/?x=1");
  for (const url of [undefined, "", "javascript:alert(1)", "data:text/html,bad", "http://www.hotpepper.jp/strJ000000000/", "https://www.hotpepper.jp.evil.test/strJ000000000/", "https://www.hotpepper.jp@evil.test/strJ000000000/", "https://evil.test/strJ000000000/", "https://user:pass@www.hotpepper.jp/strJ000000000/", "https://www.hotpepper.jp:8080/strJ000000000/", "https://www.hotpepper.jp/", "/strJ000000000/"]) assert.equal(safeRestaurantDetailUrl(url), undefined, url);
});

test("写真はローカル領域かHTTPSのみを使い、不正URLを表示しない", () => {
  assert.equal(safeRestaurantPhotoUrl("/restaurants/sample.webp"), "/restaurants/sample.webp");
  assert.equal(safeRestaurantPhotoUrl("https://example.test/photo.jpg"), "https://example.test/photo.jpg");
  for (const url of ["//example.test/p.png", "javascript:alert(1)", "http://example.test/p.jpg", "data:image/png;base64,AAAA", "/restaurants/../secret", "/restaurants/..\\secret", "https://user:pass@example.test/p.png"]) assert.equal(safeRestaurantPhotoUrl(url), undefined);
});

test("架空4候補は一意IDで、16ジャンルを受け取り、架空URL/写真/座標を作らない", () => {
  for (const genre of GENRES) {
    const candidates = createMockRestaurants(genre);
    assert.equal(candidates.length, 4);
    assert.equal(hasValidRestaurantCandidates(candidates), true);
    assert(candidates.every((item) => item.source === "mock" && item.name.includes(genre.name) && !item.detailUrl && !item.photoUrl && !item.coordinates));
  }
});

test("店舗IDでlike/skipを順に記録し、二重投票/先取り/完了後追加を拒否する", () => {
  const candidates = createMockRestaurants(GENRES[0]);
  const untouched = [];
  assert.equal(recordRestaurantVote(untouched, candidates, { restaurantId: candidates[1].id, choice: "like" }), untouched);
  let votes = untouched;
  for (const [index, restaurant] of candidates.entries()) {
    const previous = votes;
    votes = recordRestaurantVote(votes, candidates, { restaurantId: restaurant.id, choice: index % 2 ? "skip" : "like" });
    assert.equal(votes.length, index + 1);
    assert.equal(previous.length, index);
    assert.equal(recordRestaurantVote(votes, candidates, { restaurantId: restaurant.id, choice: "skip" }), votes);
  }
  assert.deepEqual(votes.map((vote) => vote.choice), ["like", "skip", "like", "skip"]);
  assert.equal(recordRestaurantVote(votes, candidates, { restaurantId: "extra", choice: "like" }), votes);
  assert.deepEqual(untouched, []);
  assert.equal(recordRestaurantVote(untouched, [], { restaurantId: "a", choice: "like" }), untouched);
});

test("欠損/重複ID・空名を正常な候補と扱わない", () => {
  const candidates = createMockRestaurants(GENRES[0]);
  assert.equal(hasValidRestaurantCandidates([candidates[0], candidates[0]]), false);
  assert.equal(hasValidRestaurantCandidates([{ ...candidates[0], id: " " }]), false);
  assert.equal(hasValidRestaurantCandidates([{ ...candidates[0], name: " " }]), false);
});

test("固定ジャンルIDを引き継ぎ、不明/空/重複queryから別ジャンルを推測しない", () => {
  assert.equal(resolveRestaurantGenre(undefined, GENRES, "ramen").id, "ramen");
  assert.equal(resolveRestaurantGenre("cafe", GENRES, "ramen").id, "cafe");
  for (const value of ["", "not-found", ["ramen", "cafe"]]) assert.equal(resolveRestaurantGenre(value, GENRES, "ramen"), undefined);
  assert.equal(restaurantVoteUrl("sushi-seafood"), "/restaurant-vote?genre=sushi-seafood");
  assert.equal(restaurantWaitingUrl("sushi-seafood"), "/restaurant-vote-waiting?genre=sushi-seafood");
  assert.equal(restaurantVoteUrl("a&b"), "/restaurant-vote?genre=a%26b");
});
