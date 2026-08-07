import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetRateLimiterForTests,
  fetchCityBoundingBox,
  geocodeAddress,
} from "../../../src/integrations/nominatim/nominatimClient";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("nominatimClient", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // The rate limiter is a module-level singleton (by design — see
    // nominatimClient.ts); reset it so each test starts unthrottled instead
    // of inheriting a stale "last request" timestamp from a prior test's
    // fake-timer epoch.
    __resetRateLimiterForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("enforces at least ~1100ms spacing between two queued requests", async () => {
    const callTimestamps: number[] = [];
    const fetchMock = vi.fn(async () => {
      callTimestamps.push(Date.now());
      return jsonResponse([]);
    });
    vi.stubGlobal("fetch", fetchMock);

    const combined = Promise.all([geocodeAddress("123 Main St"), geocodeAddress("456 Other St")]);
    await vi.advanceTimersByTimeAsync(3000);
    await combined;

    expect(callTimestamps).toHaveLength(2);
    expect(callTimestamps[1] - callTimestamps[0]).toBeGreaterThanOrEqual(1100);
  });

  it("retries after a 429 with exponential backoff, then succeeds", async () => {
    let calls = 0;
    const fetchMock = vi.fn(async () => {
      calls += 1;
      if (calls === 1) return jsonResponse({}, 429);
      return jsonResponse([{ lat: "12.97", lon: "77.59", boundingbox: ["12.9", "13.0", "77.5", "77.6"] }]);
    });
    vi.stubGlobal("fetch", fetchMock);

    const resultPromise = geocodeAddress("123 Main St");
    await vi.advanceTimersByTimeAsync(5000);
    const result = await resultPromise;

    expect(calls).toBe(2);
    expect(result).toEqual({ latitude: 12.97, longitude: 77.59 });
  });

  it("returns null (not a throw) once retries are exhausted on repeated 429s", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}, 429));
    vi.stubGlobal("fetch", fetchMock);

    const resultPromise = geocodeAddress("an address nominatim can't find");
    await vi.advanceTimersByTimeAsync(20_000);
    const result = await resultPromise;

    expect(result).toBeNull();
    // initial attempt + NOMINATIM_MAX_RETRIES retries
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("returns null when Nominatim has no match for the query", async () => {
    const fetchMock = vi.fn(async () => jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    const resultPromise = geocodeAddress("nowhere in particular");
    await vi.advanceTimersByTimeAsync(1000);
    expect(await resultPromise).toBeNull();
  });

  it("sends a descriptive custom User-Agent header, per Nominatim's usage policy", async () => {
    const fetchMock = vi.fn(async (_url: string, _options: RequestInit) => jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    const resultPromise = geocodeAddress("123 Main St");
    await vi.advanceTimersByTimeAsync(1000);
    await resultPromise;

    const [, options] = fetchMock.mock.calls[0];
    const headers = options.headers as Record<string, string>;
    expect(headers["User-Agent"]).toMatch(/MarketScope/);
  });

  it("parses a city bounding box response into {minLat, maxLat, minLng, maxLng}", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse([{ lat: "12.97", lon: "77.59", boundingbox: ["12.83", "13.14", "77.46", "77.74"] }])
    );
    vi.stubGlobal("fetch", fetchMock);

    const resultPromise = fetchCityBoundingBox("Bengaluru", "Karnataka", "India");
    await vi.advanceTimersByTimeAsync(1000);
    const result = await resultPromise;

    expect(result).toEqual({ minLat: 12.83, maxLat: 13.14, minLng: 77.46, maxLng: 77.74 });
  });
});
