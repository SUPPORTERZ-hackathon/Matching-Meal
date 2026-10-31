import test from "node:test";
import assert from "node:assert/strict";
import { isDevelopmentDemo, demoFlowUrl } from "./development-demo.ts";

test("開発環境の明示demoだけを許可し、本番/重複/実ルームへモックを混入させない", () => {
  assert(isDevelopmentDemo("1", "development"));
  for (const environment of ["production", "test", undefined]) assert(!isDevelopmentDemo("1", environment));
  for (const value of [undefined, "0", "true", ["1"], ["1", "1"]]) assert(!isDevelopmentDemo(value, "development"));
  for (const room of ["real-room-id", "", ["real-room-id"]]) assert(!isDevelopmentDemo("1", "development", room));
});

test("ジャンル投票から待機/結果まで明示demoを維持する", () => {
  for (const route of ["/genre-vote", "/genre-vote-waiting", "/genre-result"]) {
    const url = new URL(demoFlowUrl(route), "https://example.test");
    assert.equal(url.pathname, route); assert.equal(url.searchParams.get("demo"), "1");
    assert.equal(url.searchParams.has("room"), false); assert.equal(url.searchParams.has("token"), false);
  }
});
