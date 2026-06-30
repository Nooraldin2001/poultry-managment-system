// Placeholder API client.
//
// IMPORTANT: This does NOT call any backend yet. It documents the seam where the
// future Django REST client will live. The mock services in services/mock/ still
// fulfil all data needs for local UI development.
//
// Production data hygiene (Phase 4):
//   `useMock` is now driven by the `VITE_USE_MOCK_DATA` env var and DEFAULTS TO
//   FALSE. Production builds (which do not set the flag) therefore declare
//   themselves as "live API" mode. Mock data is only enabled when a developer
//   explicitly sets VITE_USE_MOCK_DATA=true for local development.
//
//   NOTE / known limitation: the screens currently still import mock services
//   from services/index.ts regardless of this flag. Full live-API integration
//   (and removal of mock data from the production UI) is a tracked follow-up —
//   see docs/backend/PHASE_4_PURCHASES_IMPLEMENTATION_NOTES.md. When useMock is
//   false a console warning is emitted so it is never silently faked as real.

const env = import.meta.env;

function readMockFlag(): boolean {
  const raw = (env.VITE_USE_MOCK_DATA ?? "").toString().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

export const API_CONFIG = {
  /** Base URL for the Django REST API (e.g. https://poultryhero.solutions/api). */
  baseUrl: (env.VITE_API_BASE ?? "") as string,
  /** Whether the app is backed by mock data. Defaults to FALSE in production. */
  useMock: readMockFlag(),
};

if (!API_CONFIG.useMock && typeof console !== "undefined") {
  // We are in "live API" mode but the live client is not implemented yet.
  console.warn(
    "[poultry-hero] VITE_USE_MOCK_DATA is not enabled (live-API mode), but the " +
      "REST client is not implemented yet. Screens may still render development " +
      "mock data — this must not be treated as real production data.",
  );
}

/** Not implemented yet — real HTTP client comes with the frontend integration phase. */
export async function request<T>(_path: string, _init?: RequestInit): Promise<T> {
  throw new Error(
    "API client not implemented yet. Services currently use mock data (services/mock/).",
  );
}
