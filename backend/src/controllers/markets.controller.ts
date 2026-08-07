import type { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/asyncHandler";
import { createMarket, getMarketDashboard, getMarketStatus, listMarkets } from "../services/marketService";
import { previewBoundaryForCity } from "../services/boundaryService";
import { BadRequestError } from "../types/errors";

const boundarySchema = z.object({
  minLat: z.number(),
  minLng: z.number(),
  maxLat: z.number(),
  maxLng: z.number(),
});

const previewBoundarySchema = z.object({
  cityId: z.number().int().positive(),
});

const createMarketSchema = z.object({
  cityId: z.number().int().positive(),
  categoryIds: z.array(z.number().int().positive()).min(1, "Select at least one category."),
  boundary: boundarySchema,
});

function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new BadRequestError("Invalid request body.", result.error.flatten());
  }
  return result.data;
}

export const previewBoundary = asyncHandler(async (req: Request, res: Response) => {
  const { cityId } = parseBody(previewBoundarySchema, req.body);
  res.status(200).json(await previewBoundaryForCity(cityId));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const input = parseBody(createMarketSchema, req.body);
  const market = await createMarket(input);
  res.status(201).json(market);
});

export const list = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json(await listMarkets());
});

export const status = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(await getMarketStatus(req.params.id));
});

export const dashboard = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json(await getMarketDashboard(req.params.id));
});
