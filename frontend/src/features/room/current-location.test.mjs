import test from "node:test";
import assert from "node:assert/strict";
import { requestCurrentLocation, LOCATION_OPTIONS } from "./current-location.ts";

const point = { latitude: 35.658, longitude: 139.7016 }; // 合成テスト座標。実端末の位置は取得しない。
function scripted(outcomes) {
  const calls = [];
  return { calls, geolocation: { getCurrentPosition(success, error, options) {
    calls.push({ ...options });
    const outcome = outcomes.shift();
    if (typeof outcome === "number") error({ code: outcome });
    else if (outcome instanceof Error) throw outcome;
    else success({ coords: outcome });
  } } };
}

test("高精度取得で妥当な座標を返し、不正座標を補完しない", async () => {
  const provider = scripted([point]), modes = [];
  assert.deepEqual(await requestCurrentLocation(provider.geolocation, { onMode: mode => modes.push(mode) }), { ok: true, coordinates: point, mode: "high" });
  assert.deepEqual(provider.calls, [{ enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }]);
  assert.deepEqual(modes, ["high"]);
  for (const coords of [{ latitude: NaN, longitude: 1 }, { latitude: 91, longitude: 1 }, { latitude: 1, longitude: Infinity }, { latitude: 1, longitude: -181 }]) {
    const invalid = scripted([coords]);
    assert.deepEqual(await requestCurrentLocation(invalid.geolocation), { ok: false, code: "invalid_coordinates" });
    assert.equal(invalid.calls.length, 1);
  }
  assert.equal((await requestCurrentLocation(scripted([{ latitude: 0, longitude: 0 }]).geolocation)).ok, true);
});

test("拒否・未対応・安全でない接続ではフォールバックしない", async () => {
  assert.deepEqual(await requestCurrentLocation(undefined), { ok: false, code: "unsupported" });
  const denied = scripted([1]);
  assert.deepEqual(await requestCurrentLocation(denied.geolocation), { ok: false, code: "permission_denied" });
  assert.equal(denied.calls.length, 1);
  const insecure = scripted([point]);
  assert.deepEqual(await requestCurrentLocation(insecure.geolocation, { secureContext: false }), { ok: false, code: "insecure_context" });
  assert.equal(insecure.calls.length, 0);
});

for (const firstError of [2, 3]) test("取得エラー" + firstError + "から標準モードへ1回だけ切り替える", async () => {
  const provider = scripted([firstError, point]), modes = [];
  const result = await requestCurrentLocation(provider.geolocation, { onMode: mode => modes.push(mode) });
  assert.deepEqual(result, { ok: true, coordinates: point, mode: "standard" });
  assert.deepEqual(provider.calls, [LOCATION_OPTIONS.high, { enableHighAccuracy: false, maximumAge: 60000, timeout: 20000 }]);
  assert.deepEqual(modes, ["high", "standard"]);
});

test("両モードの失敗を区別し、失敗後も再試行できる", async () => {
  for (const [secondError, code] of [[1, "permission_denied"], [2, "position_unavailable"], [3, "timeout"], [99, "position_unavailable"]]) {
    const provider = scripted([3, secondError]);
    assert.deepEqual(await requestCurrentLocation(provider.geolocation), { ok: false, code });
    assert.equal(provider.calls.length, 2);
  }
  const provider = scripted([3, 3, point]);
  assert.equal((await requestCurrentLocation(provider.geolocation)).code, "timeout");
  assert.equal((await requestCurrentLocation(provider.geolocation)).ok, true);
  const broken = scripted([new Error("provider failed"), new Error("provider failed")]);
  assert.deepEqual(await requestCurrentLocation(broken.geolocation), { ok: false, code: "position_unavailable" });
});

test("離脱時に後着の成功/失敗を無視し、次の取得を開始しない", async () => {
  const controller = new AbortController(), modes = [];
  let calls = 0, success, failure;
  const pending = requestCurrentLocation({ getCurrentPosition(ok, error) { calls++; success = ok; failure = error; } }, { signal: controller.signal, onMode: mode => modes.push(mode) });
  controller.abort();
  assert.deepEqual(await pending, { ok: false, code: "cancelled" });
  failure({ code: 3 }); success({ coords: point });
  assert.equal(calls, 1); assert.deepEqual(modes, ["high"]);
  assert.deepEqual(await requestCurrentLocation(scripted([point]).geolocation, { signal: controller.signal }), { ok: false, code: "cancelled" });
});
