import { Router } from "express";
import * as marketsController from "../controllers/markets.controller";

export const marketsRouter = Router();

marketsRouter.post("/preview-boundary", marketsController.previewBoundary);
marketsRouter.post("/", marketsController.create);
marketsRouter.get("/", marketsController.list);
marketsRouter.get("/:id/status", marketsController.status);
marketsRouter.get("/:id", marketsController.dashboard);
