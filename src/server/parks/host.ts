import { ParkSlug, RESERVED_SLUGS } from "@/contracts/primitives";

/**
 * Host → which part of the app serves it (PRD §5.3, Scope 02 routing model).
 *
 *   {slug}.parktrack.ng  /  {slug}.localhost:3000   → park pages  (/sites/{slug}/…)
 *   app.parktrack.ng     /  app.localhost:3000      → staff console (/console/…)
 *   parktrack.ng, www., anything else (IPs, previews) → public root (/, /t, /collect, /pay)
 *   reserved (admin, api) or malformed subdomains    → "park not found" (S13)
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
  | { action: "rewrite"; pathname: string }
  | { action: "not_found" };

/** Internal route trees that must only be reached through their own host. */
const INTERNAL_PREFIXES = ["/sites", "/console", "/not-found-park"] as const;

const startsWithSegment = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

/**
 * What the proxy should do with a request. `pathname` excludes the query.
 * API routes and static assets never reach this (proxy matcher).
 */
export function routeRequest(
  host: string,
  pathname: string,
  rootDomain: string,
): RouteDecision {
  const target = resolveHost(host, rootDomain);
  const internal = INTERNAL_PREFIXES.some((p) =>
    startsWithSegment(pathname, p),
  );
  const suffix = pathname === "/" ? "" : pathname;

  switch (target.kind) {
    case "root":
      // parktrack.ng/sites/ogbomoso would duplicate the park page; hide internals.
      return internal ? { action: "not_found" } : { action: "next" };
    case "console":
      if (startsWithSegment(pathname, "/console"))
        return { action: "rewrite", pathname };
      return internal
        ? { action: "not_found" }
        : { action: "rewrite", pathname: `/console${suffix}` };
    case "park":
      return internal
        ? { action: "not_found" }
        : { action: "rewrite", pathname: `/sites/${target.slug}${suffix}` };
    case "unknown":
      return { action: "rewrite", pathname: "/not-found-park" };
  }
}

/** Absolute URL of a park's home page, e.g. "https://ogbomoso.parktrack.ng". */
export function parkUrl(slug: string, rootDomain: string): string {
  const local =
    /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(rootDomain) ||
    rootDomain.endsWith(".localhost");
  return `${local ? "http" : "https"}://${slug}.${rootDomain}`;
}

/** Display form of a park host: "ogbomoso.parktrack.ng" (no port, no scheme). */
export function parkHostLabel(slug: string, rootDomain: string): string {
  return `${slug}.${hostnameOf(rootDomain)}`;
}
