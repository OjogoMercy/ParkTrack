import type { Role } from "@/contracts/enums";

/**
 * Where people go after signing in. Pure, so the sign-in form (browser),
 * pages and src/proxy.ts can all use it.
 */

/** Console home for each staff role; a USER account has none (it goes to "/"). */
export function consoleHome(role: Role): string | null {
  switch (role) {
    case "AGENT":
      return "/console/counter";
    case "DRIVER":
      return "/console/driver";
    case "PARK_ADMIN":
      return "/console/park";
    case "PLATFORM_ADMIN":
      return "/console/platform";
    default:
      return null;
  }
}

/**
 * A `?next=` value that is safe to redirect to: a path on this site only.
 * Rejects full URLs, protocol-relative "//evil.com" and "/\evil.com", so the
 * sign-in page can't be used to send people elsewhere.
 */
export function safeNext(
  next: string | string[] | null | undefined,
): string | null {
  const value = Array.isArray(next) ? next[0] : next;
  if (!value || !value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/\\")) return null;
  if (/[\u0000-\u001f]/.test(value)) return null;
  return value;
}
