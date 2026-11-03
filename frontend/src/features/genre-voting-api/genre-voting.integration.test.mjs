import "./test-runtime.mjs";
import test from "node:test";
import assert from "node:assert/strict";
const { GENRES } = await import("../genre-vote/genres.ts");
const { getGenreVoting, submitGenreAnswers } = await import("./genre-voting-api.ts");
const { parseGenreVotingResponse } = await import("./genre-voting-data.ts");
const base = process.env.GENRE_VOTING_API_BASE;
const enabled = base === "http://localhost:3000";

// 明示したローカル開発環境だけで実行し、このテストが作成したルーム以外を操作しない。
async function makeRoom(http) {
  const create = await http(`${base}/api/v1/rooms`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nickname: "API結合確認ホスト" }) });
  assert.equal(create.status, 201); const host = (await create.json()).data;
  const join = await http(`${base}/api/v1/rooms/${host.room.joinCode}/participants`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nickname: "API結合確認ゲスト" }) });
  assert.equal(join.status, 201); const guest = (await join.json()).data;
  const start = await http(`${base}/api/v1/rooms/${host.room.id}/genre-voting/start`, { method: "POST", headers: { Authorization: `Bearer ${host.sessionToken}` } });
  assert.equal(start.status, 200); await start.json(); return { host, guest };
}
function relativeFetch(t) {
  const original = globalThis.fetch.bind(globalThis);
  t.mock.method(globalThis, "fetch", (path, options) => original(new URL(path, base), options));
  return original;
}
const answers = favorite => GENRES.map(genre => ({ genreId: genre.id, choice: favorite.includes(genre.id) ? "like" : "skip" }));

test("実API: 2人の提出・1/2待機・同一結果・同一再送・異内容409・認証拒否", { skip: !enabled }, async t => {
  const http = relativeFetch(t), { host, guest } = await makeRoom(http);
  const hostVotes = answers(["ramen", "italian"]), guestVotes = answers(["italian"]);
  const first = await submitGenreAnswers(host, hostVotes); assert(first.ok); assert.equal(first.data.submittedParticipantCount, 1); assert.equal(first.data.result, null);
  const beforeGuest = await getGenreVoting(guest); assert(beforeGuest.ok); assert.equal(beforeGuest.data.submitted, false); assert.equal(beforeGuest.data.participants.filter(person => person.submitted).length, 1);
  const last = await submitGenreAnswers(guest, guestVotes); assert(last.ok); assert.equal(last.data.room.status, "restaurant_searching");
  const [a, b] = await Promise.all([getGenreVoting(host), getGenreVoting(guest)]); assert(a.ok && b.ok);
  assert.deepEqual(a.data.result, b.data.result); assert.equal(a.data.result.genreId, "italian"); assert.equal(a.data.result.likeCount, 2); assert.equal(a.data.result.decisionMethod, "most_likes");
  const path = `${base}/api/v1/rooms/${host.room.id}/genre-votes`;
  const headers = { Authorization: `Bearer ${host.sessionToken}`, "Content-Type": "application/json" };
  const again = await http(path, { method: "PUT", headers, body: JSON.stringify({ votes: hostVotes }) }); assert.equal(again.status, 200);
  const repeated = parseGenreVotingResponse(await again.json()); assert.equal(repeated.room.version, a.data.room.version); assert.equal(repeated.submittedAt, a.data.submittedAt); assert.deepEqual(repeated.result, a.data.result);
  const changed = await http(path, { method: "PUT", headers, body: JSON.stringify({ votes: guestVotes }) }); assert.equal(changed.status, 409); assert.equal((await changed.json()).error.code, "VOTE_ALREADY_SUBMITTED");
  const unauth = await http(`${base}/api/v1/rooms/${host.room.id}/genre-voting`); assert.equal(unauth.status, 401); await unauth.json();
  const after = await getGenreVoting(host); assert(after.ok); assert.deepEqual(after.data.result, a.data.result);
});
test("実API: 同時提出・同票はサーバー抽選の同じ確定値を取得する", { skip: !enabled }, async t => {
  const { host, guest } = await makeRoom(relativeFetch(t)); const votes = answers(["ramen", "cafe"]);
  const responses = await Promise.all([submitGenreAnswers(host, votes), submitGenreAnswers(guest, votes)]); assert(responses.every(response => response.ok));
  const a = await getGenreVoting(host), b = await getGenreVoting(guest); assert(a.ok && b.ok); assert.deepEqual(a.data.result, b.data.result);
  assert.equal(a.data.result.decisionMethod, "random_tie"); assert.equal(a.data.result.likeCount, 2); assert(["ramen", "cafe"].includes(a.data.result.genreId));
});
test("実API: 全員skipでも全員が同じ永続化された決定ジャンルを見る", { skip: !enabled }, async t => {
  const { host, guest } = await makeRoom(relativeFetch(t)); const votes = answers([]);
  assert((await submitGenreAnswers(host, votes)).ok); assert((await submitGenreAnswers(guest, votes)).ok);
  const a = await getGenreVoting(host), b = await getGenreVoting(guest); assert(a.ok && b.ok); assert.deepEqual(a.data.result, b.data.result);
  assert.equal(a.data.result.likeCount, 0); assert.equal(a.data.result.decisionMethod, "random_all_skipped"); assert(GENRES.some(genre => genre.id === a.data.result.genreId));
});
