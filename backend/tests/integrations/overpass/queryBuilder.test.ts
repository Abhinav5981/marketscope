import { describe, expect, it } from "vitest";
import { buildOverpassQuery } from "../../../src/integrations/overpass/queryBuilder";

const BBOX = { minLat: 12.9, minLng: 77.5, maxLat: 13.0, maxLng: 77.6 };

describe("buildOverpassQuery", () => {
  it("builds a query for a single category with one OSM tag", () => {
    const query = buildOverpassQuery(BBOX, [{ id: 1, osmTags: [{ key: "shop", value: "supermarket" }] }], 25);

    expect(query).toContain("[out:json][timeout:25];");
    expect(query).toContain('node["shop"="supermarket"](12.9,77.5,13,77.6);');
    expect(query).toContain('way["shop"="supermarket"](12.9,77.5,13,77.6);');
    expect(query).toContain("out center tags;");
  });

  it("unions clauses across multiple categories", () => {
    const query = buildOverpassQuery(
      BBOX,
      [
        { id: 1, osmTags: [{ key: "shop", value: "supermarket" }] },
        { id: 2, osmTags: [{ key: "amenity", value: "pharmacy" }] },
      ],
      25
    );

    expect(query).toContain('node["shop"="supermarket"]');
    expect(query).toContain('node["amenity"="pharmacy"]');
  });

  it("unions multiple OSM tags within a single category (e.g. Hypermarket)", () => {
    const query = buildOverpassQuery(
      BBOX,
      [
        {
          id: 1,
          osmTags: [
            { key: "shop", value: "supermarket" },
            { key: "shop", value: "department_store" },
          ],
        },
      ],
      25
    );

    expect(query).toContain('node["shop"="supermarket"]');
    expect(query).toContain('node["shop"="department_store"]');
  });

  it("escapes double quotes in tag values", () => {
    const query = buildOverpassQuery(BBOX, [{ id: 1, osmTags: [{ key: "shop", value: 'weird"value' }] }], 25);
    expect(query).toContain('shop"="weird\\"value"');
  });

  it("produces an empty union body (still valid QL) when given no categories", () => {
    const query = buildOverpassQuery(BBOX, [], 25);
    expect(query).toContain("(\n);");
  });
});
