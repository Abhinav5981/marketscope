import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Fixed location list per the brief — Country -> State -> City is a
// dropdown, not free text, so it lives here rather than in a migration.
const LOCATIONS = [
  { country: "India", code: "IN", state: "Karnataka", city: "Bengaluru" },
  { country: "India", code: "IN", state: "Maharashtra", city: "Mumbai" },
  { country: "India", code: "IN", state: "Delhi", city: "New Delhi" },
];

// Category -> OSM tag mapping used by the Overpass query builder.
// Hypermarket has no clean OSM discriminator from Supermarket, so it maps to
// both `shop=supermarket` and `shop=department_store` as a best-effort proxy
// for "large format" — documented as a known limitation in the README.
const CATEGORIES: { name: string; osmTags: { key: string; value: string }[] }[] = [
  { name: "Supermarket", osmTags: [{ key: "shop", value: "supermarket" }] },
  {
    name: "Hypermarket",
    osmTags: [
      { key: "shop", value: "supermarket" },
      { key: "shop", value: "department_store" },
    ],
  },
  { name: "Grocery Store", osmTags: [{ key: "shop", value: "greengrocer" }] },
  { name: "Convenience Store", osmTags: [{ key: "shop", value: "convenience" }] },
  { name: "Pharmacy", osmTags: [{ key: "amenity", value: "pharmacy" }] },
];

async function main() {
  for (const loc of LOCATIONS) {
    const country = await prisma.country.upsert({
      where: { name: loc.country },
      update: {},
      create: { name: loc.country, code: loc.code },
    });

    const state = await prisma.state.upsert({
      where: { countryId_name: { countryId: country.id, name: loc.state } },
      update: {},
      create: { name: loc.state, countryId: country.id },
    });

    await prisma.city.upsert({
      where: { stateId_name: { stateId: state.id, name: loc.city } },
      update: {},
      create: { name: loc.city, stateId: state.id },
    });
  }

  for (const cat of CATEGORIES) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: { osmTags: cat.osmTags },
      create: { name: cat.name, osmTags: cat.osmTags },
    });
  }

  console.log("Seed complete:", {
    countries: LOCATIONS.length,
    categories: CATEGORIES.length,
  });
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
