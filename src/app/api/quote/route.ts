import { GetQuote } from "@/contracts/api";
import type { ApiError } from "@/contracts/primitives";
import { invalidInputResponse } from "@/server/auth";
import { ParcelError, quote } from "@/server/parcels";

/**
 * GET /api/quote?routeId&size&podKobo — the sender's total for a route and
 * size (BOOK-4): fare + ₦150 service fee, pay-on-delivery checked against
 * the pilot limit. Used by S03's live total (S01 renders its estimates on
 * the server). Errors: 400 invalid_input / pod_too_high, 404
 * route_not_found.
 */
export async function GET(request: Request): Promise<Response> {
  const parsed = GetQuote.query.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  );
  if (!parsed.success) return invalidInputResponse(parsed.error);
  try {
    const result = await quote(parsed.data);
    return Response.json(GetQuote.response.parse(result), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof ParcelError) return error.toResponse();
    console.error("[quote]", error);
    const body: ApiError = {
      error: {
        code: "server_error",
        message: "Couldn't work out the price. Try again in a moment.",
      },
    };
    return Response.json(body, { status: 500 });
  }
}
