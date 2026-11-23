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
 * Subdomain routing (Next.js 16 "proxy", formerly middleware; Node runtime),
 * plus the rolling refresh of the session cookie.
 *
 * Reads only the Host header and cookie: no database calls here.
 * Whether a park slug actually exists is checked by the park layout
 * (src/app/sites/[park]/layout.tsx), which shows "park not found" (S13).
 */
export async function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const rootDomain = process.env.ROOT_DOMAIN || "localhost:3000";
  const decision = routeRequest(host, request.nextUrl.pathname, rootDomain);

  if (decision.action === "not_found") {
    return new NextResponse("Not found", { status: 404 });
  }
  let response: NextResponse;
  if (decision.action === "next") {
    response = NextResponse.next();
  } else {
    const url = request.nextUrl.clone();
    url.pathname = decision.pathname;
    response = NextResponse.rewrite(url);
  }
  await refreshSession(request, response, rootDomain);
  return response;
}

/**
 * Rolling 30-day session: once the cookie is a day old, re-issue it so people
 * who keep using the app stay signed in. Only checks the signature here (no
 * database); getSession() still checks the account on every read.
 */
async function refreshSession(
  request: NextRequest,
  response: NextResponse,
  rootDomain: string,
) {
  const secret = process.env.AUTH_JWT_SECRET;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!secret || !token) return;
  const claims = await readSessionToken(token, secret);
  if (!claims || !needsRefresh(claims)) return;
  response.cookies.set(
    SESSION_COOKIE,
    await createSessionToken(claims.userId, secret),
    sessionCookieOptions(rootDomain),
  );
}

export const config = {
  // Everything except API routes, Next internals and static files.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|woff2?)$).*)",
  ],
};
