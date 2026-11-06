import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const SOURCE_URL = "https://nlftp.mlit.go.jp/ksj/gml/data/N02/N02-25/N02-25_GML.zip";
const SOURCE_PAGE_URL = "https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N02-2025.html";
const REFERENCE_DATE = "2025-12-31";
const RETRIEVED_DATE = "2026-11-06";
const OUTPUT_PATH = resolve("public/data/stations-2025.json");

const sourcePath = process.argv[2];
if (!sourcePath) {
  throw new Error("Usage: npm run data:stations -- <N02-25_Station.geojson>");
}

function requiredString(value, field, index) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`feature ${index}: ${field} is required`);
  }
  return value.trim();
}

function validCoordinate(value) {
  return Array.isArray(value)
    && value.length >= 2
    && Number.isFinite(value[0])
    && value[0] >= -180
    && value[0] <= 180
    && Number.isFinite(value[1])
    && value[1] >= -90
    && value[1] <= 90;
}

function midpoint(segments) {
  const lengths = segments.map(([start, end]) => Math.hypot(end[0] - start[0], end[1] - start[1]));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  if (total === 0) return segments[0][0];
  let remaining = total / 2;
  for (let index = 0; index < segments.length; index += 1) {
    const length = lengths[index];
    if (remaining <= length) {
      const [start, end] = segments[index];
      const ratio = length === 0 ? 0 : remaining / length;
      return [start[0] + ((end[0] - start[0]) * ratio), start[1] + ((end[1] - start[1]) * ratio)];
    }
    remaining -= length;
  }
  return segments.at(-1)[1];
}

const raw = JSON.parse(await readFile(resolve(sourcePath), "utf8"));
if (raw?.type !== "FeatureCollection" || !Array.isArray(raw.features)) {
  throw new Error("The source must be a GeoJSON FeatureCollection");
}

const groups = new Map();
for (const [index, feature] of raw.features.entries()) {
  const properties = feature?.properties;
  const geometry = feature?.geometry;
  if (!properties || geometry?.type !== "LineString" || !Array.isArray(geometry.coordinates) || geometry.coordinates.length < 2) {
    throw new Error(`feature ${index}: valid LineString geometry is required`);
  }
  const id = requiredString(properties.N02_005c, "N02_005c", index);
  const station = {
    id,
    name: requiredString(properties.N02_005, "N02_005", index),
    line: requiredString(properties.N02_003, "N02_003", index),
    operator: requiredString(properties.N02_004, "N02_004", index),
  };
  if (!geometry.coordinates.every(validCoordinate)) throw new Error(`feature ${index}: invalid coordinate`);
  const segments = geometry.coordinates.slice(1).map((end, coordinateIndex) => [geometry.coordinates[coordinateIndex], end]);
  const existing = groups.get(id);
  if (existing) {
    if (existing.name !== station.name || existing.line !== station.line || existing.operator !== station.operator) {
      throw new Error(`station code ${id}: inconsistent attributes`);
    }
    existing.segments.push(...segments);
  } else {
    groups.set(id, { ...station, segments });
  }
}

const stations = [...groups.values()]
  .sort((left, right) => left.id.localeCompare(right.id, "ja"))
  .map(({ id, name, line, operator, segments }) => {
    const [longitude, latitude] = midpoint(segments);
    return [id, name, line, operator, Number(latitude.toFixed(7)), Number(longitude.toFixed(7))];
  });

if (stations.length < 9_000 || new Set(stations.map(([id]) => id)).size !== stations.length) {
  throw new Error("Generated station data failed count or unique ID validation");
}

const output = {
  source: {
    title: "国土数値情報（鉄道データ）",
    sourceUrl: SOURCE_URL,
    sourcePageUrl: SOURCE_PAGE_URL,
    referenceDate: REFERENCE_DATE,
    retrievedDate: RETRIEVED_DATE,
    license: "CC BY 4.0",
    processing: "同一駅コードの線分を統合し、全線分の長さに沿った中間点を検索中心として算出",
  },
  stations,
};

await writeFile(OUTPUT_PATH, `${JSON.stringify(output)}\n`, "utf8");
console.log(`Generated ${stations.length} stations at ${OUTPUT_PATH}`);
