import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runOverpassQuery } from "../../../src/integrations/overpass/overpassClient";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("runOverpassQuery", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns elements on a clean success", async () => {
    const elements = [{ type: "node", id: 1, lat: 12.9, lon: 77.6, tags: { shop: "supermarket" } }];
    const fetchMock = vi.fn(async () => jsonResponse({ elements }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runOverpassQuery("[out:json];");

    expect(result).toEqual({ elements, partial: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries the same endpoint after a 504, then succeeds", async () => {
    let calls = 0;
    const fetchMock = vi.fn(async () => {
      calls += 1;
      if (calls === 1) return jsonResponse({}, 504);
      return jsonResponse({ elements: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    const resultPromise = runOverpassQuery("[out:json];");
    await vi.advanceTimersByTimeAsync(5000);
    const result = await resultPromise;

    expect(result).toEqual({ elements: [], partial: false });
    expect(calls).toBe(2);
  });

  it("falls through to the fallback endpoint once the primary is exhausted", async () => {
    const calledEndpoints: string[] = [];
    const fetchMock = vi.fn(async (url: string) => {
      calledEndpoints.push(url);
      if (url.includes("overpass-api.de")) return jsonResponse({}, 504);
      return jsonResponse({ elements: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    const resultPromise = runOverpassQuery("[out:json];");
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await resultPromise;

    expect(result.partial).toBe(false);
    expect(calledEndpoints.some((u) => u.includes("kumi.systems"))).toBe(true);
  });

  it("returns a partial-failure result without throwing once every endpoint is exhausted", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}, 504));
    vi.stubGlobal("fetch", fetchMock);

    const resultPromise = runOverpassQuery("[out:json];");
    await vi.advanceTimersByTimeAsync(20_000);
    const result = await resultPromise;

    expect(result.partial).toBe(true);
    expect(result.elements).toEqual([]);
    expect(result.errorMessage).toBeTruthy();
  });

  it("does not retry a non-retryable HTTP error against the same endpoint", async () => {
    const calledEndpoints: string[] = [];
    const fetchMock = vi.fn(async (url: string) => {
      calledEndpoints.push(url);
      return jsonResponse({}, 400);
    });
    vi.stubGlobal("fetch", fetchMock);

    const resultPromise = runOverpassQuery("[out:json];");
    await vi.advanceTimersByTimeAsync(10_000);
    await resultPromise;

    // one attempt per endpoint (2 endpoints), not OVERPASS_MAX_RETRIES_PER_ENDPOINT per endpoint
    expect(calledEndpoints).toHaveLength(2);
  });

  it("treats a network error / timeout as retryable", async () => {
    let calls = 0;
    const fetchMock = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new Error("network error");
      return jsonResponse({ elements: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    const resultPromise = runOverpassQuery("[out:json];");
    await vi.advanceTimersByTimeAsync(5000);
    const result = await resultPromise;

    expect(result.partial).toBe(false);
    expect(calls).toBe(2);
  });
});
