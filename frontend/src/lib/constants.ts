// Mirrors backend/src/config/constants.ts MAX_MARKET_AREA_SQ_KM — duplicated
// for the same reason as geo.ts (see README "Architecture decisions"). The
// backend re-validates this independently; this copy only drives the UI
// (live badge + disabling "Create Market").
export const MAX_MARKET_AREA_SQ_KM = 30;
