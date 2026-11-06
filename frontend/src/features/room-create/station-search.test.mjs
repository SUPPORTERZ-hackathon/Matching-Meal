import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeStationQuery, parseStations, searchStations } from "./station-data.ts";

const stations = [
  { id: "1", name: "渋谷", line: "山手線", operator: "東日本旅客鉄道", latitude: 35.658, longitude: 139.7016 },
  { id: "2", name: "渋川", line: "上越線", operator: "東日本旅客鉄道", latitude: 36.49, longitude: 139.0 },
  { id: "3", name: "高渋", line: "テスト線", operator: "テスト鉄道", latitude: 35.0, longitude: 139.0 },
  { id: "4", name: "渋谷", line: "銀座線", operator: "東京地下鉄", latitude: 35.659, longitude: 139.702 },
];

test("駅名をNFKC正規化して前後空白を除去する", () => {
  assert.equal(normalizeStationQuery("  ＪＲ  "), "jr");
});

test("完全一致、前方一致、部分一致の順で最大件数まで返す", () => {
  assert.deepEqual(searchStations(stations, " 渋 ").map((station) => station.id), ["2", "4", "1", "3"]);
  assert.deepEqual(searchStations(stations, "渋谷").map((station) => station.id), ["4", "1"]);
  assert.equal(searchStations(stations, "   ").length, 0);
  assert.equal(searchStations(stations, "渋", 2).length, 2);
});

test("配布データは一意ID、必須文字列、有効な座標、全国規模の件数を要求する", () => {
  const rows = Array.from({ length: 9_000 }, (_, index) => [String(index), `駅${index}`, "路線", "会社", 35, 139]);
  assert.equal(parseStations({ stations: rows }).length, 9_000);
  assert.equal(parseStations({ stations: [...rows, ["0", "重複", "路線", "会社", 35, 139]] }), undefined);
  assert.equal(parseStations({ stations: rows.map((row, index) => index === 0 ? ["0", "駅", "路線", "会社", 91, 139] : row) }), undefined);
  assert.equal(parseStations({ stations: rows.slice(0, 8_999) }), undefined);
});

test("同梱した2025年度全国駅データを検証して検索できる", async () => {
  const document = JSON.parse(await readFile(new URL("../../../public/data/stations-2025.json", import.meta.url), "utf8"));
  const parsed = parseStations(document);
  assert.equal(parsed.length, 10_154);
  assert.equal(document.source.referenceDate, "2025-12-31");
  assert.equal(document.source.license, "CC BY 4.0");
  assert.equal(searchStations(parsed, "稚内")[0].name, "稚内");
  assert.equal(searchStations(parsed, "仙巌園")[0].name, "仙巌園");
});
