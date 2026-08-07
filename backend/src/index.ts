import cors from "cors";
import express from "express";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import { portfolioRouter } from "./routes/portfolio.routes";
import { locationsRouter } from "./routes/locations.routes";
import { categoriesRouter } from "./routes/categories.routes";
import { marketsRouter } from "./routes/markets.routes";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/portfolio", portfolioRouter);
app.use("/api/locations", locationsRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/markets", marketsRouter);

// Must be registered last — Express identifies error-handling middleware by its 4-argument signature.
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`MarketScope backend listening on http://localhost:${env.port}`);
});
