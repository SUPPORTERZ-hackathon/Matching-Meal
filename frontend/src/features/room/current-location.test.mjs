import test from "node:test";
import assert from "node:assert/strict";
import { requestCurrentLocation } from "./current-location.ts";

function geolocationWithSuccess(latitude, longitude, capturedOptions) {
  return {
    getCurrentPosition(success, _error, options) {
      capturedOptions.value = options;
      success({ coords: { latitude, longitude } });
    },
  };
}

function geolocationWithError(code) {
  return {
    getCurrentPosition(_success, error) {
      error({ code });
    },
  };
}

test("現在地を一度だけ取得し、有限かつ範囲内の緯度経度だけを返す", async () => {
  const capturedOptions = {};
  const result = await requestCurrentLocation(geolocationWithSuccess(35.658, 139.7016, capturedOptions));
  assert.deepEqual(result, { ok: true, coordinates: { latitude: 35.658, longitude: 139.7016 } });
  assert.deepEqual(capturedOptions.value, { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 });

  for (const [latitude, longitude] of [[Number.NaN, 139], [91, 139], [35, Number.POSITIVE_INFINITY], [35, -181]]) {
    const invalid = await requestCurrentLocation(geolocationWithSuccess(latitude, longitude, {}));
    assert.deepEqual(invalid, { ok: false, code: "invalid_coordinates" });
  }
});

test("未対応・拒否・取得不能・タイムアウトを再試行可能なコードへ分ける", async () => {
  assert.deepEqual(await requestCurrentLocation(undefined), { ok: false, code: "unsupported" });
  assert.deepEqual(await requestCurrentLocation(geolocationWithError(1)), { ok: false, code: "permission_denied" });
  assert.deepEqual(await requestCurrentLocation(geolocationWithError(2)), { ok: false, code: "position_unavailable" });
  assert.deepEqual(await requestCurrentLocation(geolocationWithError(3)), { ok: false, code: "timeout" });
  assert.deepEqual(await requestCurrentLocation(geolocationWithError(99)), { ok: false, code: "position_unavailable" });
});
