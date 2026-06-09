// Haversine great-circle distance and geofence validation.

const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Distance in metres between two lat/lng points. */
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

export interface GeoCheckInput {
  lat: number;
  lng: number;
  accuracyM?: number | null;
  hqLat: number;
  hqLng: number;
  radiusM: number;
}

export interface GeoCheckResult {
  ok: boolean;
  distanceM: number;
  reason?: string;
}

/**
 * Validates a position against the HQ geofence. The reported GPS accuracy is
 * added to the allowed radius as a tolerance buffer, but capped so a wildly
 * inaccurate fix cannot be used to spoof presence from far away.
 */
export function validateGeofence(input: GeoCheckInput): GeoCheckResult {
  const { lat, lng, accuracyM, hqLat, hqLng, radiusM } = input;

  if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return { ok: false, distanceM: Infinity, reason: "Invalid coordinates." };
  }

  const distanceM = haversineMeters(lat, lng, hqLat, hqLng);
  const tolerance = Math.min(Math.max(accuracyM ?? 0, 0), 50); // cap buffer at 50 m
  const allowed = radiusM + tolerance;

  if (distanceM > allowed) {
    return {
      ok: false,
      distanceM,
      reason: "Attendance not allowed outside HQ location.",
    };
  }
  return { ok: true, distanceM };
}
