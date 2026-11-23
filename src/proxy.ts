import { NextResponse, type NextRequest } from "next/server";
import { routeRequest } from "@/server/parks/host";

/**
 * Subdomain routing (Next.js 16 "proxy", formerly middleware; Node runtime).
 *
 * Reads only the Host header and rewrites the URL: no database calls here.
 * Whether a park slug actually exists is checked by the park layout
 * (src/app/sites/[park]/layout.tsx), which shows "park not found" (S13).
 */
export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const rootDomain = process.env.ROOT_DOMAIN || "localhost:3000";
  const decision = routeRequest(host, request.nextUrl.pathname, rootDomain);

  if (decision.action === "next") return NextResponse.next();
  if (decision.action === "not_found") {
    return new NextResponse("Not found", { status: 404 });
  }
  const url = request.nextUrl.clone();
  url.pathname = decision.pathname;
  return NextResponse.rewrite(url);
}

export const config = {
  // Everything except API routes, Next internals and static files.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|woff2?)$).*)",
  ],
};
