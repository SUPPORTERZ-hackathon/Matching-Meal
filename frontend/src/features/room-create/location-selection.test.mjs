import test from "node:test";
import assert from "node:assert/strict";
import {
  clearLocationAfterStationEdit,
  preserveLocationAfterCurrentFailure,
  selectCurrentLocation,
  selectStationLocation,
} from "./location-selection.ts";

const station = {
  id: "station-1",
  name: "渋谷",
  line: "山手線",
  operator: "東日本旅客鉄道",
  latitude: 35.658,
  longitude: 139.7016,
};

test("候補選択で駅を確定し、選択後の入力編集で未確定へ戻す", () => {
  const selected = selectStationLocation(station);
  assert.deepEqual(selected, {
    source: "station",
    coordinates: { latitude: 35.658, longitude: 139.7016 },
    displayName: "渋谷駅",
  });
  assert.equal(clearLocationAfterStationEdit(), null);
});

test("現在地取得成功は駅を置き換え、失敗は既存の駅選択を維持する", () => {
  const selected = selectStationLocation(station);
  assert.equal(preserveLocationAfterCurrentFailure(selected), selected);
  assert.deepEqual(selectCurrentLocation({ latitude: 35.7, longitude: 139.8 }), {
    source: "current",
    coordinates: { latitude: 35.7, longitude: 139.8 },
    displayName: "現在地を使用",
  });
});
