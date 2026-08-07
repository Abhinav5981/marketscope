import { prisma } from "../lib/prismaClient";
import { geocodeAddress } from "../integrations/nominatim/nominatimClient";
import { runOverpassQuery } from "../integrations/overpass/overpassClient";
import { buildOverpassQuery, type CategoryForQuery } from "../integrations/overpass/queryBuilder";
import { parseOverpassResponse } from "../integrations/overpass/parseResponse";
import { OVERPASS_QUERY_TIMEOUT_S } from "../config/constants";
import type { BoundingBox } from "../lib/geo";

/**
 * Geocodes portfolio rows missing lat/long that are plausible candidates for
 * this market: we can't know whether an ungeocoded row falls inside the
 * boundary without geocoding it first (chicken-and-egg), so as a bounded,
 * explainable proxy we only geocode rows whose uploaded `city` text matches
 * this market's city — geocoding every ungeocoded portfolio row in the
 * database on every market creation would be wasteful and slow against a
 * 1 req/sec public Nominatim instance. Rows that don't match by city name
 * are simply left ungeocoded for this run; they'll be picked up if a market
 * is later created for their own city.
 *
 * Geocoding results are written onto PortfolioStore itself (lat/lng is a
 * property of the store, not of any one market) — see README.
 */
async function geocodePortfolioRowsForCity(cityName: string): Promise<void> {
  const candidates = await prisma.portfolioStore.findMany({
    where: { latitude: null, city: { equals: cityName, mode: "insensitive" } },
  });

  for (const store of candidates) {
    const query = [store.address, store.city, store.state, store.country].filter(Boolean).join(", ");
    const point = await geocodeAddress(query);
    if (point) {
      await prisma.portfolioStore.update({
        where: { id: store.id },
        data: {
          latitude: point.latitude,
          longitude: point.longitude,
          geocoded: true,
          geocodeSource: "nominatim",
        },
      });
    }
    // A row that still can't be geocoded is left as-is; it surfaces in the
    // dashboard's "ungeocoded" bucket rather than silently disappearing.
  }
}

async function discoverStoresInBoundary(
  marketId: string,
  boundary: BoundingBox,
  categories: CategoryForQuery[]
): Promise<{ discoveredCount: number; partial: boolean; errorMessage?: string }> {
  const query = buildOverpassQuery(boundary, categories, OVERPASS_QUERY_TIMEOUT_S);
  const result = await runOverpassQuery(query);

  const candidates = parseOverpassResponse({ elements: result.elements }, categories);

  if (candidates.length > 0) {
    await prisma.discoveredStore.createMany({
      data: candidates.map((c) => ({
        marketId,
        externalId: c.externalId,
        name: c.name,
        categoryId: c.categoryId,
        osmTag: c.osmTag,
        latitude: c.latitude,
        longitude: c.longitude,
        address: c.address,
      })),
      skipDuplicates: true, // idempotent if discovery is ever re-run for the same market
    });
  }

  return { discoveredCount: candidates.length, partial: result.partial, errorMessage: result.errorMessage };
}

/**
 * Orchestrates Step 3 of the flow: geocode, discover, persist. Not awaited
 * by the create-market HTTP request — see marketService.createMarket.
 *
 * Failure handling: a market only ends up FAILED if discovery could not
 * produce any usable result at all (Overpass failed on every endpoint/retry
 * AND found nothing). A query that succeeds but legitimately finds zero
 * stores is READY, not FAILED. A query that fails after partial retries but
 * still returns some data is READY with a warning in errorMessage — we
 * persist whatever succeeded rather than discarding it.
 */
export async function runMarketCreation(marketId: string): Promise<void> {
  const market = await prisma.market.findUnique({
    where: { id: marketId },
    include: { city: true, categories: { include: { category: true } } },
  });
  if (!market) return; // market was deleted mid-flight; nothing to do

  await prisma.market.update({ where: { id: marketId }, data: { status: "DISCOVERING" } });

  try {
    await geocodePortfolioRowsForCity(market.city.name);

    const categories: CategoryForQuery[] = market.categories.map((mc) => ({
      id: mc.category.id,
      osmTags: mc.category.osmTags as unknown as CategoryForQuery["osmTags"],
    }));
    const boundary: BoundingBox = { minLat: market.minLat, minLng: market.minLng, maxLat: market.maxLat, maxLng: market.maxLng };

    const { discoveredCount, partial, errorMessage } = await discoverStoresInBoundary(marketId, boundary, categories);

    const failed = partial && discoveredCount === 0;
    await prisma.market.update({
      where: { id: marketId },
      data: {
        status: failed ? "FAILED" : "READY",
        errorMessage: failed
          ? (errorMessage ?? "Store discovery failed and returned no results.")
          : partial
            ? "Store discovery returned partial results; some stores in this area may be missing."
            : null,
      },
    });
  } catch (err) {
    console.error(`Market creation failed for market ${marketId}:`, err);
    await prisma.market.update({
      where: { id: marketId },
      data: { status: "FAILED", errorMessage: err instanceof Error ? err.message : "Unknown error" },
    });
  }
}
