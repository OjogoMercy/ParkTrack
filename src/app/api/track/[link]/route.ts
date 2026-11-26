import type { ApiError } from "@/contracts/primitives";
import { errorResponse } from "@/server/auth";
import { trackingForLink } from "@/server/tracking";

/**
 * GET /api/track/:link — what the recipient sees through their signed link
 * (R01–R03): ETA to their stop, never the driver's position (RD-1); after
 * arrival the park, bay and dues. Errors: 404 link_not_found (malformed,
 * expired or revoked link).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ link: string }> },
): Promise<Response> {
  try {
    const { link } = await params;
    const view = await trackingForLink(link);
    if (!view) {
      const body: ApiError = {
        error: {
          code: "link_not_found",
          message:
            "This tracking link isn’t valid any more. Ask the sender for a new one.",
        },
      };
      return Response.json(body, { status: 404 });
    }
    return Response.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
