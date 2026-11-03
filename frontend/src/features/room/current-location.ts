export type CurrentCoordinates = {
  latitude: number;
  longitude: number;
};

export type CurrentLocationErrorCode =
  | "unsupported"
  | "permission_denied"
  | "position_unavailable"
  | "timeout"
  | "invalid_coordinates";

export type CurrentLocationResult =
  | { ok: true; coordinates: CurrentCoordinates }
  | { ok: false; code: CurrentLocationErrorCode };

const GEOLOCATION_PERMISSION_DENIED = 1;
const GEOLOCATION_POSITION_UNAVAILABLE = 2;
const GEOLOCATION_TIMEOUT = 3;
const GEOLOCATION_TIMEOUT_MILLISECONDS = 10_000;

const positionOptions: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: GEOLOCATION_TIMEOUT_MILLISECONDS,
};

function validCoordinates(coordinates: GeolocationCoordinates): boolean {
  return Number.isFinite(coordinates.latitude)
    && coordinates.latitude >= -90
    && coordinates.latitude <= 90
    && Number.isFinite(coordinates.longitude)
    && coordinates.longitude >= -180
    && coordinates.longitude <= 180;
}

function locationErrorCode(error: GeolocationPositionError): CurrentLocationErrorCode {
  switch (error.code) {
    case GEOLOCATION_PERMISSION_DENIED:
      return "permission_denied";
    case GEOLOCATION_POSITION_UNAVAILABLE:
      return "position_unavailable";
    case GEOLOCATION_TIMEOUT:
      return "timeout";
    default:
      return "position_unavailable";
  }
}

export function requestCurrentLocation(
  geolocation: Pick<Geolocation, "getCurrentPosition"> | undefined =
    typeof navigator === "undefined" ? undefined : navigator.geolocation,
): Promise<CurrentLocationResult> {
  if (!geolocation) return Promise.resolve({ ok: false, code: "unsupported" });

  return new Promise((resolve) => {
    geolocation.getCurrentPosition(
      (position) => {
        if (!validCoordinates(position.coords)) {
          resolve({ ok: false, code: "invalid_coordinates" });
          return;
        }
        resolve({
          ok: true,
          coordinates: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
        });
      },
      (error) => resolve({ ok: false, code: locationErrorCode(error) }),
      positionOptions,
    );
  });
}
