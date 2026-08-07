import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "./client";
import type { BoundingBox } from "../lib/geo";
import type {
  BoundaryPreview,
  Category,
  City,
  Country,
  Market,
  MarketDashboard,
  MarketStatus,
  State,
  UploadPortfolioResult,
} from "../types";

export function useCountries() {
  return useQuery({ queryKey: ["countries"], queryFn: () => api.get<Country[]>("/locations/countries") });
}

export function useStates(countryId: number | null) {
  return useQuery({
    queryKey: ["states", countryId],
    queryFn: () => api.get<State[]>(`/locations/countries/${countryId}/states`),
    enabled: countryId !== null,
  });
}

export function useCities(stateId: number | null) {
  return useQuery({
    queryKey: ["cities", stateId],
    queryFn: () => api.get<City[]>(`/locations/states/${stateId}/cities`),
    enabled: stateId !== null,
  });
}

export function useCategories() {
  return useQuery({ queryKey: ["categories"], queryFn: () => api.get<Category[]>("/categories") });
}

export function useUploadPortfolio() {
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return api.post<UploadPortfolioResult>("/portfolio/upload", formData);
    },
  });
}

export function usePreviewBoundary() {
  return useMutation({
    mutationFn: (cityId: number) => api.post<BoundaryPreview>("/markets/preview-boundary", { cityId }),
  });
}

export interface CreateMarketInput {
  cityId: number;
  categoryIds: number[];
  boundary: BoundingBox;
}

export function useCreateMarket() {
  return useMutation({
    mutationFn: (input: CreateMarketInput) => api.post<Market>("/markets", input),
  });
}

export function useMarkets() {
  return useQuery({ queryKey: ["markets"], queryFn: () => api.get<Market[]>("/markets") });
}

const IN_PROGRESS_STATUSES: MarketStatus[] = ["PENDING", "DISCOVERING"];

/** Polls every 2s while the market is still being created; stops once READY/FAILED. */
export function useMarketStatus(marketId: string | undefined) {
  return useQuery({
    queryKey: ["marketStatus", marketId],
    queryFn: () => api.get<{ status: MarketStatus; errorMessage: string | null }>(`/markets/${marketId}/status`),
    enabled: !!marketId,
    refetchInterval: (query) => (IN_PROGRESS_STATUSES.includes(query.state.data?.status as MarketStatus) ? 2000 : false),
  });
}

export function useMarketDashboard(marketId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["marketDashboard", marketId],
    queryFn: () => api.get<MarketDashboard>(`/markets/${marketId}`),
    enabled: !!marketId && enabled,
  });
}
