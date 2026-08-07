import { describe, expect, it } from "vitest";
import { calculateAreaSqKm, isPointInBoundingBox, isValidBoundingBox } from "../../src/lib/geo";

// A small, easy-to-reason-about box roughly over central Bengaluru.
const BOX = { minLat: 12.9, minLng: 77.5, maxLat: 13.0, maxLng: 77.6 };

describe("isPointInBoundingBox", () => {
  it("returns true for a point strictly inside the box", () => {
    expect(isPointInBoundingBox(12.95, 77.55, BOX)).toBe(true);
  });

  it("returns true for points exactly on each of the four edges (inclusive)", () => {
    expect(isPointInBoundingBox(BOX.minLat, 77.55, BOX)).toBe(true); // south edge
    expect(isPointInBoundingBox(BOX.maxLat, 77.55, BOX)).toBe(true); // north edge
    expect(isPointInBoundingBox(12.95, BOX.minLng, BOX)).toBe(true); // west edge
    expect(isPointInBoundingBox(12.95, BOX.maxLng, BOX)).toBe(true); // east edge
  });

  it("returns true for a point exactly on a corner", () => {
    expect(isPointInBoundingBox(BOX.minLat, BOX.minLng, BOX)).toBe(true);
    expect(isPointInBoundingBox(BOX.maxLat, BOX.maxLng, BOX)).toBe(true);
  });

  it("returns false for a point just outside each edge", () => {
    expect(isPointInBoundingBox(BOX.minLat - 0.0001, 77.55, BOX)).toBe(false);
    expect(isPointInBoundingBox(BOX.maxLat + 0.0001, 77.55, BOX)).toBe(false);
    expect(isPointInBoundingBox(12.95, BOX.minLng - 0.0001, BOX)).toBe(false);
    expect(isPointInBoundingBox(12.95, BOX.maxLng + 0.0001, BOX)).toBe(false);
  });

  it("handles negative lat/lng (southern/western hemisphere) correctly", () => {
    const southernBox = { minLat: -23.6, minLng: -46.7, maxLat: -23.5, maxLng: -46.6 }; // Sao Paulo
    expect(isPointInBoundingBox(-23.55, -46.65, southernBox)).toBe(true);
    expect(isPointInBoundingBox(-23.45, -46.65, southernBox)).toBe(false);
  });
});

describe("calculateAreaSqKm", () => {
  it("computes a plausible area for a known ~city-block-scale box", () => {
    // ~0.1 deg lat (~11.1km) x ~0.1 deg lng at ~13N (~10.8km) ~= ~120 sq km
    const area = calculateAreaSqKm(BOX);
    expect(area).toBeGreaterThan(100);
    expect(area).toBeLessThan(140);
  });

  it("returns ~0 for a degenerate (zero-width) box", () => {
    const zeroBox = { minLat: 12.9, minLng: 77.5, maxLat: 12.9, maxLng: 77.6 };
    expect(calculateAreaSqKm(zeroBox)).toBeCloseTo(0, 5);
  });

  it("handles a box that straddles the equator", () => {
    const equatorBox = { minLat: -0.05, minLng: 30, maxLat: 0.05, maxLng: 30.1 };
    const area = calculateAreaSqKm(equatorBox);
    expect(area).toBeGreaterThan(0);
    expect(Number.isFinite(area)).toBe(true);
  });

  it("stays comfortably identifiable relative to the 30 sq km cost-guardrail cap", () => {
    // A box just under ~30 sq km at Bengaluru's latitude, used as a sanity
    // check that the cap comparison in marketService/frontend is meaningful.
    const smallBox = { minLat: 12.95, minLng: 77.55, maxLat: 12.998, maxLng: 77.598 };
    const area = calculateAreaSqKm(smallBox);
    expect(area).toBeLessThan(30);
  });
});

describe("isValidBoundingBox", () => {
  it("accepts a normal well-formed box", () => {
    expect(isValidBoundingBox(BOX)).toBe(true);
  });

  it("rejects a box where min >= max", () => {
    expect(isValidBoundingBox({ minLat: 13.0, minLng: 77.5, maxLat: 12.9, maxLng: 77.6 })).toBe(false);
    expect(isValidBoundingBox({ minLat: 12.9, minLng: 77.6, maxLat: 13.0, maxLng: 77.5 })).toBe(false);
  });

  it("rejects out-of-range coordinates", () => {
    expect(isValidBoundingBox({ minLat: -95, minLng: 77.5, maxLat: 13.0, maxLng: 77.6 })).toBe(false);
    expect(isValidBoundingBox({ minLat: 12.9, minLng: 77.5, maxLat: 13.0, maxLng: 185 })).toBe(false);
  });

  it("rejects non-finite values", () => {
    expect(isValidBoundingBox({ minLat: NaN, minLng: 77.5, maxLat: 13.0, maxLng: 77.6 })).toBe(false);
  });
});
