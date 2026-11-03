import test from "node:test";
import assert from "node:assert/strict";
import { cardExitDistance, nextCardPresentation, nextCardShadeOpacity } from "./deck-presentation.ts";
import { GENRES } from "./genres.ts";

test("背面の拡縮.96→1と下8px→0は既存の進捗を維持する", () => {
  const expected = [[0, .96, 8], [.25, .97, 6], [.5, .98, 4], [.75, .99, 2], [1, 1, 0]];
  for (const [progress, scale, offset] of expected) {
    const actual = nextCardPresentation(progress);
    assert(Math.abs(actual.scale - scale) < 1e-12);
    assert.equal(actual.offset, offset);
  }
  assert.deepEqual(nextCardPresentation(-1), nextCardPresentation(0));
  assert.deepEqual(nextCardPresentation(2), nextCardPresentation(1));
  assert.deepEqual(nextCardPresentation(NaN), nextCardPresentation(0));
});

test("明度はカード幅25%まで45%を維持し、その後の距離で徐々に明るくなる", () => {
  const width = 320, exit = 400;
  for (const distance of [0, 32, 80, -32, -80]) assert.equal(nextCardShadeOpacity(distance, width, exit), .45);
  const expected = [[160, .421875], [240, .3375], [320, .196875], [400, 0], [480, 0]];
  for (const [distance, opacity] of expected) {
    assert(Math.abs(nextCardShadeOpacity(distance, width, exit) - opacity) < 1e-12);
    assert.equal(nextCardShadeOpacity(-distance, width, exit), nextCardShadeOpacity(distance, width, exit));
  }
  assert(Math.abs(nextCardShadeOpacity(80.01, width, exit) - .45) < 1e-8);
});

test("終了距離は可視領域と回転したカードの全幅から左右別に計算する", () => {
  const geometry = { cardWidth: 346, cardHeight: 415.2, centerX: 195, clipLeft: 0, clipRight: 390, rotationDegrees: 0 };
  assert.equal(cardExitDistance(geometry, 1), 369);
  assert.equal(cardExitDistance(geometry, -1), 369);
  const rotated = cardExitDistance({ ...geometry, rotationDegrees: 12 }, 1);
  assert(rotated > 408 && rotated < 409);
  assert.equal(rotated, cardExitDistance({ ...geometry, rotationDegrees: 12 }, -1));
  assert.equal(cardExitDistance({ ...geometry, centerX: 205 }, 1), 359);
  assert.equal(cardExitDistance({ ...geometry, centerX: 205 }, -1), 379);
  assert.equal(nextCardShadeOpacity(rotated, geometry.cardWidth, rotated), 0);
});

test("0幅/不正値で明度をNaNにせず、形状を計測できない場合も安全に扱う", () => {
  for (const values of [[0, 0, 400], [NaN, 320, 400], [10, 320, Infinity], [10, 320, 80]]) {
    assert.equal(nextCardShadeOpacity(...values), .45);
  }
  assert.equal(cardExitDistance({ cardWidth: 0, cardHeight: 0, centerX: 0, clipLeft: 0, clipRight: 0, rotationDegrees: 0 }, 1), 0);
});

test("既存IDに指定16文が対応し、写真URLや投票順に依存しない", () => {
  const expected = {
    ramen: "熱々の一杯を楽しもう", "sushi-seafood": "新鮮な海の幸を堪能", yakiniku: "お肉を焼いて楽しもう",
    "steak-hamburg": "肉の旨みを味わおう", curry: "スパイス香る一皿", "soba-udon": "つるっと楽しむ一杯",
    teishoku: "ほっとする定番ごはん", italian: "パスタとピザを満喫", chinese: "アツアツ中華を堪能",
    korean: "旨辛グルメを楽しもう", asian: "異国の味を楽しもう", hamburger: "豪快にかぶりつこう",
    "okonomiyaki-takoyaki": "アツアツ粉ものを満喫", "nabe-shabushabu": "みんなで囲む鍋料理",
    izakaya: "おつまみを囲んで乾杯", cafe: "甘いひとときを楽しもう",
  };
  assert.equal(GENRES.length, Object.keys(expected).length);
  for (const genre of [...GENRES].reverse()) assert.equal(genre.appeal, expected[genre.id]);
});
