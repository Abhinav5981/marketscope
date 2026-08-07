import { prisma } from "../lib/prismaClient";
import { NotFoundError } from "../types/errors";

export function listCountries() {
  return prisma.country.findMany({ orderBy: { name: "asc" } });
}

export async function listStatesForCountry(countryId: number) {
  const country = await prisma.country.findUnique({ where: { id: countryId } });
  if (!country) throw new NotFoundError(`Country ${countryId} not found`);
  return prisma.state.findMany({ where: { countryId }, orderBy: { name: "asc" } });
}

export async function listCitiesForState(stateId: number) {
  const state = await prisma.state.findUnique({ where: { id: stateId } });
  if (!state) throw new NotFoundError(`State ${stateId} not found`);
  return prisma.city.findMany({ where: { stateId }, orderBy: { name: "asc" } });
}

export async function getCityWithLocation(cityId: number) {
  const city = await prisma.city.findUnique({
    where: { id: cityId },
    include: { state: { include: { country: true } } },
  });
  if (!city) throw new NotFoundError(`City ${cityId} not found`);
  return city;
}
