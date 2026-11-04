import "../genre-voting-api/test-runtime.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { candidateResponse, session, votingResponse } from "./test-fixtures.mjs";
const { getRestaurantCandidates, searchRestaurantCandidates, submitRestaurantAnswers } = await import("./restaurant-voting-api.ts");

function response(value, status = 200) { return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } }); }

test("候補GETとホスト検索POSTへBearerを付与する", async (t) => {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init }); return response(candidateResponse); };
  t.after(() => { globalThis.fetch = original; });
  assert.equal((await getRestaurantCandidates(session)).ok, true);
  assert.equal((await searchRestaurantCandidates(session)).ok, true);
  assert.equal(calls[0].init.method, "GET");
  assert.equal(calls[1].init.method, "POST");
  assert.equal(calls[0].init.headers.Authorization, `Bearer ${session.sessionToken}`);
  assert(calls[0].url.endsWith(`/${session.room.id}/restaurant-candidates`));
  assert(calls[1].url.endsWith(`/${session.room.id}/restaurant-candidates/search`));
});

test("現在状態を確認して候補全件を一括提出する", async (t) => {
  const calls = [], queue = [votingResponse(), votingResponse({ submitted: true })];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init }); return response(queue.shift()); };
  t.after(() => { globalThis.fetch = original; });
  const candidates = candidateResponse.data.restaurants.map((row) => ({ id: row.id, name: row.name, source: "hotpepper" }));
  const votes = [{ restaurantId: "J001", choice: "like" }, { restaurantId: "J002", choice: "skip" }];
  const result = await submitRestaurantAnswers(session, candidates, votes);
  assert.equal(result.ok, true);
  assert.equal(calls.length, 2);
  assert(calls[0].url.endsWith("/restaurant-voting"));
  assert(calls[1].url.endsWith("/restaurant-votes"));
  assert.deepEqual(JSON.parse(calls[1].init.body), { votes });
});

test("候補不足は通信せず拒否する", async (t) => {
  let called = false;
  const original = globalThis.fetch;
  globalThis.fetch = async () => { called = true; return response({}); };
  t.after(() => { globalThis.fetch = original; });
  const candidates = candidateResponse.data.restaurants.map((row) => ({ id: row.id, name: row.name, source: "hotpepper" }));
  const result = await submitRestaurantAnswers(session, candidates, [{ restaurantId: "J001", choice: "like" }]);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "INVALID_RESTAURANT_VOTES");
  assert.equal(called, false);
});
