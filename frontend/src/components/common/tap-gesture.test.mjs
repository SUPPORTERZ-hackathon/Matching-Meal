import test from "node:test";
import assert from "node:assert/strict";
import { shouldEmitTap } from "./tap-gesture.ts";

const tap = { dx: 0, dy: 0, elapsedMs: 100, sinceScrollMs: 300, sinceBurstMs: 300, scrollChanged: false, reducedMotion: false, activeBursts: 0 };

test("短い通常タップだけ粒子を発生させる", () => {
  assert.equal(shouldEmitTap(tap), true);
  assert.equal(shouldEmitTap({ ...tap, dx: 10 }), false);
  assert.equal(shouldEmitTap({ ...tap, dy: 40 }), false);
  assert.equal(shouldEmitTap({ ...tap, elapsedMs: 501 }), false);
});

test("スクロール・連打・上限・reduced motionでは発生させない", () => {
  assert.equal(shouldEmitTap({ ...tap, sinceScrollMs: 20 }), false);
  assert.equal(shouldEmitTap({ ...tap, scrollChanged: true }), false);
  assert.equal(shouldEmitTap({ ...tap, sinceBurstMs: 30 }), false);
  assert.equal(shouldEmitTap({ ...tap, activeBursts: 6 }), false);
  assert.equal(shouldEmitTap({ ...tap, reducedMotion: true }), false);
});
