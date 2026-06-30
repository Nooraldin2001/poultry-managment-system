// Placeholder API client.
//
// IMPORTANT: This does NOT call any backend yet. It documents the seam where the
// future Django REST client will live.
//
// Production data hygiene (Phase 4A):
//   `useMock` is derived from the central `IS_MOCK_MODE` helper (services/config.ts),
//   which reads `VITE_USE_MOCK_DATA` and is FORCED OFF in production builds. Mock
//   data is only enabled when a developer explicitly sets VITE_USE_MOCK_DATA=true
//   in a non-production (dev) build.
//
//   When live-API mode is active but a given endpoint is not implemented yet, the
//   service layer (services/index.ts) returns controlled empty results — it must
//   NEVER silently fall back to mock/demo data in production.

import { API_BASE_URL, IS_MOCK_MODE } from "@/services/config";

export const API_CONFIG = {
  /** Base URL for the Django REST API (e.g. https://poultryhero.solutions/api). */
  baseUrl: API_BASE_URL,
  /** Whether the app is backed by mock data. Always false in production builds. */
  useMock: IS_MOCK_MODE,
};

if (!API_CONFIG.useMock && typeof console !== "undefined") {
  // Live-API mode: the real HTTP client is not implemented yet. Screens that are
  // not wired to the backend show clean empty states (never demo data).
  console.info(
    "[poultry-hero] Live-API mode (VITE_USE_MOCK_DATA is off). Screens without a " +
      "wired endpoint show empty states; no demo data is rendered.",
  );
}

/** Not implemented yet — real HTTP client comes with the frontend integration phase. */
export async function request<T>(_path: string, _init?: RequestInit): Promise<T> {
  throw new ApiUnavailableError(
    "API client not implemented yet. This endpoint has no live backend wiring.",
  );
}

/** Thrown when a live endpoint is requested but not yet implemented/reachable. */
export class ApiUnavailableError extends Error {
  constructor(message = "API unavailable") {
    super(message);
    this.name = "ApiUnavailableError";
  }
}
