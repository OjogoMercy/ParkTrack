import { ParkSlug, RESERVED_SLUGS } from "@/contracts/primitives";

/**
 * Host → what kind of address it is. Since decision Q45 everything is served
 * from the main domain; only the main domain (and www., IPs, previews) is
 * served directly, and the old addresses redirect to it (routeRequest):
 *
 *   {slug}.parktrack.ng  /  {slug}.localhost:3000   → old park address
 *   app.parktrack.ng     /  app.localhost:3000      → old console address
 *   parktrack.ng, www., anything else (IPs, previews) → the app
 *   reserved (admin, api) or malformed subdomains    → unknown
 *
 * Pure and dependency-free: src/proxy.ts imports it, so it must never pull in
 * the database or other server modules.
 */

export type HostKind =
  | { kind: "root" }
  | { kind: "console" }
  | { kind: "park"; slug: string }
  | { kind: "unknown"; label: string };

/** "Ogbomoso.ParkTrack.ng:443" → "ogbomoso.parktrack.ng" */
export function hostnameOf(host: string): string {
  return host.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
}

export function resolveHost(host: string, rootDomain: string): HostKind {
  const hostname = hostnameOf(host);
  const root = hostnameOf(rootDomain);
  if (!hostname || hostname === root || !hostname.endsWith(`.${root}`)) {
    // Apex, Vercel preview URLs, raw IPs: serve the public root.
    return { kind: "root" };
  }
  const label = hostname.slice(0, -(root.length + 1));
  if (label === "www") return { kind: "root" };
  if (label === "app") return { kind: "console" };
  if (label.includes(".")) return { kind: "unknown", label };
  if ((RESERVED_SLUGS as readonly string[]).includes(label))
    return { kind: "unknown", label };
  if (!ParkSlug.safeParse(label).success) return { kind: "unknown", label };
  return { kind: "park", slug: label };
}

export type RouteDecision =
  | { action: "next" }
  /**
   * Send the browser to `pathname` (query kept). `toRoot`: on the main
   * domain, because the request came in on an old subdomain.
   */
  | { action: "redirect"; pathname: string; toRoot: boolean };

/**
 * What the proxy should do with a request (decision Q45: one domain).
 * Everything is served from the main domain; the old addresses still work
 * and redirect there:
 *
 *   ogbomoso.parktrack.ng/        → parktrack.ng/parks/ogbomoso
 *   ogbomoso.parktrack.ng/send    → parktrack.ng/send
 *   app.parktrack.ng/counter      → parktrack.ng/console/counter
 *   admin.parktrack.ng/… (unknown)→ parktrack.ng/
 *   parktrack.ng/console/signin   → parktrack.ng/signin (one sign-in)
 *
 * `pathname` excludes the query. API routes and static assets never reach
 * this (proxy matcher).
 */
export function routeRequest(
  host: string,
  pathname: string,
  rootDomain: string,
): RouteDecision {
  const target = resolveHost(host, rootDomain);
  const suffix = pathname === "/" ? "" : pathname;

  switch (target.kind) {
    case "root":
      if (startsWithSegment(pathname, "/console/signin"))
        return { action: "redirect", pathname: "/signin", toRoot: false };
      return { action: "next" };
    case "console":
      return {
        action: "redirect",
        pathname: startsWithSegment(pathname, "/console")
          ? pathname
          : pathname === "/signin"
            ? "/signin"
            : `/console${suffix}`,
        toRoot: true,
      };
    case "park":
      return {
        action: "redirect",
        pathname: pathname === "/" ? parkPath(target.slug) : pathname,
        toRoot: true,
      };
    case "unknown":
      return { action: "redirect", pathname: "/", toRoot: true };
  }
}

const startsWithSegment = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

/** A park's page on the main domain: "/parks/ogbomoso". */
export function parkPath(slug: string): string {
  return `/parks/${slug}`;
}

/** Display form of a park's page: "parktrack.ng/parks/ogbomoso" (no scheme, no port). */
export function parkAddressLabel(slug: string, rootDomain: string): string {
  return `${hostnameOf(rootDomain)}${parkPath(slug)}`;
}
