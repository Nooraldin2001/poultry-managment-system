import type { CurrentUser } from "@/shared/types/auth";
import { getTenantBaseDomain } from "@/services/tenantUrl";

const RESERVED_SUBDOMAINS = new Set(["www", "admin", "api", "static", "media"]);

export type HostContext =
  | { kind: "super_admin"; hostname: string }
  | { kind: "tenant"; hostname: string; subdomain: string }
  | { kind: "local_development"; hostname: string; subdomain?: string }
  | { kind: "invalid"; hostname: string };

export function resolveHostContext(hostname?: string): HostContext {
  const host = (hostname ?? (typeof window !== "undefined" ? window.location.hostname : "localhost"))
    .split(":")[0]
    .trim()
    .toLowerCase();
  const base = getTenantBaseDomain();

  if (host === "localhost" || host === "127.0.0.1") {
    return { kind: "local_development", hostname: host };
  }
  if (host.endsWith(".localhost")) {
    const subdomain = host.slice(0, -".localhost".length).split(".").pop() || undefined;
    return { kind: "local_development", hostname: host, subdomain };
  }
  if (host === base || host === `www.${base}` || host === `admin.${base}`) {
    return { kind: "super_admin", hostname: host };
  }
  if (host.endsWith(`.${base}`)) {
    const subdomain = host.slice(0, -(base.length + 1)).split(".").pop() ?? "";
    if (!subdomain || RESERVED_SUBDOMAINS.has(subdomain)) {
      return { kind: "invalid", hostname: host };
    }
    return { kind: "tenant", hostname: host, subdomain };
  }
  return { kind: "invalid", hostname: host };
}

export function getTokenStorageNamespace(ctx: HostContext = resolveHostContext()): string {
  if (ctx.kind === "tenant") return `tenant:${ctx.subdomain}`;
  if (ctx.kind === "local_development" && ctx.subdomain) return `tenant:${ctx.subdomain}`;
  return "super_admin";
}

export function isSessionCompatibleWithHost(user: CurrentUser, ctx: HostContext = resolveHostContext()): boolean {
  if (ctx.kind === "super_admin") {
    return user.is_superuser === true && user.company === null;
  }
  if (ctx.kind === "tenant") {
    return !user.is_superuser && user.company?.subdomain === ctx.subdomain;
  }
  if (ctx.kind === "local_development") {
    if (ctx.subdomain) {
      return !user.is_superuser && user.company?.subdomain === ctx.subdomain;
    }
    return true;
  }
  return false;
}

export function incompatibleSessionMessage(ctx: HostContext): string {
  if (ctx.kind === "super_admin") {
    return "This account belongs to a company. Please sign in using the company’s dedicated link.";
  }
  if (ctx.kind === "tenant") {
    return "This session is not valid for this company workspace.";
  }
  return "This session is not valid for the current domain.";
}
