import type { RestaurantCandidate } from "../restaurant-vote/restaurant-data";

const GOOGLE_MAPS_SEARCH_URL = "https://www.google.com/maps/search/";
const MAX_LATITUDE = 90;
const MAX_LONGITUDE = 180;

export function createGoogleMapsUrl(restaurant?: RestaurantCandidate): string | undefined {
  const name = restaurant?.name.trim();
  const address = restaurant?.address?.trim();
  const coordinates = restaurant?.coordinates;
  const query = name && address ? `${name} ${address}` : validCoordinates(coordinates)
    ? `${coordinates.latitude},${coordinates.longitude}` : undefined;
  if (!query) return;
  const url = new URL(GOOGLE_MAPS_SEARCH_URL);
  url.searchParams.set("api", "1");
  url.searchParams.set("query", query);
  return url.href;
}

function validCoordinates(coordinates: RestaurantCandidate["coordinates"]): coordinates is NonNullable<RestaurantCandidate["coordinates"]> {
  if (!coordinates || typeof coordinates.latitude !== "number" || typeof coordinates.longitude !== "number"
    || !Number.isFinite(coordinates.latitude) || !Number.isFinite(coordinates.longitude)
    || Math.abs(coordinates.latitude) > MAX_LATITUDE || Math.abs(coordinates.longitude) > MAX_LONGITUDE) return false;
  return true;
}
