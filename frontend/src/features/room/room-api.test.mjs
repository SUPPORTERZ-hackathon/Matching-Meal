import test from "node:test";
import assert from "node:assert/strict";
import "../genre-voting-api/test-runtime.mjs";

const { createRoom } = await import("./room-api.ts");

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
