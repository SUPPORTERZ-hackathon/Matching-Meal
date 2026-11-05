import "../genre-voting-api/test-runtime.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createRestaurantCandidateLoader } from "./restaurant-candidate-loader.ts";
import { session } from "./test-fixtures.mjs";

const pending = { ok: false, error: { code: "RESTAURANT_CANDIDATES_NOT_READY", status: 409, message: "準備中" } };
const failed = { ok: false, error: { code: "RESTAURANT_SEARCH_FAILED", status: 502, message: "検索サービスから取得できません" } };
const ready = { ok: true, data: { restaurants: [{ id: "J001" }] } };

test("初回POST失敗後のpoll/focus相当やeffect再実行ではGETだけを行う", async () => {
  let gets = 0, posts = 0;
  const loader = createRestaurantCandidateLoader(async () => { gets++; return pending; }, async () => { posts++; return failed; });
  assert.deepEqual(await loader.load(session, "initial"), failed);
  for (const reason of ["read", "read", "initial", "read"]) assert.deepEqual(await loader.load(session, reason), failed);
  assert.equal(gets, 5); assert.equal(posts, 1);
  assert.deepEqual(await loader.load(session, "retry"), failed);
  assert.equal(posts, 2);
});

test("保存済み候補があれば明示再試行でもPOSTせず、ゲストは常にGETだけ", async () => {
  let posts = 0;
  const loader = createRestaurantCandidateLoader(async () => ready, async () => { posts++; return ready; });
  assert.deepEqual(await loader.load(session, "retry"), ready);
  const guest = { ...session, participant: { ...session.participant, role: "member" } };
  const waiting = createRestaurantCandidateLoader(async () => pending, async () => { posts++; return ready; });
  for (const reason of ["initial", "read", "retry"]) assert.deepEqual(await waiting.load(guest, reason), pending);
  assert.equal(posts, 0);
});

test("並行初回取得で二重POSTせず、キャンセル後も自動再送しない", async () => {
  let posts = 0, finish;
  const loader = createRestaurantCandidateLoader(async () => pending, () => { posts++; return new Promise(resolve => { finish = resolve; }); });
  const first = loader.load(session, "initial");
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(await loader.load(session, "initial"), pending);
  assert.deepEqual(await loader.load(session, "retry"), pending);
  assert.equal(posts, 1);
  finish({ ok: false, error: { code: "CANCELLED", status: 0, message: "cancelled" } }); await first;
  assert.equal((await loader.load(session, "read")).error.code, "RESTAURANT_SEARCH_UNCONFIRMED");
  assert.equal(posts, 1);
  const controller = new AbortController(); controller.abort();
  await loader.load(session, "retry", controller.signal); assert.equal(posts, 1);
});

test("認証/期限切れ等のGETエラーで検索を始めず、別タブの保存済み候補へ回復する", async () => {
  let next = pending, posts = 0;
  const loader = createRestaurantCandidateLoader(async () => next, async () => { posts++; return failed; });
  for (const status of [400, 401, 403, 404, 500]) {
    next = { ok: false, error: { code: "OTHER_ERROR", status, message: "確認してください" } };
    assert.deepEqual(await loader.load(session, "initial"), next);
  }
  next = pending; await loader.load(session, "initial"); assert.equal(posts, 1);
  next = ready; assert.deepEqual(await loader.load(session, "read"), ready); assert.equal(posts, 1);
});
