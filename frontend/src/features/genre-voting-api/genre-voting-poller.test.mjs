import "./test-runtime.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { guestId, roomId, session, state } from "./test-fixtures.mjs";
const { createGenreVotingPoller, MAX_CONSECUTIVE_INVALID_RESPONSES } = await import("./genre-voting-poller.ts");
const { parseGenreVotingResponse, genreVotingStage, genreVotingUrl } = await import("./genre-voting-data.ts");

const guestSession = { ...session, participant: { id: guestId, nickname: "参加者", role: "member" } };
const error = (code, status = 0) => ({ ok: false, error: { code, status, message: code } });
const ready = snapshot => ({ ok: true, data: snapshot });
const flush = () => new Promise(resolve => setImmediate(resolve));

function snapshot(person, complete = false, version) {
  const raw = state({ submitted: true, complete });
  if (person === "guest") {
    raw.data.currentParticipantId = guestId;
    raw.data.participants[0].submitted = complete;
    raw.data.participants[1].submitted = true;
    raw.data.participants[1].nickname = "参加者";
  }
  if (version !== undefined) raw.data.room.version = version;
  const parsed = parseGenreVotingResponse(raw);
  assert(parsed);
  return parsed;
}

function harness(person, responses, polling = true) {
  const timers = new Map();
  const views = [];
  const identity = person === "host" ? session : guestSession;
  let timerId = 0, hidden = false, calls = 0;
  const poller = createGenreVotingPoller({
    roomId, polling, loadSession: () => identity,
    getState: async () => { const response = responses[calls++]; assert(response, "予期しないR6取得"); return response; },
    isHidden: () => hidden,
    schedule: (callback, delay) => { assert.equal(delay, 2000); const id = ++timerId; timers.set(id, callback); return id; },
    cancel: id => { timers.delete(id); },
    onView: view => { views.push(view); },
  });
  return {
    poller, views, get calls() { return calls; }, get pending() { return timers.size; },
    setHidden: value => { hidden = value; },
    tick: async () => { const [id, callback] = timers.entries().next().value ?? []; assert(callback, "次のポーリングが予約されていない"); timers.delete(id); callback(); await flush(); },
  };
}

for (const last of ["host", "guest"]) {
  test(`2セッション: ${last}が最後に提出しても、先に待つ端末がR6結果からS09へ進む`, async () => {
    const waiting = last === "host" ? "guest" : "host";
    const earlier = harness(waiting, [ready(snapshot(waiting)), ready(snapshot(waiting, true))]);
    const later = harness(last, [ready(snapshot(last, true))]);
    await earlier.poller.refresh(true);
    assert.equal(genreVotingStage(earlier.views.at(-1).snapshot), "waiting");
    await later.poller.refresh(true);
    await earlier.tick();
    for (const client of [earlier, later]) {
      assert.equal(genreVotingStage(client.views.at(-1).snapshot), "result");
      assert.equal(genreVotingUrl("result", roomId), `/genre-result?room=${roomId}`);
      assert.equal(client.views.at(-1).snapshot.result.genreId, "ramen");
      assert.equal(client.pending, 0);
      client.poller.dispose();
    }
  });
}

test("一度のINVALID_RESPONSEは待機表示を保持して再取得し、成功した結果を反映する", async () => {
  const client = harness("guest", [ready(snapshot("guest")), error("INVALID_RESPONSE"), ready(snapshot("guest", true))]);
  await client.poller.refresh(true);
  await client.tick();
  assert.equal(client.views.at(-1).kind, "ready");
  assert.equal(client.views.at(-1).staleError.code, "INVALID_RESPONSE");
  assert.equal(client.pending, 1);
  await client.tick();
  assert.equal(genreVotingStage(client.views.at(-1).snapshot), "result");
  assert.equal(client.pending, 0);
  client.poller.dispose();
});

test("継続する不正応答は有限回で止め、手動再試行で回復できる", async () => {
  const client = harness("guest", [...Array(MAX_CONSECUTIVE_INVALID_RESPONSES)].map(() => error("INVALID_RESPONSE")).concat(ready(snapshot("guest", true))));
  await client.poller.refresh(true);
  for (let index = 1; index < MAX_CONSECUTIVE_INVALID_RESPONSES; index++) await client.tick();
  assert.equal(client.views.at(-1).kind, "error");
  assert.equal(client.pending, 0);
  client.poller.resume();
  assert.equal(client.calls, MAX_CONSECUTIVE_INVALID_RESPONSES);
  client.poller.retry();
  await flush();
  assert.equal(genreVotingStage(client.views.at(-1).snapshot), "result");
  client.poller.dispose();
});

test("400/401/403/404は自動再送せず、通信断は次回取得を続ける", async () => {
  for (const status of [400, 401, 403, 404]) {
    const client = harness("guest", [error("UNAUTHORIZED", status)]);
    await client.poller.refresh(true);
    assert.equal(client.views.at(-1).kind, "error");
    assert.equal(client.pending, 0);
    client.poller.resume();
    assert.equal(client.calls, 1);
    client.poller.dispose();
  }
  const client = harness("guest", [ready(snapshot("guest")), error("NETWORK_ERROR"), ready(snapshot("guest", true))]);
  await client.poller.refresh(true);
  await client.tick();
  assert.equal(client.pending, 1);
  await client.tick();
  assert.equal(genreVotingStage(client.views.at(-1).snapshot), "result");
  client.poller.dispose();
});

test("同一versionでも結果確定は採用し、古い応答へ巻き戻さない", async () => {
  const client = harness("guest", [ready(snapshot("guest", false, 4)), ready(snapshot("guest", true, 4))]);
  await client.poller.refresh(true);
  await client.tick();
  assert.equal(genreVotingStage(client.views.at(-1).snapshot), "result");
  assert.equal(client.pending, 0);
  client.poller.dispose();
  const reordered = harness("guest", [ready(snapshot("guest", false, 4)), ready(snapshot("guest", false, 3)), ready(snapshot("guest", true, 5))]);
  await reordered.poller.refresh(true);
  await reordered.tick();
  assert.equal(reordered.views.at(-1).snapshot.room.version, 4);
  await reordered.tick();
  assert.equal(genreVotingStage(reordered.views.at(-1).snapshot), "result");
  reordered.poller.dispose();
});

test("非表示タブは取得を止め、表示復帰で再取得し、離脱時にタイマーを解放する", async () => {
  const client = harness("guest", [ready(snapshot("guest")), ready(snapshot("guest", true))]);
  await client.poller.refresh(true);
  client.setHidden(true);
  client.poller.resume();
  assert.equal(client.pending, 0);
  client.setHidden(false);
  client.poller.resume();
  await flush();
  assert.equal(genreVotingStage(client.views.at(-1).snapshot), "result");
  client.poller.dispose();
  const reload = harness("guest", [ready(snapshot("guest", true))]);
  await reload.poller.refresh(true);
  assert.equal(genreVotingStage(reload.views.at(-1).snapshot), "result");
  reload.poller.dispose();
});
