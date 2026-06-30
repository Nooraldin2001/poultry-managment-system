// Placeholder API client.
//
// IMPORTANT: This does NOT call any backend yet. It only documents the seam
// where the future Django REST client will live. The mock services in
// services/mock/ currently fulfil all data needs.
//
// When the backend exists, implement `request()` with fetch + auth headers +
// tenant scoping, and swap the mock services for real ones in services/index.ts.

export const API_CONFIG = {
  /** Base URL for the future Django REST API (e.g. import.meta.env.VITE_API_URL). */
  baseUrl: "" as string,
  /** Whether the app is currently backed by mock data. */
  useMock: true as boolean,
};

/** Not implemented yet — real HTTP client comes with the Django backend phase. */
export async function request<T>(_path: string, _init?: RequestInit): Promise<T> {
  throw new Error(
    "API client not implemented yet. Services currently use mock data (services/mock/).",
  );
}
