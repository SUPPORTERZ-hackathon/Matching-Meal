import test from "node:test";
import assert from "node:assert/strict";
import { GENRES } from "../genre-vote/genres.ts";
import { getCarouselSlot, getCarouselSwipeStep, getHomeCarouselGenres } from "./home-food-data.ts";

test("ホーム5枚は既存IDから取得し、初期の左・中央・右を維持する", () => {
  for (const source of [GENRES, [...GENRES].reverse()]) {
    const genres = getHomeCarouselGenres(source);
    assert.deepEqual(genres.map((genre) => genre?.id), ["cafe", "ramen", "sushi-seafood", "yakiniku", "italian"]);
    assert.deepEqual(genres.map((_, index) => getCarouselSlot(index, 1, genres.length)), [-1, 0, 1, 2, -2]);
  }
});

test("横スワイプだけが切り替わり、タップ・縦移動・斜め移動では切り替わらない", () => {
  assert.equal(getCarouselSwipeStep(-80, 8), 1);
  assert.equal(getCarouselSwipeStep(80, 8), -1);
  assert.equal(getCarouselSwipeStep(10, 0), 0);
  assert.equal(getCarouselSwipeStep(10, 80), 0);
  assert.equal(getCarouselSwipeStep(70, 70), 0);
});

test("前後に循環しても中央と周辺の位置が重複しない", () => {
  for (let active = 0; active < 5; active += 1) {
    assert.deepEqual([0, 1, 2, 3, 4].map((index) => getCarouselSlot(index, active, 5)).sort((a, b) => a - b), [-2, -1, 0, 1, 2]);
  }
});
