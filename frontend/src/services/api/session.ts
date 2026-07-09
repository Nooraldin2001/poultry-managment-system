/** Single-flight session expiry handling — avoids redirect/refetch loops on repeated 401s. */

let sessionExpiredHandled = false;
let sessionExpiredHandler: (() => void) | null = null;

export function registerSessionExpiredHandler(handler: (() => void) | null): void {
  sessionExpiredHandler = handler;
}

export function resetSessionExpiredFlag(): void {
  sessionExpiredHandled = false;
}

/** Invoke logout redirect at most once until the user signs in again. */
export function notifySessionExpired(): void {
  if (sessionExpiredHandled) return;
  sessionExpiredHandled = true;
  sessionExpiredHandler?.();
}
