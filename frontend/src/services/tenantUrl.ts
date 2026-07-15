/** Tenant subdomain URL + host-aware API base resolution (production multi-tenant). */

const DEFAULT_TENANT_BASE_DOMAIN = "poultryhero.solutions";
const RESERVED_SUBDOMAINS = new Set(["www", "admin", "api", "static", "media"]);

export function getTenantBaseDomain(): string {
  const raw = (import.meta.env.VITE_TENANT_BASE_DOMAIN ?? DEFAULT_TENANT_BASE_DOMAIN)
    .toString()
    .trim()
    .toLowerCase()
    .replace(/^\.+/, "");
  return raw || DEFAULT_TENANT_BASE_DOMAIN;
}

/** Full HTTPS URL for a company workspace, e.g. https://firstview.poultryhero.solutions */
export function getTenantUrl(subdomain: string): string {
  const clean = subdomain.trim().toLowerCase();
  const baseDomain = getTenantBaseDomain();
  return `https://${clean}.${baseDomain}`;
}

export type AppHostKind = "superadmin" | "tenant" | "root" | "local";

export function getAppHostKind(): AppHostKind {
  if (typeof window === "undefined") return "local";
  const host = window.location.hostname.toLowerCase();
  const base = getTenantBaseDomain();

  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost")) {
    return "local";
  }
  if (host === base) return "root";
  if (host === `www.${base}`) return "root";
  if (host === `admin.${base}`) return "superadmin";
  if (host.endsWith(`.${base}`)) return "tenant";
  return "local";
}

/** Subdomain label from current host, or null on admin/root/local. */
export function getTenantSubdomainFromHost(): string | null {
  if (typeof window === "undefined") return null;
  const host = window.location.hostname.toLowerCase();
  const base = getTenantBaseDomain();
  if (!host.endsWith(`.${base}`)) return null;
  const prefix = host.slice(0, -(base.length + 1));
  const label = prefix.split(".").pop() ?? "";
  if (!label || RESERVED_SUBDOMAINS.has(label)) return null;
  return label;
}

/**
 * Resolve API base URL for the current browser host.
 * Tenant subdomains MUST call same-origin /api so Django receives the Host header.
 */
export function resolveApiBase(): string {
  const envBase = (import.meta.env.VITE_API_BASE ?? "").toString().trim();
  if (typeof window === "undefined") {
    return envBase.replace(/\/$/, "") || "http://localhost:8000/api";
  }

  const host = window.location.hostname.toLowerCase();
  const origin = window.location.origin;
  const base = getTenantBaseDomain();

  const isProductionDomain =
    host === base ||
    host === `www.${base}` ||
    host === `admin.${base}` ||
    host.endsWith(`.${base}`);

  const isTenantSubdomain =
    host.endsWith(`.${base}`) &&
    !RESERVED_SUBDOMAINS.has(host.slice(0, -(base.length + 1)).split(".").pop() ?? "") &&
    host !== base;

  if (isTenantSubdomain) {
    return `${origin}/api`;
  }

  if (host === `admin.${base}`) {
    return `${origin}/api`;
  }

  if (envBase) {
    return envBase.replace(/\/$/, "");
  }

  if (isProductionDomain) {
    return `${origin}/api`;
  }

  return "http://localhost:8000/api";
}
