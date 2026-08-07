import { prisma } from "../lib/prismaClient";
import { fetchCityBoundingBox } from "../integrations/nominatim/nominatimClient";
import { calculateAreaSqKm, type BoundingBox } from "../lib/geo";
import { NotFoundError } from "../types/errors";

// Fallback centers for the 3 seeded cities, used only if the live Nominatim
// lookup fails (public instance downtime/timeout) — resilience for a demo
// that shouldn't hard-fail Step 2 just because a free public API had a bad
// moment. A ~0.024deg half-width box comfortably clears the 30 sq km cap at
// all three cities' latitudes.
const FALLBACK_CITY_CENTERS: Record<string, { lat: number; lng: number }> = {
  Bengaluru: { lat: 12.9716, lng: 77.5946 },
  Mumbai: { lat: 19.076, lng: 72.8777 },
  "New Delhi": { lat: 28.6139, lng: 77.209 },
};
const FALLBACK_HALF_WIDTH_DEG = 0.024;

function fallbackBoundaryFor(cityName: string): BoundingBox | null {
  const center = FALLBACK_CITY_CENTERS[cityName];
  if (!center) return null;
  return {
    minLat: center.lat - FALLBACK_HALF_WIDTH_DEG,
    maxLat: center.lat + FALLBACK_HALF_WIDTH_DEG,
    minLng: center.lng - FALLBACK_HALF_WIDTH_DEG,
    maxLng: center.lng + FALLBACK_HALF_WIDTH_DEG,
  };
}

export interface BoundaryPreview {
  boundary: BoundingBox;
  areaSqKm: number;
  source: "nominatim" | "fallback";
}

/**
 * Resolves the initial boundary rectangle shown to the user in Step 2 when
 * they select a city. This is only a *starting point* — the user can then
 * drag/resize it before submitting, and whatever they leave it at is what's
 * used for discovery.
 */
export async function previewBoundaryForCity(cityId: number): Promise<BoundaryPreview> {
  const city = await prisma.city.findUnique({ where: { id: cityId }, include: { state: { include: { country: true } } } });
  if (!city) throw new NotFoundError(`City ${cityId} not found`);

  const geocoded = await fetchCityBoundingBox(city.name, city.state.name, city.state.country.name);
  const boundary = geocoded ?? fallbackBoundaryFor(city.name);

  if (!boundary) {
    throw new NotFoundError(`Could not determine a boundary for ${city.name} — Nominatim had no match and no fallback is configured.`);
  }

  return {
    boundary,
    areaSqKm: calculateAreaSqKm(boundary),
    source: geocoded ? "nominatim" : "fallback",
  };
}
