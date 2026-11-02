import "./test-runtime.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { state, session, guestId } from "./test-fixtures.mjs";
const { GENRES } = await import("../genre-vote/genres.ts");
const { getGenreVoting, submitGenreAnswers } = await import("./genre-voting-api.ts");
const votes = GENRES.map(genre => ({ genreId: genre.id, choice: "like" }));
function fetchQueue(t, responses) {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url, ...options });
    const next = responses.shift();
    if (next instanceof Error) throw next;
    assert(next, "予期しない追加通信をしない");
    return new Response(JSON.stringify(next.body ?? next), { status: next.status ?? 200, headers: { "Content-Type": "application/json" } });
  });
  return calls;
}
test("R6確認後に16回答を一括PUTし、Bearer/no-storeとID/choiceを保持する", async t => {
  const before = structuredClone(votes), calls = fetchQueue(t, [state(), state({ submitted: true })]);
  const response = await submitGenreAnswers(session, votes);
  assert(response.ok); assert.equal(calls.length, 2); assert.equal(calls[0].method, "GET"); assert.equal(calls[1].method, "PUT");
  assert(calls[1].url.endsWith("/genre-votes")); assert.equal(calls[1].headers.Authorization, `Bearer ${session.sessionToken}`);
  assert.equal(calls[1].cache, "no-store"); assert.deepEqual(JSON.parse(calls[1].body).votes, before); assert.deepEqual(votes, before);
});
test("提出済みならPUTせず待機/結果へ復帰する", async t => {
  const calls = fetchQueue(t, [state({ submitted: true, complete: true })]);
  const response = await submitGenreAnswers(session, votes); assert(response.ok); assert(response.data.result); assert.equal(calls.length, 1);
});
test("応答消失後にR6で保存を確認できれば、二重PUTせず復帰する", async t => {
  const calls = fetchQueue(t, [state(), new TypeError("test offline"), state({ submitted: true })]);
  const response = await submitGenreAnswers(session, votes); assert(response.ok); assert.equal(calls.filter(call => call.method === "PUT").length, 1);
});
test("409競合の後はサーバーの提出済み状態を優先する", async t => {
  const calls = fetchQueue(t, [state(), { status: 409, body: { error: { code: "VOTE_ALREADY_SUBMITTED", message: "提出済み" } } }, state({ submitted: true })]);
  assert((await submitGenreAnswers(session, votes)).ok); assert.equal(calls.length, 3);
});
test("503で未保存ならエラーと元の回答を保ち、明示再試行で同一内容を送る", async t => {
  const calls = fetchQueue(t, [state(), { status: 503, body: { error: { code: "SERVICE_UNAVAILABLE", message: "再試行" } } }, state(), state(), state({ submitted: true })]);
  const first = await submitGenreAnswers(session, votes); assert(!first.ok); assert.equal(first.error.status, 503);
  assert((await submitGenreAnswers(session, votes)).ok);
  const puts = calls.filter(call => call.method === "PUT"); assert.equal(puts.length, 2); assert.equal(puts[0].body, puts[1].body);
});
test("401/403/404を保持して自動PUTせず、偽の成功を表示しない", async t => {
  for (const status of [401, 403, 404]) {
    const calls = fetchQueue(t, [{ status, body: { error: { code: "AUTH_TEST", message: "確認してください" } } }]);
    const response = await submitGenreAnswers(session, votes); assert(!response.ok); assert.equal(response.error.status, status); assert.equal(calls.length, 1);
  }
});
test("未知ルーム/別参加者・不正応答・部分提出を拒否する", async t => {
  const other = state(); other.data.room.joinCode = "23456789";
  const guest = state(); guest.data.currentParticipantId = guestId;
  fetchQueue(t, [other, guest, { invalid: true }]);
  assert(!(await getGenreVoting(session)).ok); assert(!(await getGenreVoting(session)).ok); assert(!(await getGenreVoting(session)).ok);
  assert(!(await submitGenreAnswers(session, votes.slice(0, 15))).ok);
});
test("離脱時のAbortSignalを通信へ伝え、キャンセルを成功扱いにしない", async t => {
  const controller = new AbortController(); controller.abort();
  t.mock.method(globalThis, "fetch", async (_url, options) => { assert(options.signal.aborted); throw new DOMException("test cancelled", "AbortError"); });
  const result = await getGenreVoting(session, controller.signal);
  assert(!result.ok); assert.equal(result.error.code, "CANCELLED");
});
