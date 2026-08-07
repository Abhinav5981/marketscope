import { describe, expect, it } from "vitest";
import { classifyPortfolioStores } from "../../src/services/marketService";

const BOUNDARY = { minLat: 12.9, minLng: 77.5, maxLat: 13.0, maxLng: 77.6 };

describe("classifyPortfolioStores", () => {
  it("splits stores into inside / outside / ungeocoded relative to the market boundary", () => {
    const stores = [
      { id: "1", latitude: 12.95, longitude: 77.55 }, // inside
      { id: "2", latitude: 13.5, longitude: 78.0 }, // outside
      { id: "3", latitude: null, longitude: null }, // ungeocoded
      { id: "4", latitude: BOUNDARY.minLat, longitude: BOUNDARY.minLng }, // inside (edge, inclusive)
    ];

    const result = classifyPortfolioStores(stores, BOUNDARY);

    expect(result.inside.map((s) => s.id)).toEqual(["1", "4"]);
    expect(result.outside.map((s) => s.id)).toEqual(["2"]);
    expect(result.ungeocoded.map((s) => s.id)).toEqual(["3"]);
  });

  it("treats a store with only one of latitude/longitude present as ungeocoded", () => {
    const stores = [{ id: "1", latitude: 12.95, longitude: null }];
    const result = classifyPortfolioStores(stores, BOUNDARY);
    expect(result.ungeocoded).toHaveLength(1);
    expect(result.inside).toHaveLength(0);
  });

  it("returns empty buckets for an empty portfolio", () => {
    const result = classifyPortfolioStores([], BOUNDARY);
    expect(result).toEqual({ inside: [], outside: [], ungeocoded: [] });
  });
});
