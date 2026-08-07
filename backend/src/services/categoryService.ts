import { prisma } from "../lib/prismaClient";
import { NotFoundError } from "../types/errors";
import type { OsmTag } from "../integrations/overpass/queryBuilder";

export function listCategories() {
  return prisma.category.findMany({ orderBy: { name: "asc" } });
}

/** Fetches categories by id and shapes them for the Overpass query builder, which only needs id + osmTags. */
export async function getCategoriesForQuery(categoryIds: number[]) {
  const categories = await prisma.category.findMany({ where: { id: { in: categoryIds } } });

  const foundIds = new Set(categories.map((c) => c.id));
  const missing = categoryIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    throw new NotFoundError(`Unknown category id(s): ${missing.join(", ")}`);
  }

  return categories.map((c) => ({ id: c.id, osmTags: c.osmTags as unknown as OsmTag[] }));
}
