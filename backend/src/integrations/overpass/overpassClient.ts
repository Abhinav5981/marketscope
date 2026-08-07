import { env } from "../../config/env";
import {
  OVERPASS_ENDPOINTS,
  OVERPASS_HTTP_TIMEOUT_MS,
  OVERPASS_MAX_RETRIES_PER_ENDPOINT,
} from "../../config/constants";
import type { OverpassElement, OverpassResponse } from "./parseResponse";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface OverpassQueryResult {
  elements: OverpassElement[];
  /** True if we could not get a clean success from any endpoint — callers should surface a partial-results warning rather than treat this as "zero stores found". */
  partial: boolean;
  errorMessage?: string;
}

/**
 * Runs an Overpass QL query against the public Overpass API.
 *
 * Public Overpass instances share a global rate limit and commonly return
 * 429 (too many requests) or 504 (query too heavy / instance overloaded)
 * under load. This client retries each endpoint with exponential backoff,
 * then falls through to a secondary mirror endpoint if the primary is
 * unavailable. It never throws for a transient failure — if every endpoint
 * and retry is exhausted, it returns `{ elements: [], partial: true }` so
 * the caller can persist whatever else succeeded and surface a warning
 * instead of failing the whole market creation.
 */
export async function runOverpassQuery(query: string): Promise<OverpassQueryResult> {
  let lastError: string | undefined;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    for (let attempt = 1; attempt <= OVERPASS_MAX_RETRIES_PER_ENDPOINT; attempt++) {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), OVERPASS_HTTP_TIMEOUT_MS);

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain",
            "User-Agent": `MarketScope/1.0 (${env.contactEmail})`,
          },
          body: query,
          signal: controller.signal,
        });

        if (response.ok) {
          const data = (await response.json()) as OverpassResponse;
          return { elements: data.elements ?? [], partial: false };
        }

        lastError = `${endpoint} responded ${response.status} ${response.statusText}`;
        const retryable = response.status === 429 || response.status === 503 || response.status === 504;
        if (!retryable) break; // don't waste retries on e.g. a 400 (bad query) — try the next endpoint instead
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        // network error / abort — worth retrying the same endpoint
      } finally {
        clearTimeout(timeoutHandle);
      }

      if (attempt < OVERPASS_MAX_RETRIES_PER_ENDPOINT) {
        await sleep(2 ** (attempt - 1) * 1000); // 1s, 2s, ...
      }
    }
  }

  return { elements: [], partial: true, errorMessage: lastError ?? "All Overpass endpoints failed" };
}
