import { useAuth } from "@/state/authStore";

/** Re-export auth hook for screens and services. */
export function useAuthHook() {
  return useAuth();
}
