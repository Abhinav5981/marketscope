import type { Request, Response } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { listPortfolio, uploadPortfolio } from "../services/portfolioService";
import { BadRequestError } from "../types/errors";

export const upload = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    throw new BadRequestError("No file uploaded. Attach a .csv or .xlsx file as 'file'.");
  }
  const result = await uploadPortfolio(req.file.buffer, req.file.originalname);
  res.status(200).json(result);
});

export const list = asyncHandler(async (_req: Request, res: Response) => {
  const rows = await listPortfolio();
  res.status(200).json(rows);
});
