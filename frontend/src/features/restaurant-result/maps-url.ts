import type { RestaurantCandidate } from "../restaurant-vote/restaurant-data";

const GOOGLE_MAPS_SEARCH_URL = "https://www.google.com/maps/search/";
const MAX_LATITUDE = 90;
const MAX_LONGITUDE = 180;

export function createGoogleMapsUrl(coordinates: RestaurantCandidate["coordinates"]): string | undefined {
  if (!coordinates || typeof coordinates.latitude !== "number" || typeof coordinates.longitude !== "number"
    || !Number.isFinite(coordinates.latitude) || !Number.isFinite(coordinates.longitude)
    || Math.abs(coordinates.latitude) > MAX_LATITUDE || Math.abs(coordinates.longitude) > MAX_LONGITUDE) return;
  const url = new URL(GOOGLE_MAPS_SEARCH_URL);
  url.searchParams.set("api", "1");
  url.searchParams.set("query", `${coordinates.latitude},${coordinates.longitude}`);
  return url.href;
}
