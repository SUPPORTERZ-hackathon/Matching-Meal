import test from "node:test";
import assert from "node:assert/strict";
import "../genre-voting-api/test-runtime.mjs";

const { createRoom, joinRoom, getRoomState } = await import("./room-api.ts");
const { requestCurrentLocation } = await import("./current-location.ts");

test.beforeEach(t => {
  const values = new Map(), previous = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: {
    getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key),
  } });
  t.after(() => { if (previous) Object.defineProperty(globalThis, "sessionStorage", previous); else delete globalThis.sessionStorage; });
});

const sessionResponse = {
  data: {
    room: {
      id: "550e8400-e29b-41d4-a716-446655440000",
      joinCode: "7K9M2QXR",
      status: "lobby",
      version: 1,
      expiresAt: "2026-11-04T12:00:00Z",
    },
    participant: {
      id: "8d5b0ad5-e8c6-47f2-8e87-f6180b175759",
      nickname: "ひかる",
      role: "host",
    },
    sessionToken: "test-session-token",
  },
};

test("ルーム作成は現在地とAPI値1〜5の検索範囲を送る", async (t) => {
  let capturedRequest;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path, init) => {
    capturedRequest = { path, init };
    return new Response(JSON.stringify(sessionResponse), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const result = await createRoom({
    nickname: " ひかる ",
    searchLocation: { latitude: 35.658, longitude: 139.7016 },
    searchRange: 3,
  });
  assert.equal(result.ok, true);
  assert.equal(capturedRequest.path, "/api/v1/rooms");
  assert.equal(capturedRequest.init.method, "POST");
  assert.match(capturedRequest.init.headers["Idempotency-Key"], /^[a-f0-9-]{36}$/);
  assert.deepEqual(JSON.parse(capturedRequest.init.body), {
    nickname: "ひかる",
    searchLocation: { latitude: 35.658, longitude: 139.7016 },
    searchRange: 3,
  });
});

test("不正な現在地または検索範囲は通信前に拒否する", async (t) => {
  let fetchCount = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { fetchCount += 1; throw new Error("unexpected fetch"); };
  t.after(() => { globalThis.fetch = originalFetch; });

  for (const input of [
    { nickname: "ひかる", searchLocation: { latitude: 91, longitude: 139 }, searchRange: 3 },
    { nickname: "ひかる", searchLocation: { latitude: 35, longitude: Number.NaN }, searchRange: 3 },
    { nickname: "ひかる", searchLocation: { latitude: 35, longitude: 139 }, searchRange: 0 },
  ]) {
    const result = await createRoom(input);
    assert.equal(result.ok, false);
    assert.equal(result.error.code, "INVALID_REQUEST");
  }
  assert.equal(fetchCount, 0);
});

const createInput = nickname => ({ nickname, searchLocation: { latitude: 1, longitude: 2 }, searchRange: 3 });
function reply(data = sessionResponse, status = 201) { return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } }); }

test("応答消失・503・不正応答でも同じキーで再試行し、成功後の別操作で更新する", async t => {
  const calls = [];
  let attempt = 0;
  t.mock.method(globalThis, "fetch", async (path, init) => {
    calls.push({ path, init }); attempt++;
    if (attempt === 1) throw new Error("response lost");
    if (attempt === 2) return reply({ error: { code: "SERVICE_UNAVAILABLE", message: "利用できません" } }, 503);
    if (attempt === 3) return reply({ data: {} });
    return reply();
  });
  const input = createInput("retry-host");
  assert.equal((await createRoom(input)).error.code, "NETWORK_ERROR");
  assert.equal((await createRoom(input)).error.status, 503);
  assert.equal((await createRoom(input)).error.code, "INVALID_RESPONSE");
  assert((await createRoom(input)).ok);
  assert.equal(new Set(calls.map(call => call.init.headers["Idempotency-Key"])).size, 1);
  await createRoom(input);
  assert.notEqual(calls[4].init.headers["Idempotency-Key"], calls[0].init.headers["Idempotency-Key"]);
  assert(calls.every(call => call.init.headers["Idempotency-Key"]));
});

test("参加の同一コード・正規化済み名前の再試行でキーを維持する", async t => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (path, init) => {
    calls.push({ path, init });
    if (calls.length === 1) throw new Error("offline");
    return reply({ data: { ...sessionResponse.data, participant: { ...sessionResponse.data.participant, role: "member" } } });
  });
  assert(!(await joinRoom("7k9m2qxr", " retry-guest ")).ok);
  assert((await joinRoom("7K9M2QXR", "retry-guest")).ok);
  assert.equal(calls[0].init.headers["Idempotency-Key"], calls[1].init.headers["Idempotency-Key"]);
  assert.deepEqual(JSON.parse(calls[1].init.body), { nickname: "retry-guest" });
});

test("現在地の標準取得成功後も、取得値と範囲をそのまま作成へ渡す", async t => {
  let geoCalls = 0, sent;
  const located = await requestCurrentLocation({ getCurrentPosition(success, error) {
    if (++geoCalls === 1) error({ code: 3 }); else success({ coords: { latitude: 1, longitude: 2 } });
  } });
  assert(located.ok);
  t.mock.method(globalThis, "fetch", async (_path, init) => { sent = JSON.parse(init.body); return reply(); });
  assert((await createRoom({ nickname: "gps-host", searchLocation: located.coordinates, searchRange: 5 })).ok);
  assert.deepEqual(sent, { nickname: "gps-host", searchLocation: { latitude: 1, longitude: 2 }, searchRange: 5 });
});

test("操作キーを保存できなければPOSTせず、GETには冪等キーを付けない", async t => {
  let calls = 0, headers;
  t.mock.method(globalThis.sessionStorage, "setItem", () => { throw new Error("blocked"); });
  t.mock.method(globalThis, "fetch", async (_path, init) => { calls++; headers = init.headers; return reply({ error: { code: "UNAUTHORIZED", message: "確認してください" } }, 401); });
  assert.equal((await createRoom(createInput("no-storage"))).error.code, "REQUEST_KEY_UNAVAILABLE");
  assert.equal(calls, 0);
  const response = await getRoomState(sessionResponse.data);
  assert.equal(response.error.status, 401);
  assert.equal(headers["Idempotency-Key"], undefined);
  assert.equal(headers.Authorization, "Bearer test-session-token");
});

test("ルームの認証拒否・期限切れ・不正IDを成功応答として扱わない", async t => {
  for (const [status, code] of [[401, "UNAUTHORIZED"], [403, "FORBIDDEN"], [404, "ROOM_NOT_FOUND"]]) {
    t.mock.method(globalThis, "fetch", async () => reply({ error: { code, message: "ルームを確認してください" } }, status));
    const result = await getRoomState(sessionResponse.data);
    assert.equal(result.ok, false); assert.equal(result.error.code, code);
  }
  const result = await getRoomState({ ...sessionResponse.data, room: { ...sessionResponse.data.room, id: "invalid" } });
  assert.equal(result.ok, false); assert.equal(result.error.code, "INVALID_RESPONSE");
});

test("同じ作成操作の並行呼出しを1回のPOSTにまとめる", async t => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; return reply(); });
  const input = createInput("double-host");
  const [first, second] = await Promise.all([createRoom(input), createRoom(structuredClone(input))]);
  assert(first.ok && second.ok); assert.deepEqual(first, second); assert.equal(calls, 1);
});
