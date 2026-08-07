import type { CategoryForQuery } from "./queryBuilder";

export interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export interface OverpassResponse {
  elements: OverpassElement[];
}

export interface DiscoveredStoreCandidate {
  externalId: string;
  name: string;
  categoryId: number;
  osmTag: string;
  latitude: number;
  longitude: number;
  address: string | null;
}

function resolveCoordinates(el: OverpassElement): { lat: number; lon: number } | null {
  if (el.type === "node" && el.lat !== undefined && el.lon !== undefined) {
    return { lat: el.lat, lon: el.lon };
  }
  // Ways/relations only carry coordinates when the query used `out center`,
  // which we always request — but guard anyway in case of a malformed element.
  if (el.center) return el.center;
  return null;
}

function findMatchingCategory(
  tags: Record<string, string>,
  categories: CategoryForQuery[]
): { categoryId: number; osmTag: string } | null {
  for (const category of categories) {
    for (const tag of category.osmTags) {
      if (tags[tag.key] === tag.value) {
        return { categoryId: category.id, osmTag: `${tag.key}=${tag.value}` };
      }
    }
  }
  return null;
}

function buildAddress(tags: Record<string, string>): string | null {
  const parts = [tags["addr:housenumber"], tags["addr:street"], tags["addr:city"]].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

/**
 * Converts a raw Overpass response into candidate stores ready to persist.
 * Elements that resolve to a category not among the ones we queried for, or
 * that have no usable coordinates, are silently skipped — Overpass results
 * are expected to already match the query's tag filters, but this stays
 * defensive rather than assuming that's always true.
 */
export function parseOverpassResponse(
  response: OverpassResponse,
  categories: CategoryForQuery[]
): DiscoveredStoreCandidate[] {
  const candidates: DiscoveredStoreCandidate[] = [];

  for (const el of response.elements) {
    const coords = resolveCoordinates(el);
    if (!coords) continue;

    const tags = el.tags ?? {};
    const match = findMatchingCategory(tags, categories);
    if (!match) continue;

    candidates.push({
      externalId: `${el.type}/${el.id}`,
      name: tags.name?.trim() || "Unnamed store",
      categoryId: match.categoryId,
      osmTag: match.osmTag,
      latitude: coords.lat,
      longitude: coords.lon,
      address: buildAddress(tags),
    });
  }

  return candidates;
}
