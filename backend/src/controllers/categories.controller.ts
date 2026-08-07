import type { Request, Response } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { listCategories } from "../services/categoryService";

export const list = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json(await listCategories());
});
