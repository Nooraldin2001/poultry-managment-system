/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL for the Django REST API, e.g. https://poultryhero.solutions/api */
  readonly VITE_API_BASE?: string;
  /** "true" to use local mock data. Defaults to false (live API) in production. */
  readonly VITE_USE_MOCK_DATA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
