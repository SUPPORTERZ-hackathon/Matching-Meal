import test from "node:test";
import assert from "node:assert/strict";
import { GENRES } from "./genres.ts";
import { getGenreImagePath } from "./genre-image.ts";
import { getHomeFeaturedGenres } from "../home-preview/home-food-data.ts";

test("16ジャンルの既存IDに指定の写真URLが対応し、並べ替えても変化しない", () => {
  const expected = {
    ramen: "01-ramen.jpg", "sushi-seafood": "02-sushi-seafood.jpg", yakiniku: "03-yakiniku.jpg",
    "steak-hamburg": "04-steak-hamburg.jpg", curry: "05-curry.jpg", "soba-udon": "06-soba-udon.jpg",
    teishoku: "07-teishoku.jpg", italian: "08-italian.jpg", chinese: "09-chinese.jpg", korean: "10-korean.jpg",
    asian: "11-asian.jpg", hamburger: "12-burger.jpg", "okonomiyaki-takoyaki": "13-okonomiyaki-takoyaki.jpg",
    "nabe-shabushabu": "14-nabe-shabu.jpg", izakaya: "15-izakaya.jpg", cafe: "16-cafe.jpg",
  };
  assert.equal(GENRES.length, Object.keys(expected).length);
  for (const genre of [...GENRES].reverse()) {
    assert.equal(getGenreImagePath(genre), `/images/genres/${expected[genre.id]}`);
  }
});

test("ホームは投票順に依存せず左カフェ・中央ラーメン・右寿司を表示する", () => {
  for (const genres of [GENRES, [...GENRES].reverse()]) {
    const photos = getHomeFeaturedGenres(genres);
    assert.deepEqual(photos.map(({ position, genre }) => [position, genre.id]), [
      ["left", "cafe"], ["center", "ramen"], ["right", "sushi-seafood"],
    ]);
    assert(photos.every(({ genre }) => genres.includes(genre)));
  }
  const missing = getHomeFeaturedGenres(GENRES.filter((genre) => genre.id !== "cafe"));
  assert.equal(missing[0].genre, undefined);
  assert.equal(missing[1].genre.id, "ramen");
});

test("新旧の画像パスを受け入れ、未設定・外部URL・ディレクトリ逸脱は代替表示にする", () => {
  const genre = { id: "ramen", name: "ラーメン" };
  for (const path of ["/images/genres/01-ramen.jpg", "/genres/ramen.webp"]) {
    assert.equal(getGenreImagePath({ ...genre, imagePath: path }), path);
  }
  for (const path of [undefined, "", "https://example.com/ramen.jpg", "//example.com/ramen.jpg", "images/genres/ramen.jpg", "/images/genres/../private.jpg", "/images/genres/..\\private.jpg"]) {
    assert.equal(getGenreImagePath({ ...genre, imagePath: path }), undefined);
  }
  assert.equal(getGenreImagePath(), undefined);
});
