import type { BoundingBox } from "../lib/geo";

export interface Country {
  id: number;
  name: string;
  code: string;
}

export interface State {
  id: number;
  name: string;
  countryId: number;
}

export interface City {
  id: number;
  name: string;
  stateId: number;
}

export interface Category {
  id: number;
  name: string;
  osmTags: { key: string; value: string }[];
}

export type MarketStatus = "PENDING" | "DISCOVERING" | "READY" | "FAILED";

export interface Market {
  id: string;
  name: string;
  cityId: number;
  city: City;
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
  areaSqKm: number;
  status: MarketStatus;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DiscoveredStore {
  id: string;
  marketId: string;
  source: string;
  externalId: string;
  name: string;
  categoryId: number;
  category: Category;
  osmTag: string;
  latitude: number;
  longitude: number;
  address: string | null;
}

export interface PortfolioStore {
  id: string;
  storeName: string;
  address: string;
  city: string;
  state: string;
  country: string;
  category: string | null;
  latitude: number | null;
  longitude: number | null;
  geocoded: boolean;
  geocodeSource: string | null;
}

export interface MarketDashboard {
  market: Market & { categories: { category: Category }[] };
  discoveredStores: DiscoveredStore[];
  portfolioInside: PortfolioStore[];
  portfolioOutside: PortfolioStore[];
  portfolioUngeocoded: PortfolioStore[];
}

export interface BoundaryPreview {
  boundary: BoundingBox;
  areaSqKm: number;
  source: "nominatim" | "fallback";
}

export interface RowError {
  row: number;
  column: string;
  value: unknown;
  message: string;
}

export interface RowWarning {
  row: number;
  message: string;
}

export interface UploadPortfolioResult {
  insertedCount: number;
  rejectedCount: number;
  rowWarnings: RowWarning[];
  rowErrors: RowError[];
}
