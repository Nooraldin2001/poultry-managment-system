// Central runtime configuration for API / mock mode.
//
// This is the SINGLE source of truth that decides whether the app shows
// development mock data or runs against the live backend. Everything else
// (the data/mock barrel, the service layer, and the screens) must derive its
// behaviour from `IS_MOCK_MODE` here — never re-read the env flag directly.
//
// Production data hygiene rule (Phase 4A):
//   * Mock/demo business data is shown ONLY when a developer explicitly opts in
//     with `VITE_USE_MOCK_DATA=true` AND the build is NOT a production build.
//   * In a production build (`import.meta.env.PROD === true`) mock mode is ALWAYS
//     off, even if the flag was somehow set — so a production bundle can never
//     display fake companies, revenue, customers, etc.
//   * When the flag is missing it defaults to false (live-API mode).

const env = import.meta.env;

function readMockFlag(): boolean {
  const raw = (env.VITE_USE_MOCK_DATA ?? "").toString().trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

/** True only in a production build (`vite build`). */
export const IS_PRODUCTION: boolean = env.PROD === true;

/**
 * Whether the UI should render local mock/demo data.
 *
 * Forced to `false` in production builds regardless of the env flag, so demo
 * data can never leak into a deployed bundle.
 */
export const IS_MOCK_MODE: boolean = readMockFlag() && !IS_PRODUCTION;

/** Build-time API base fallback (runtime uses resolveApiBase() in api/client.ts). */
export const API_BASE_URL: string = (env.VITE_API_BASE ?? "").toString();

export { getTenantUrl, getTenantBaseDomain, resolveApiBase, getAppHostKind, getTenantSubdomainFromHost } from "./tenantUrl";
export type { AppHostKind } from "./tenantUrl";
