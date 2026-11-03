import "./test-runtime.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { state, session, roomId } from "./test-fixtures.mjs";
const { GENRES } = await import("../genre-vote/genres.ts");
const { parseGenreVotingResponse: parse, genreVotingStage, genreVotingUrl, waitingParticipants, resultPresentation, validVotePrefix, normalizeVotingRoomId } = await import("./genre-voting-data.ts");
const { parseGenreDraft, draftKey, saveGenreDraft, loadGenreDraft, clearGenreDraft } = await import("./genre-draft.ts");
const { resolveGenreResult } = await import("../genre-result/result-data.ts");
const votes = GENRES.map(genre => ({ genreId: genre.id, choice: "like" }));

test("R6本人の提出状態からS07/S08/S09を決め、固定人数や名前で推測しない", () => {
  assert.equal(genreVotingStage(parse(state())), "vote");
  const waiting = parse(state({ submitted: true }));
  assert.equal(genreVotingStage(waiting), "waiting");
  assert.deepEqual(waitingParticipants(waiting).map(person => person.state), ["complete", "waiting"]);
  assert.equal(waitingParticipants(waiting)[0].nickname, waitingParticipants(waiting)[1].nickname);
  assert.notEqual(waitingParticipants(waiting)[0].id, waitingParticipants(waiting)[1].id);
  assert.equal(genreVotingStage(parse(state({ submitted: true, complete: true }))), "result");
  const lobby = state(); lobby.data.room.status = "lobby";
  assert.equal(genreVotingStage(parse(lobby)), "lobby");
});
test("R6人数・本人・提出日時・既知ID・roomと結果の矛盾を成功扱いにしない", () => {
  const invalid = [
    data => { data.totalParticipantCount = 3; }, data => { data.submittedParticipantCount = 1; },
    data => { data.currentParticipantId = "missing"; }, data => { data.submitted = true; },
    data => { data.submittedAt = "not-a-date"; }, data => { data.participants[0].submitted = "true"; },
    data => { data.participants[1].id = data.participants[0].id; },
    data => { data.result = { genreId: "cafe", likeCount: 0, decisionMethod: "random_all_skipped", decidedAt: "2026-11-01" }; },
    data => { data.room.status = "restaurant_searching"; },
  ];
  for (const mutate of invalid) { const input = state(); mutate(input.data); assert.equal(parse(input), undefined); }
  for (const change of [{ genreId: "unknown" }, { likeCount: 3 }, { likeCount: -1 }, { decisionMethod: "made_up" }, { decidedAt: "bad" }]) {
    const input = state({ submitted: true, complete: true }); Object.assign(input.data.result, change); assert.equal(parse(input), undefined);
  }
});
test("全skip/同票/単独最多はAPIの決定値をそのまま表示し、全順位を作らない", () => {
  for (const [method, count] of [["random_all_skipped", 0], ["random_tie", 1], ["most_likes", 2]]) {
    const input = parse(state({ submitted: true, complete: true, method, genreId: "italian", count }));
    const result = resultPresentation(input), view = resolveGenreResult(result, GENRES);
    assert.equal(view.genre.name, "イタリアン"); assert.deepEqual(view.rankings, []);
    assert.equal(view.decision.likeCount, count); assert.equal(view.decision.decisionMethod, method);
  }
});
test("UUID付き実画面URLへ正規化し、トークンやdemoを付与しない", () => {
  for (const step of ["vote", "waiting", "result", "lobby"]) {
    const url = new URL(genreVotingUrl(step, roomId), "https://example.test");
    assert.equal(url.searchParams.get("room"), roomId); assert.equal(url.searchParams.has("demo"), false); assert.equal(url.searchParams.has("token"), false);
  }
  for (const input of [undefined, "", "bad", [roomId]]) assert.equal(normalizeVotingRoomId(input), undefined);
  assert.equal(normalizeVotingRoomId(roomId.toUpperCase()), roomId);
});
test("16回答と部分回答のID/choice/順序を検証し、壊れた下書きを復元しない", () => {
  assert(validVotePrefix(votes, true)); assert(validVotePrefix(votes.slice(0, 3)));
  assert(!validVotePrefix(votes.slice(0, 3), true)); assert(!validVotePrefix([...votes].reverse()));
  for (const input of [null, {}, { votes, sealed: "true" }, { votes: [{ genreId: "unknown", choice: "like" }], sealed: false }, { votes: [{ genreId: "ramen", choice: "bad" }], sealed: false }]) assert.equal(parseGenreDraft(input), undefined);
  assert.equal(parseGenreDraft({ votes, sealed: false }).sealed, true);
  assert.equal(parseGenreDraft({ votes: votes.slice(0, 3), sealed: false }).votes.length, 3);
  assert.notEqual(draftKey(session), draftKey({ ...session, participant: { ...session.participant, id: roomId } }));
});
test("ストレージ使用不可でも回答をタブ内メモリに保持し、提出確認後に破棄する", t => {
  Object.defineProperty(globalThis, "window", { configurable: true, value: { get sessionStorage() { throw new Error("test blocked storage"); } } });
  t.after(() => { clearGenreDraft(session); delete globalThis.window; });
  const draft = { votes, sealed: true };
  assert.equal(saveGenreDraft(session, draft), false); assert.deepEqual(loadGenreDraft(session), draft);
  clearGenreDraft(session); assert.deepEqual(loadGenreDraft(session), { votes: [], sealed: false });
});
