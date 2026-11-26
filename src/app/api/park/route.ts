import { GetPark } from "@/contracts/api";
import type { ApiError } from "@/contracts/primitives";
import { errorResponse, invalidInputResponse } from "@/server/auth";
import { getParkPublic } from "@/server/parks";

/**
 * GET /api/park?slug=ogbomoso — one park's public page data (PARK-1): name,
 * address, opening hours and open-now, routes with fares by size, roadside
 * points, storage rules and counter location. Looked up by slug: everything
 * is on one domain (Q45), so the host no longer says which park.
 *
 * "Open now" is per request, so the response is never cached by clients.
 */
export async function GET(request: Request): Promise<Response> {
  const parsed = GetPark.query.safeParse({
    slug: new URL(request.url).searchParams.get("slug") ?? undefined,
  });
  if (!parsed.success) {
    return invalidInputResponse(
      parsed.error,
      "Say which park, e.g. ?slug=ogbomoso.",
    );
  }
  try {
    const park = await getParkPublic(parsed.data.slug);
    if (!park) {
      const body: ApiError = {
        error: {
          code: "park_not_found",
          message: "There's no ParkTrack park with that name.",
        },
      };
      return Response.json(body, { status: 404 });
    }
    return Response.json(GetPark.response.parse(park), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
