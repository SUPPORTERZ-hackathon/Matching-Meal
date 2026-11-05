export type CurrentCoordinates = {
  latitude: number;
  longitude: number;
};

export type CurrentLocationErrorCode =
  | "unsupported"
  | "permission_denied"
  | "position_unavailable"
  | "timeout"
  | "invalid_coordinates"
  | "insecure_context"
  | "cancelled";

export type CurrentLocationMode = "high" | "standard";
type CurrentLocationOptions = { signal?: AbortSignal; onMode?: (mode: CurrentLocationMode) => void; secureContext?: boolean };

export type CurrentLocationResult =
  | { ok: true; coordinates: CurrentCoordinates; mode: CurrentLocationMode }
  | { ok: false; code: CurrentLocationErrorCode };

const GEOLOCATION_PERMISSION_DENIED = 1;
const GEOLOCATION_POSITION_UNAVAILABLE = 2;
const GEOLOCATION_TIMEOUT = 3;
export const LOCATION_OPTIONS: Record<CurrentLocationMode, PositionOptions> = {
  high: { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
  standard: { enableHighAccuracy: false, maximumAge: 60_000, timeout: 20_000 },
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

function locate(geolocation: Pick<Geolocation, "getCurrentPosition">, mode: CurrentLocationMode, signal?: AbortSignal): Promise<CurrentLocationResult> {
  return new Promise((resolve) => {
    let settled = false;
    function finish(result: CurrentLocationResult) {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", cancel);
      resolve(result);
    }
    function cancel() { finish({ ok: false, code: "cancelled" }); }
    if (signal?.aborted) { cancel(); return; }
    signal?.addEventListener("abort", cancel, { once: true });
    try {
      geolocation.getCurrentPosition(position => {
        if (!validCoordinates(position.coords)) { finish({ ok: false, code: "invalid_coordinates" }); return; }
        finish({ ok: true, mode, coordinates: { latitude: position.coords.latitude, longitude: position.coords.longitude } });
      }, error => finish({ ok: false, code: locationErrorCode(error) }), LOCATION_OPTIONS[mode]);
    } catch { finish({ ok: false, code: "position_unavailable" }); }
  });
}

export async function requestCurrentLocation(
  geolocation: Pick<Geolocation, "getCurrentPosition"> | undefined = typeof navigator === "undefined" ? undefined : navigator.geolocation,
  options: CurrentLocationOptions = {},
): Promise<CurrentLocationResult> {
  if (options.signal?.aborted) return { ok: false, code: "cancelled" };
  if (!(options.secureContext ?? (typeof window === "undefined" || window.isSecureContext))) return { ok: false, code: "insecure_context" };
  if (!geolocation) return { ok: false, code: "unsupported" };
  options.onMode?.("high");
  const result = await locate(geolocation, "high", options.signal);
  if (result.ok || !["timeout", "position_unavailable"].includes(result.code) || options.signal?.aborted) return result;
  options.onMode?.("standard");
  return locate(geolocation, "standard", options.signal);
}
