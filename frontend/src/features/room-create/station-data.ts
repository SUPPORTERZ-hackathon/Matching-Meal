export const STATION_RESULT_LIMIT = 20;

export type Station = {
  id: string;
  name: string;
  line: string;
  operator: string;
  latitude: number;
  longitude: number;
};

export type StationTuple = [string, string, string, string, number, number];
export type StationDataDocument = { stations: StationTuple[] };

export function normalizeStationQuery(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase("ja-JP");
}

function validCoordinate(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
    && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}

export function parseStations(document: StationDataDocument): Station[] | undefined {
  if (!document || !Array.isArray(document.stations)) return;
  const ids = new Set<string>();
  const stations: Station[] = [];
  for (const row of document.stations) {
    if (!Array.isArray(row) || row.length !== 6) return;
    const [id, name, line, operator, latitude, longitude] = row;
    if (typeof id !== "string" || id === "" || ids.has(id)
      || typeof name !== "string" || name === ""
      || typeof line !== "string" || line === ""
      || typeof operator !== "string" || operator === ""
      || typeof latitude !== "number" || typeof longitude !== "number"
      || !validCoordinate(latitude, longitude)) return;
    ids.add(id);
    stations.push({ id, name, line, operator, latitude, longitude });
  }
  return stations.length >= 9_000 ? stations : undefined;
}

function stationRank(station: Station, normalizedQuery: string): number {
  const name = normalizeStationQuery(station.name);
  if (name === normalizedQuery) return 0;
  if (name.startsWith(normalizedQuery)) return 1;
  return 2;
}

export function searchStations(
  stations: readonly Station[],
  query: string,
  limit: number = STATION_RESULT_LIMIT,
): Station[] {
  const normalizedQuery = normalizeStationQuery(query);
  if (!normalizedQuery || limit < 1) return [];
  return stations
    .filter((station) => normalizeStationQuery(station.name).includes(normalizedQuery))
    .sort((left, right) => stationRank(left, normalizedQuery) - stationRank(right, normalizedQuery)
      || left.name.localeCompare(right.name, "ja")
      || left.operator.localeCompare(right.operator, "ja")
      || left.line.localeCompare(right.line, "ja")
      || left.id.localeCompare(right.id, "ja"))
    .slice(0, limit);
}
