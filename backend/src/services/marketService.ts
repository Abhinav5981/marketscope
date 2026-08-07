import { prisma } from "../lib/prismaClient";
import { BadRequestError, NotFoundError } from "../types/errors";
import { calculateAreaSqKm, isPointInBoundingBox, isValidBoundingBox, type BoundingBox } from "../lib/geo";
import { MAX_MARKET_AREA_SQ_KM } from "../config/constants";
import { runMarketCreation } from "./marketCreationService";

export interface CreateMarketInput {
  cityId: number;
  categoryIds: number[];
  boundary: BoundingBox;
}

/**
 * Creates a market row and kicks off geocoding + discovery in the
 * background (fire-and-forget, not awaited). See README "Architecture
 * decisions" — at this scale (single process, no auth) a job queue would be
 * over-engineering, but the request/response boundary still shouldn't block
 * for the ~10-45s a real discovery run can take.
 */
export async function createMarket(input: CreateMarketInput) {
  if (!isValidBoundingBox(input.boundary)) {
    throw new BadRequestError("Invalid boundary: min must be less than max for both latitude and longitude.");
  }
  if (input.categoryIds.length === 0) {
    throw new BadRequestError("Select at least one category.");
  }

  const areaSqKm = calculateAreaSqKm(input.boundary);
  if (areaSqKm > MAX_MARKET_AREA_SQ_KM) {
    // Defense-in-depth: the frontend already disables submission above the
    // cap, but a direct API call could skip that check.
    throw new BadRequestError(
      `Boundary area (${areaSqKm.toFixed(1)} sq km) exceeds the ${MAX_MARKET_AREA_SQ_KM} sq km cost-guardrail cap.`
    );
  }

  const city = await prisma.city.findUnique({ where: { id: input.cityId } });
  if (!city) throw new NotFoundError(`City ${input.cityId} not found`);

  const market = await prisma.market.create({
    data: {
      name: `${city.name} Market — ${new Date().toISOString().slice(0, 10)}`,
      cityId: city.id,
      minLat: input.boundary.minLat,
      minLng: input.boundary.minLng,
      maxLat: input.boundary.maxLat,
      maxLng: input.boundary.maxLng,
      areaSqKm,
      status: "PENDING",
      categories: { create: input.categoryIds.map((categoryId) => ({ categoryId })) },
    },
    include: { city: true },
  });

  runMarketCreation(market.id).catch((err) => {
    console.error(`Background market creation failed for market ${market.id}:`, err);
  });

  return market;
}

export function listMarkets() {
  return prisma.market.findMany({ orderBy: { createdAt: "desc" }, include: { city: true } });
}

export async function getMarketStatus(marketId: string) {
  const market = await prisma.market.findUnique({
    where: { id: marketId },
    select: { status: true, errorMessage: true },
  });
  if (!market) throw new NotFoundError(`Market ${marketId} not found`);
  return market;
}

/**
 * Splits every portfolio store into inside/outside/ungeocoded relative to
 * this market's boundary. Computed on read against the live PortfolioStore
 * table rather than a stored per-market snapshot — see README "Architecture
 * decisions" for why.
 */
export function classifyPortfolioStores<T extends { latitude: number | null; longitude: number | null }>(
  stores: T[],
  boundary: BoundingBox
): { inside: T[]; outside: T[]; ungeocoded: T[] } {
  const inside: T[] = [];
  const outside: T[] = [];
  const ungeocoded: T[] = [];

  for (const store of stores) {
    if (store.latitude === null || store.longitude === null) {
      ungeocoded.push(store);
    } else if (isPointInBoundingBox(store.latitude, store.longitude, boundary)) {
      inside.push(store);
    } else {
      outside.push(store);
    }
  }

  return { inside, outside, ungeocoded };
}

export async function getMarketDashboard(marketId: string) {
  const market = await prisma.market.findUnique({
    where: { id: marketId },
    include: {
      city: { include: { state: { include: { country: true } } } },
      categories: { include: { category: true } },
      discoveredStores: { include: { category: true }, orderBy: { name: "asc" } },
    },
  });
  if (!market) throw new NotFoundError(`Market ${marketId} not found`);

  const portfolioStores = await prisma.portfolioStore.findMany({ orderBy: { storeName: "asc" } });
  const boundary: BoundingBox = {
    minLat: market.minLat,
    minLng: market.minLng,
    maxLat: market.maxLat,
    maxLng: market.maxLng,
  };
  const { inside, outside, ungeocoded } = classifyPortfolioStores(portfolioStores, boundary);

  return {
    market,
    discoveredStores: market.discoveredStores,
    portfolioInside: inside,
    portfolioOutside: outside,
    portfolioUngeocoded: ungeocoded,
  };
}
