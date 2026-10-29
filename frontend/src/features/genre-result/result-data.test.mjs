import test from "node:test";
import assert from "node:assert/strict";
import { resolveGenreResult, getVotePercentage } from "./result-data.ts";
import { GENRES } from "../genre-vote/genres.ts";

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

test("票数から勝者や同票のルールを推測せず、明示された決定IDを使う", () => {
  const input = { ...sample, decidedGenreId: "cafe", rankings: [{ genreId: "yakiniku", votes: 3 }, { genreId: "ramen", votes: 3 }] };
  const view = resolveGenreResult(input, GENRES);
  assert.equal(view.genre.id, "cafe");
  assert.deepEqual(view.rankings.map((row) => row.genre.id), ["yakiniku", "ramen"]);
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
