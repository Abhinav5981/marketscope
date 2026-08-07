import { Router } from "express";
import * as portfolioController from "../controllers/portfolio.controller";
import { uploadPortfolioFile } from "../middleware/uploadMiddleware";

export const portfolioRouter = Router();

portfolioRouter.post("/upload", uploadPortfolioFile, portfolioController.upload);
portfolioRouter.get("/", portfolioController.list);
