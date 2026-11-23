import { GetPark } from "@/contracts/api";
import type { ApiError } from "@/contracts/primitives";
import { getParkPublic } from "@/server/parks";
import { resolveHost } from "@/server/parks/host";

/**
 * GET /api/park — the park for the requesting subdomain (PARK-1): name,
 * address, opening hours and open-now, routes with fares by size, roadside
 * points, storage rules and counter location.
 *
 * API routes bypass src/proxy.ts, so the Host header is still the park's.
 * "Open now" is per request, so the response is never cached by clients.
 */
export async function GET(request: Request): Promise<Response> {
  const host = request.headers.get("host") ?? "";
  const target = resolveHost(host, process.env.ROOT_DOMAIN || "localhost:3000");
  const park = target.kind === "park" ? await getParkPublic(target.slug) : null;

  if (!park) {
    const body: ApiError = {
      error: {
        code: "park_not_found",
        message: "There's no ParkTrack park at this address.",
      },
    };
    return Response.json(body, { status: 404 });
  }

  return Response.json(GetPark.response.parse(park), {
    headers: { "Cache-Control": "no-store" },
  });
}
