import { env } from "../../config/env";
import { NOMINATIM_BASE_URL, NOMINATIM_MAX_RETRIES, NOMINATIM_MIN_INTERVAL_MS } from "../../config/constants";

// A minimal client for the free public Nominatim geocoding API.
//
// Nominatim's usage policy (https://operations.osmfoundation.org/policies/nominatim/)
// requires: at most 1 request/second, and a descriptive User-Agent identifying
// the application. Both are enforced here rather than left to callers, since
// every caller in this app shares the same public-instance rate budget.
//
// A tiny hand-rolled promise chain does the queueing — pulling in a
// scheduling library (e.g. `bottleneck`) for "wait at least N ms between
// calls" would be more ceremony than the problem needs.

let requestChain: Promise<void> = Promise.resolve();
let lastRequestAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Serializes all Nominatim calls app-wide and enforces the minimum spacing between them. */
function throttled<T>(task: () => Promise<T>): Promise<T> {
  const scheduled = requestChain.then(async () => {
    const elapsed = Date.now() - lastRequestAt;
    if (elapsed < NOMINATIM_MIN_INTERVAL_MS) {
      await sleep(NOMINATIM_MIN_INTERVAL_MS - elapsed);
    }
    lastRequestAt = Date.now();
    return task();
  });
  // Keep the chain alive even if this task fails, so later calls aren't stuck
  // waiting on a rejected promise forever.
  requestChain = scheduled.then(
    () => undefined,
    () => undefined
  );
  return scheduled;
}

/**
 * Test-only hook to reset the shared rate-limiter state between test cases.
 * Not used by production code — the module-level state is otherwise
 * intentionally a singleton so all callers in the running process share one
 * request budget against the public Nominatim instance.
 */
export function __resetRateLimiterForTests(): void {
  requestChain = Promise.resolve();
  lastRequestAt = 0;
}

export class NominatimError extends Error {}

/**
 * Issues one rate-limited, retried GET request against Nominatim and parses
 * the JSON response. Retries with exponential backoff on 429/503 (typical
 * "you're being throttled" / "instance overloaded" responses from the public
 * instance); other HTTP errors are not retried since they indicate a bad
 * request rather than a transient condition.
 */
async function requestJson<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(path, NOMINATIM_BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  let attempt = 0;
  for (;;) {
    attempt += 1;
    const response = await throttled(() =>
      fetch(url.toString(), {
        headers: {
          "User-Agent": `MarketScope/1.0 (${env.contactEmail})`,
          Accept: "application/json",
        },
      })
    );

    if (response.ok) {
      return (await response.json()) as T;
    }

    const isRetryable = response.status === 429 || response.status === 503;
    if (!isRetryable || attempt > NOMINATIM_MAX_RETRIES) {
      throw new NominatimError(`Nominatim request failed: ${response.status} ${response.statusText}`);
    }

    const backoffMs = 2 ** (attempt - 1) * 1000; // 1s, 2s, 4s
    await sleep(backoffMs);
  }
}

interface NominatimSearchResult {
  lat: string;
  lon: string;
  boundingbox: [string, string, string, string]; // [south, north, west, east]
}

export interface GeocodedPoint {
  latitude: number;
  longitude: number;
}

export interface GeocodedBoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/**
 * Geocodes a free-form address to a single lat/lng point. Returns null
 * (rather than throwing) when Nominatim has no match or the request
 * ultimately fails after retries — callers treat this as "ungeocodable",
 * a partial failure that shouldn't abort the rest of a batch.
 */
export async function geocodeAddress(query: string): Promise<GeocodedPoint | null> {
  try {
    const results = await requestJson<NominatimSearchResult[]>("/search", {
      q: query,
      format: "json",
      limit: "1",
    });
    const first = results[0];
    if (!first) return null;
    return { latitude: Number(first.lat), longitude: Number(first.lon) };
  } catch (err) {
    if (err instanceof NominatimError) return null;
    throw err;
  }
}

/**
 * Resolves a city/state/country into a bounding box, used to seed the
 * market boundary rectangle behind the scenes when a city is selected
 * (Step 2 of the flow). Returns null if Nominatim has no match.
 */
export async function fetchCityBoundingBox(
  city: string,
  state: string,
  country: string
): Promise<GeocodedBoundingBox | null> {
  try {
    const results = await requestJson<NominatimSearchResult[]>("/search", {
      city,
      state,
      country,
      format: "json",
      limit: "1",
    });
    const first = results[0];
    if (!first) return null;
    const [south, north, west, east] = first.boundingbox.map(Number);
    return { minLat: south, maxLat: north, minLng: west, maxLng: east };
  } catch (err) {
    if (err instanceof NominatimError) return null;
    throw err;
  }
}
