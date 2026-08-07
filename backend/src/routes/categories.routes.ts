import { Router } from "express";
import * as categoriesController from "../controllers/categories.controller";

export const categoriesRouter = Router();

categoriesRouter.get("/", categoriesController.list);
