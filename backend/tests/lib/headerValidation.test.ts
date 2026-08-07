import { describe, expect, it } from "vitest";
import { validatePortfolioHeaders } from "../../src/lib/headerValidation";

const VALID_HEADERS = ["store_name", "address", "city", "state", "country", "category", "latitude", "longitude"];

function row(overrides: Record<string, unknown> = {}) {
  return {
    store_name: "Test Store",
    address: "123 Main St",
    city: "Bengaluru",
    state: "Karnataka",
    country: "India",
    category: "Supermarket",
    latitude: "12.9",
    longitude: "77.6",
    ...overrides,
  };
}

describe("validatePortfolioHeaders — column-level", () => {
  it("accepts a file with all required + optional columns, all valid rows", () => {
    const result = validatePortfolioHeaders(VALID_HEADERS, [row()]);
    expect(result.valid).toBe(true);
    expect(result.columnErrors).toEqual([]);
    expect(result.acceptedRowCount).toBe(1);
    expect(result.rejectedRowCount).toBe(0);
  });

  it("fails fatally when a required column is missing, without processing rows", () => {
    const headersMissingCountry = VALID_HEADERS.filter((h) => h !== "country");
    const result = validatePortfolioHeaders(headersMissingCountry, [row()]);
    expect(result.valid).toBe(false);
    expect(result.columnErrors).toEqual([{ column: "country", message: expect.stringContaining("country") }]);
    expect(result.acceptedRows).toEqual([]);
  });

  it("reports every missing required column at once", () => {
    const result = validatePortfolioHeaders(["store_name", "address"], [row()]);
    expect(result.valid).toBe(false);
    const missing = result.columnErrors.map((e) => e.column);
    expect(missing).toEqual(expect.arrayContaining(["city", "state", "country"]));
  });

  it("defaults category to 'Unknown' with a warning when the category column is absent, and is still valid", () => {
    const headers = VALID_HEADERS.filter((h) => h !== "category");
    const result = validatePortfolioHeaders(headers, [row()]);
    expect(result.valid).toBe(true);
    expect(result.rowWarnings.some((w) => w.message.includes("category"))).toBe(true);
    expect(result.acceptedRows[0].category).toBe("Unknown");
  });

  it("matches headers case-insensitively and tolerates surrounding whitespace", () => {
    const messyHeaders = [" Store_Name ", "ADDRESS", "City", "STATE", "country"];
    const messyRow = { " Store_Name ": "X", ADDRESS: "Y", City: "Z", STATE: "S", country: "C" };
    const result = validatePortfolioHeaders(messyHeaders, [messyRow]);
    expect(result.valid).toBe(true);
    expect(result.acceptedRows[0]).toMatchObject({ storeName: "X", address: "Y", city: "Z", state: "S", country: "C" });
  });

  it("handles an empty / header-only file without crashing", () => {
    const result = validatePortfolioHeaders(VALID_HEADERS, []);
    expect(result.valid).toBe(true);
    expect(result.acceptedRowCount).toBe(0);
    expect(result.rejectedRowCount).toBe(0);
  });
});

describe("validatePortfolioHeaders — row-level", () => {
  it("rejects a row with a blank required field but keeps processing other rows", () => {
    const result = validatePortfolioHeaders(VALID_HEADERS, [row({ store_name: "  " }), row()]);
    expect(result.valid).toBe(true);
    expect(result.acceptedRowCount).toBe(1);
    expect(result.rejectedRowCount).toBe(1);
    expect(result.rowErrors[0]).toMatchObject({ row: 1, column: "store_name" });
  });

  it("rejects a row with latitude present but longitude missing", () => {
    const result = validatePortfolioHeaders(VALID_HEADERS, [row({ longitude: "" })]);
    expect(result.rejectedRowCount).toBe(1);
    expect(result.rowErrors[0].message).toMatch(/both be present/i);
  });

  it("rejects a row with longitude present but latitude missing", () => {
    const result = validatePortfolioHeaders(VALID_HEADERS, [row({ latitude: undefined })]);
    expect(result.rejectedRowCount).toBe(1);
  });

  it("accepts a row with neither latitude nor longitude provided", () => {
    const result = validatePortfolioHeaders(VALID_HEADERS, [row({ latitude: "", longitude: "" })]);
    expect(result.acceptedRowCount).toBe(1);
    expect(result.acceptedRows[0].latitude).toBeNull();
    expect(result.acceptedRows[0].longitude).toBeNull();
  });

  it("rejects a row with an out-of-range latitude", () => {
    const result = validatePortfolioHeaders(VALID_HEADERS, [row({ latitude: "200" })]);
    expect(result.rejectedRowCount).toBe(1);
    expect(result.rowErrors[0].column).toBe("latitude");
  });

  it("rejects a row with a non-numeric latitude", () => {
    const result = validatePortfolioHeaders(VALID_HEADERS, [row({ latitude: "not-a-number" })]);
    expect(result.rejectedRowCount).toBe(1);
  });

  it("rejects a row with an out-of-range longitude", () => {
    const result = validatePortfolioHeaders(VALID_HEADERS, [row({ longitude: "-200" })]);
    expect(result.rejectedRowCount).toBe(1);
    expect(result.rowErrors[0].column).toBe("longitude");
  });

  it("accepts valid numeric lat/lng and parses them as numbers", () => {
    const result = validatePortfolioHeaders(VALID_HEADERS, [row({ latitude: "12.97", longitude: "77.59" })]);
    expect(result.acceptedRows[0].latitude).toBeCloseTo(12.97);
    expect(result.acceptedRows[0].longitude).toBeCloseTo(77.59);
  });

  it("processes multiple rows independently, mixing good and bad rows", () => {
    const rows = [row(), row({ city: "" }), row(), row({ latitude: "999" })];
    const result = validatePortfolioHeaders(VALID_HEADERS, rows);
    expect(result.acceptedRowCount).toBe(2);
    expect(result.rejectedRowCount).toBe(2);
    expect(result.rowErrors.map((e) => e.row)).toEqual([2, 4]);
  });
});
