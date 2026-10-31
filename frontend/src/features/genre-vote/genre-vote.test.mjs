import test from "node:test";
import assert from "node:assert/strict";
import { GENRES } from "./genres.ts";
import { getGenreImagePath } from "./genre-image.ts";
import { recordGenreVote, undoGenreVote } from "./vote-state.ts";
import { canCommitSwipe, detectAxis, directionOpacity, dragMotion, SWIPE } from "./swipe-config.ts";

test("指定16ジャンルの順序と一意なID、任意のローカル画像パスを検証する", () => {
  assert.deepEqual(GENRES.map((genre) => genre.name), ["ラーメン", "寿司・海鮮", "焼肉", "ステーキ・ハンバーグ", "カレー", "そば・うどん", "定食・食堂", "イタリアン", "中華料理", "韓国料理", "アジア料理", "ハンバーガー", "お好み焼き・たこ焼き", "鍋・しゃぶしゃぶ", "居酒屋料理", "カフェ"]);
  assert.equal(new Set(GENRES.map((genre) => genre.id)).size, GENRES.length);
  assert(GENRES.every((genre) => /^[a-z][a-z0-9-]*$/.test(genre.id)
    && (genre.imagePath === undefined || getGenreImagePath(genre) !== undefined)));
});

test("食べたい/見送りのどちらも記録し、重複・順序違い・完了後を受理しない", () => {
  const untouched = [];
  assert.equal(recordGenreVote(untouched, GENRES, { genreId: GENRES[1].id, choice: "skip" }), untouched);
  let votes = untouched;
  for (const [index, genre] of GENRES.entries()) {
    const next = recordGenreVote(votes, GENRES, { genreId: genre.id, choice: index % 2 ? "skip" : "like" });
    assert.equal(next.length, index + 1);
    assert.equal(votes.length, index);
    votes = next;
    assert.equal(recordGenreVote(votes, GENRES, { genreId: genre.id, choice: "like" }), votes);
  }
  assert.equal(votes.filter((vote) => vote.choice === "like").length, 8);
  assert.equal(votes.filter((vote) => vote.choice === "skip").length, 8);
  assert.equal(recordGenreVote(votes, GENRES, { genreId: "extra", choice: "like" }), votes);
  assert.deepEqual(untouched, []);
  assert.equal(recordGenreVote(untouched, [], { genreId: "ramen", choice: "like" }), untouched);
});

test("微小移動/斜めは未判定、縦を横として扱わない", () => {
  assert.equal(detectAxis(4, 3), "pending");
  assert.equal(detectAxis(40, 40), "pending");
  assert.equal(detectAxis(-20, 4), "horizontal");
  assert.equal(detectAxis(4, 20), "vertical");
});

test("戻るは末尾1件だけを取り消し、元の配列を変更しない", () => {
  const empty = [];
  assert.equal(undoGenreVote(empty), empty);
  const votes = [{ genreId: "ramen", choice: "like" }, { genreId: "sushi-seafood", choice: "skip" }];
  const previous = undoGenreVote(votes);
  assert.deepEqual(previous, [votes[0]]);
  assert.equal(votes.length, 2);
  assert.deepEqual(undoGenreVote(previous), []);
});

test("取り消したジャンルを別の選択で再投票でき、完了後も最後だけを戻せる", () => {
  let votes = recordGenreVote([], GENRES, { genreId: "ramen", choice: "like" });
  votes = undoGenreVote(votes);
  votes = recordGenreVote(votes, GENRES, { genreId: "ramen", choice: "skip" });
  assert.deepEqual(votes, [{ genreId: "ramen", choice: "skip" }]);
  for (const genre of GENRES.slice(1)) votes = recordGenreVote(votes, GENRES, { genreId: genre.id, choice: "like" });
  const previous = undoGenreVote(votes);
  assert.equal(previous.length, GENRES.length - 1);
  assert(!previous.some((vote) => vote.genreId === "cafe"));
  const completed = recordGenreVote(previous, GENRES, { genreId: "cafe", choice: "skip" });
  assert.equal(new Set(completed.map((vote) => vote.genreId)).size, GENRES.length);
  assert.equal(completed.at(-1).choice, "skip");
});

test("実カード幅25%の境界を両方向で判定し、縦優勢と幅0を拒否する", () => {
  for (const width of [276, 331, 346, 386]) {
    const threshold = width * SWIPE.commitWidthRatio;
    assert.equal(canCommitSwipe(threshold - .01, 0, width), false);
    assert.equal(canCommitSwipe(threshold, 0, width), true);
    assert.equal(canCommitSwipe(-threshold, 0, width), true);
    assert.equal(canCommitSwipe(threshold, threshold, width), false);
  }
  assert.equal(canCommitSwipe(300, 0, 0), false);
});

test("透明度は実カード幅に比例し、回転と縦追従は上限内に収まる", () => {
  assert.equal(directionOpacity(0, 320), 0);
  assert.equal(directionOpacity(20, 320), .25);
  assert.equal(directionOpacity(-40, 320), .5);
  assert.equal(directionOpacity(80, 320), 1);
  assert.equal(directionOpacity(800, 320), 1);
  assert.equal(directionOpacity(100, 0), 0);
  assert.deepEqual(dragMotion(1000, 1000, 320, false), { x: 1000, y: 22, rotation: 12 });
  assert.deepEqual(dragMotion(-1000, -1000, 320, false), { x: -1000, y: -22, rotation: -12 });
  assert.equal(dragMotion(160, 0, 320, true).rotation, 0);
});
