import { Router } from "express";
import * as locationsController from "../controllers/locations.controller";

export const locationsRouter = Router();

locationsRouter.get("/countries", locationsController.countries);
locationsRouter.get("/countries/:countryId/states", locationsController.statesForCountry);
locationsRouter.get("/states/:stateId/cities", locationsController.citiesForState);
