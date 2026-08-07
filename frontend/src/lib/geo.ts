// Deliberately duplicated from backend/src/lib/geo.ts rather than shared via
// a workspace package — see README "Architecture decisions". Used here so
// the boundary rectangle's area badge and the 30 sq km cap gating update
// live as the user drags/resizes, without a network round-trip per frame.

export interface BoundingBox {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

export function isPointInBoundingBox(lat: number, lng: number, bbox: BoundingBox): boolean {
  return lat >= bbox.minLat && lat <= bbox.maxLat && lng >= bbox.minLng && lng <= bbox.maxLng;
}

const EARTH_RADIUS_KM = 6371;
const DEG_TO_RAD = Math.PI / 180;

export function calculateAreaSqKm(bbox: BoundingBox): number {
  const latDistanceKm = Math.abs(bbox.maxLat - bbox.minLat) * DEG_TO_RAD * EARTH_RADIUS_KM;
  const midLatRad = ((bbox.minLat + bbox.maxLat) / 2) * DEG_TO_RAD;
  const lngDistanceKm =
    Math.abs(bbox.maxLng - bbox.minLng) * DEG_TO_RAD * EARTH_RADIUS_KM * Math.cos(midLatRad);
  return latDistanceKm * lngDistanceKm;
}
