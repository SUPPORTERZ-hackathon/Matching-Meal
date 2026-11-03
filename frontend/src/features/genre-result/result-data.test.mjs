import test from "node:test";
import assert from "node:assert/strict";
import { resolveGenreResult, getVotePercentage, topGenreRankings } from "./result-data.ts";
import { GENRES } from "../genre-vote/genres.ts";
import { GENRE_RANKING_SCENARIOS, createMockRankingResult } from "./prototype-data.ts";

const sample = { decidedGenreId: "ramen", participantCount: 3, rankings: [{ genreId: "ramen", votes: 3 }, { genreId: "yakiniku", votes: 2 }, { genreId: "sushi-seafood", votes: 1 }] };

test("既存IDから名前と画像を参照し、渡された結果の順序/値を保つ", () => {
  const before = structuredClone(sample);
  const genres = GENRES.map((genre) => genre.id === "ramen" ? { ...genre, imagePath: "/genres/ramen.webp" } : genre);
  const view = resolveGenreResult(sample, genres);
  assert.equal(view.genre.name, "ラーメン");
  assert.equal(view.genre.imagePath, "/genres/ramen.webp");
  assert.deepEqual(view.rankings.map((row) => [row.genre.id, row.votes]), [["ramen", 3], ["yakiniku", 2], ["sushi-seafood", 1]]);
  assert.deepEqual(sample, before);
});

test("決定ジャンルと1位が異なる入力を、再抽選や並べ替えで補正しない", () => {
  const input = { ...sample, decidedGenreId: "cafe", rankings: [{ genreId: "yakiniku", votes: 3 }, { genreId: "ramen", votes: 3 }] };
  assert.equal(resolveGenreResult(input, GENRES), null);
  const view = resolveGenreResult({ ...input, rankings: [{ genreId: "cafe", votes: 3 }, ...input.rankings] }, GENRES);
  assert.equal(view.genre.id, "cafe");
  assert.deepEqual(view.rankings.map((row) => row.genre.id), ["cafe", "yakiniku", "ramen"]);
});

test("不明な決定ID/内訳ID/重複した内訳と不正な票数は表示しない", () => {
  assert.equal(resolveGenreResult({ ...sample, decidedGenreId: "not-registered" }, GENRES), null);
  assert.equal(resolveGenreResult({ ...sample, rankings: [{ genreId: "not-registered", votes: 1 }] }, GENRES), null);
  assert.equal(resolveGenreResult({ ...sample, rankings: [sample.rankings[0], sample.rankings[0]] }, GENRES), null);
  for (const votes of [-1, .5, 4, NaN, Infinity]) assert.equal(resolveGenreResult({ ...sample, rankings: [{ genreId: "ramen", votes }] }, GENRES), null);
  for (const participantCount of [-1, .5, NaN, Infinity]) assert.equal(resolveGenreResult({ ...sample, participantCount }, GENRES), null);
});

test("0人/0票と内訳なしは安全に表示し、割合をNaNにしない", () => {
  const zero = resolveGenreResult({ ...sample, participantCount: 0, rankings: [{ genreId: "ramen", votes: 0 }] }, GENRES);
  assert.equal(zero.rankings[0].votes, 0);
  assert.equal(getVotePercentage(0, 0), 0);
  assert.equal(getVotePercentage(2, 3), 2 / 3 * 100);
  assert.deepEqual(resolveGenreResult({ ...sample, rankings: [] }, GENRES).rankings, []);
});

for (const scenario of GENRE_RANKING_SCENARIOS) {
  test(`確定順の表示用入力: ${scenario.label}`, () => {
    const input = createMockRankingResult("italian", GENRES, scenario.id), before = structuredClone(input);
    const view = resolveGenreResult(input, GENRES), rows = topGenreRankings(view.rankings);
    assert.equal(view.genre.id, "italian");
    assert.equal(rows.length, scenario.votes.length);
    if (rows.length) assert.equal(rows[0].genre.id, view.genre.id);
    assert.deepEqual(rows.map(row => row.votes), scenario.votes);
    assert.equal(view.decision.likeCount, input.decision.likeCount);
    assert.equal(view.rankingTieBreakApplied, scenario.tieBreakApplied);
    assert.equal(new Set(rows.map(row => row.genre.id)).size, rows.length);
    assert.deepEqual(input, before);
    // 同じ確定データを別インスタンスへ渡しても順序/票は変わらない。バックエンド抽選の実装テストではない。
    assert.deepEqual(resolveGenreResult(JSON.parse(JSON.stringify(input)), GENRES), view);
  });
}
test("未提供の順位を生成せず、決定結果の要約だけを受け取れる", () => {
  const input = createMockRankingResult("cafe", GENRES, "unavailable");
  const view = resolveGenreResult(input, GENRES);
  assert.equal(view.genre.id, "cafe"); assert.deepEqual(view.rankings, []); assert.equal(view.decision.likeCount, 3);
});
test("供給された上位3件に限定し、同票候補の確定順を変えない", () => {
  const input = { ...sample, rankings: GENRES.slice(0, 5).map(genre => ({ genreId: genre.id, votes: 3 })) };
  const view = resolveGenreResult(input, GENRES), rows = topGenreRankings(view.rankings);
  assert.equal(view.rankings.length, 5); assert.equal(rows.length, 3);
  assert.deepEqual(rows.map(row => row.genre.id), input.rankings.slice(0, 3).map(row => row.genreId));
});
test("逆順・決定票数との不一致・不正な抽選フラグを拒否する", () => {
  assert.equal(resolveGenreResult({ ...sample, rankings: [{ genreId: "ramen", votes: 2 }, { genreId: "cafe", votes: 3 }] }, GENRES), null);
  const input = createMockRankingResult("ramen", GENRES, "different");
  assert.equal(resolveGenreResult({ ...input, decision: { ...input.decision, likeCount: 4 } }, GENRES), null);
  assert.equal(resolveGenreResult({ ...input, rankingTieBreakApplied: "true" }, GENRES), null);
});
test("表示のために乱数を呼ばない", t => {
  t.mock.method(Math, "random", () => { throw new Error("表示処理で抽選しない"); });
  for (const scenario of GENRE_RANKING_SCENARIOS) {
    const view = resolveGenreResult(createMockRankingResult("ramen", GENRES, scenario.id), GENRES);
    assert(view); topGenreRankings(view.rankings);
  }
});
