import type { BoundingBox } from "../../lib/geo";

export interface OsmTag {
  key: string;
  value: string;
}

export interface CategoryForQuery {
  id: number;
  osmTags: OsmTag[];
}

function escapeOverpassValue(value: string): string {
  // OSM tag keys/values are our own seeded data (see prisma/seed.ts), not
  // user input, but escaping defensively costs nothing and avoids a broken
  // query if a tag value ever contains a quote.
  return value.replace(/"/g, '\\"');
}

/**
 * Builds an Overpass QL query that finds nodes/ways tagged with any of the
 * given categories' OSM tags, restricted to the given bounding box.
 * Multiple categories (and a category with multiple tags, e.g. Hypermarket)
 * are combined with a union — Overpass evaluates each clause independently
 * and unions the results inside the outer `(...)` block.
 */
export function buildOverpassQuery(bbox: BoundingBox, categories: CategoryForQuery[], timeoutS: number): string {
  const bboxClause = `${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng}`;

  const tagClauses = categories.flatMap((category) =>
    category.osmTags.flatMap((tag) => {
      const filter = `["${tag.key}"="${escapeOverpassValue(tag.value)}"]`;
      return [`node${filter}(${bboxClause});`, `way${filter}(${bboxClause});`];
    })
  );

  return [`[out:json][timeout:${timeoutS}];`, "(", ...tagClauses, ");", "out center tags;"].join("\n");
}
