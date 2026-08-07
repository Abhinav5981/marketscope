import type { Request, Response } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { listCitiesForState, listCountries, listStatesForCountry } from "../services/locationService";
import { BadRequestError } from "../types/errors";

function parseIdParam(raw: string, paramName: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new BadRequestError(`Invalid ${paramName}: "${raw}"`);
  }
  return id;
}

export const countries = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json(await listCountries());
});

export const statesForCountry = asyncHandler(async (req: Request, res: Response) => {
  const countryId = parseIdParam(req.params.countryId, "countryId");
  res.status(200).json(await listStatesForCountry(countryId));
});

export const citiesForState = asyncHandler(async (req: Request, res: Response) => {
  const stateId = parseIdParam(req.params.stateId, "stateId");
  res.status(200).json(await listCitiesForState(stateId));
});
