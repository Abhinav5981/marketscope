// Pure geo helpers used both server-side (boundary enforcement, dashboard
// classification) and duplicated verbatim on the frontend (live area badge
// while the user drags/resizes the rectangle). See README "Architecture
// decisions" for why this is duplicated rather than shared via a package.
//
// Deliberately NOT using PostGIS/turf: a market's boundary is a plain
// axis-aligned lat/lng bounding box, and both functions below are a few
// lines of arithmetic — pulling in a geo library for this would be more
// ceremony than the problem warrants at this scope.

export interface BoundingBox {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

/**
 * Whether a point falls inside (or exactly on) a bounding box.
 * Edges are treated as inclusive on all four sides — a point sitting exactly
 * on the boundary counts as "inside" for discovery/classification purposes.
 */
export function isPointInBoundingBox(lat: number, lng: number, bbox: BoundingBox): boolean {
  return lat >= bbox.minLat && lat <= bbox.maxLat && lng >= bbox.minLng && lng <= bbox.maxLng;
}

const EARTH_RADIUS_KM = 6371;
const DEG_TO_RAD = Math.PI / 180;

/**
 * Approximate area of a lat/lng bounding box in square kilometers, using an
 * equirectangular approximation (longitude distance scaled by cos(midLat)).
 * This is not geodesically exact, but is well within the precision needed
 * for a 30 sq km cost-guardrail cap at city scale — documented as a known
 * simplification in the README rather than pulling in a full geo library.
 */
export function calculateAreaSqKm(bbox: BoundingBox): number {
  const latDistanceKm = Math.abs(bbox.maxLat - bbox.minLat) * DEG_TO_RAD * EARTH_RADIUS_KM;
  const midLatRad = ((bbox.minLat + bbox.maxLat) / 2) * DEG_TO_RAD;
  const lngDistanceKm =
    Math.abs(bbox.maxLng - bbox.minLng) * DEG_TO_RAD * EARTH_RADIUS_KM * Math.cos(midLatRad);
  return latDistanceKm * lngDistanceKm;
}

export function isValidBoundingBox(bbox: BoundingBox): boolean {
  return (
    Number.isFinite(bbox.minLat) &&
    Number.isFinite(bbox.minLng) &&
    Number.isFinite(bbox.maxLat) &&
    Number.isFinite(bbox.maxLng) &&
    bbox.minLat >= -90 &&
    bbox.maxLat <= 90 &&
    bbox.minLng >= -180 &&
    bbox.maxLng <= 180 &&
    bbox.minLat < bbox.maxLat &&
    bbox.minLng < bbox.maxLng
  );
}
