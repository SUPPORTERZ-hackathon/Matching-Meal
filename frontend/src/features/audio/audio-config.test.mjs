import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { AUDIO_TRACKS, AUDIO_MAX_FAILURES, RESULT_SE_TRACKS, isPlaybackBlocked, maxFailuresFor } from "./audio-config.ts";

test("店舗投票とジャンル投票は別の音源を参照し、結果BGMは存在しない", () => {
  assert.equal(AUDIO_TRACKS["genre-vote"].src, "/audio/genre-vote.mp3");
  assert.equal(AUDIO_TRACKS["restaurant-vote"].src, "/audio/restaurant-vote.mp3");
  assert.notEqual(AUDIO_TRACKS["genre-vote"].src, AUDIO_TRACKS["restaurant-vote"].src);
  assert.equal(Object.keys(AUDIO_TRACKS).length, 6);
  assert.equal(AUDIO_TRACKS["restaurant-decide"].src, "/audio/restaurant-decide.m4a");
  assert.equal(Object.values(AUDIO_TRACKS).filter((track) => track.kind === "bgm").length, 1);
  assert.deepEqual(RESULT_SE_TRACKS, ["genre-result", "restaurant-decide"]);
});

test("BGMの初期音量はすべてのSEより小さい", () => {
  const bgm = Object.values(AUDIO_TRACKS).filter((track) => track.kind === "bgm");
  const se = Object.values(AUDIO_TRACKS).filter((track) => track.kind === "se");
  assert.ok(bgm.every((track) => track.volume > 0 && track.volume <= 1));
  assert.ok(se.every((track) => track.volume > bgm[0].volume && track.volume <= 1));
  assert.ok(AUDIO_TRACKS["restaurant-decide"].volume > AUDIO_TRACKS["genre-vote"].volume);
});

test("再生許可と音源失敗を区別する", () => {
  assert.equal(isPlaybackBlocked(new DOMException("blocked", "NotAllowedError")), true);
  assert.equal(isPlaybackBlocked(new DOMException("source", "NotSupportedError")), false);
  assert.equal(AUDIO_MAX_FAILURES, 2);
  assert.equal(maxFailuresFor("restaurant-vote"), 1);
  assert.equal(maxFailuresFor("genre-vote"), 2);
});

test("決定SEは元の音声内容を変えずM4Aとして配信する", async () => {
  const original = await readFile(new URL("../../../public/audio/restaurant-decide.mp3", import.meta.url));
  const playable = await readFile(new URL("../../../public/audio/restaurant-decide.m4a", import.meta.url));
  assert.deepEqual(playable, original);
  assert.equal(playable.toString("ascii", 4, 8), "ftyp");
});
