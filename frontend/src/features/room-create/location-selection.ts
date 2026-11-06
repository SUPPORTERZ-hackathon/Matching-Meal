import type { CurrentCoordinates } from "../room/current-location";
import type { Station } from "./station-data";

export type LocationSelection = {
  source: "current" | "station";
  coordinates: CurrentCoordinates;
  displayName: string;
};

export function selectCurrentLocation(coordinates: CurrentCoordinates): LocationSelection {
  return { source: "current", coordinates, displayName: "現在地を使用" };
}

export function selectStationLocation(station: Station): LocationSelection {
  return {
    source: "station",
    coordinates: { latitude: station.latitude, longitude: station.longitude },
    displayName: `${station.name}駅`,
  };
}

export function preserveLocationAfterCurrentFailure(current: LocationSelection | null): LocationSelection | null {
  return current;
}

export function clearLocationAfterStationEdit(): null {
  return null;
}
