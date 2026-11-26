import { NextResponse, type NextRequest } from "next/server";
import {
  createSessionToken,
  needsRefresh,
  readSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/server/auth/session";
import { routeRequest } from "@/server/parks/host";

/**
 * One domain (decision Q45): old park and app. subdomains redirect to the
 * main domain, signed-out visitors to the staff console are sent to sign in,
 * and the session cookie is refreshed (Next.js 16 "proxy", formerly
 * middleware; Node runtime).
 *
 * Reads only the Host header and cookie: no database calls here.
 */
export async function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const rootDomain = process.env.ROOT_DOMAIN || "localhost:3000";
  const decision = routeRequest(host, request.nextUrl.pathname, rootDomain);

  if (decision.action === "redirect") {
    const url = request.nextUrl.clone();
    url.pathname = decision.pathname;
    if (decision.toRoot) url.host = rootDomain;
    // Old addresses moved for good; the sign-in move is just a redirect.
    return NextResponse.redirect(url, decision.toRoot ? 308 : 307);
  }

  // Signature and expiry only (no database); getSession() still checks the
  // account on every read.
  const secret = process.env.AUTH_JWT_SECRET;
  const claims = secret
    ? await readSessionToken(request.cookies.get(SESSION_COOKIE)?.value, secret)
    : null;

  // No console page renders for a signed-out visitor: send them to sign in
  // and back to where they were going. (A signed-in person without a staff
  // role is sent home by the console itself.)
  const pathname = request.nextUrl.pathname;
  if (
    (pathname === "/console" || pathname.startsWith("/console/")) &&
    !claims
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/signin";
    url.search = `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next();

  // Rolling 30-day session: once the cookie is a day old, re-issue it so
  // people who keep using the app stay signed in.
  if (secret && claims && needsRefresh(claims)) {
    response.cookies.set(
      SESSION_COOKIE,
      await createSessionToken(claims.userId, secret),
      sessionCookieOptions(rootDomain),
    );
  }
  return response;
}

export const config = {
  // Everything except API routes, Next internals and static files.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|woff2?)$).*)",
  ],
};
