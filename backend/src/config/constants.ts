// Cost guardrail from the brief: a larger boundary means more Places-API
// calls (and cost) when discovery runs. The frontend disables "Create
// Market" above this, and the backend re-checks it server-side as
// defense-in-depth against a client that skips the check.
export const MAX_MARKET_AREA_SQ_KM = 30;

// Nominatim's usage policy (https://operations.osmfoundation.org/policies/nominatim/)
// asks for max 1 request/second and a descriptive User-Agent.
export const NOMINATIM_MIN_INTERVAL_MS = 1100;
export const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";
export const NOMINATIM_MAX_RETRIES = 3;

// Public Overpass instances enforce a shared rate limit and commonly 504 on
// heavy queries; we try a primary and one fallback mirror.
export const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
export const OVERPASS_QUERY_TIMEOUT_S = 25; // sent to Overpass itself via [timeout:N]
export const OVERPASS_HTTP_TIMEOUT_MS = 30_000; // client-side abort, slightly above the query timeout
export const OVERPASS_MAX_RETRIES_PER_ENDPOINT = 2;

export const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024; // 5MB is generous for a portfolio CSV/XLSX
