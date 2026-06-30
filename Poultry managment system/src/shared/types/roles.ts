// Application mode + tenant role types.

/** Top-level app mode: SaaS operator vs. a tenant company workspace. */
export type AppMode = "superadmin" | "tenant";

/** Roles available inside a tenant workspace. */
export type TenantRole = "owner" | "accountant" | "cashier";
