import { GetParcelDetail } from "@/contracts/api";
import type { ApiError } from "@/contracts/primitives";
import { ParcelCode } from "@/contracts/primitives";
import { errorResponse, requireRole } from "@/server/auth";
import { parcelDetailFor } from "@/server/tracking";

/**
 * GET /api/track/parcel/:code — the signed-in sender's parcel page data
 * (S09–S11, TRK-1): timeline from parcel events, driver, payments, proof of
 * delivery. Only the sender who booked it can read it; anyone else gets
 * the same 404 as a code that doesn't exist.
 * Errors: 401 signed_out, 404 parcel_not_found.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
): Promise<Response> {
  try {
    const user = await requireRole();
    const code = ParcelCode.safeParse((await params).code.toUpperCase());
    const detail = code.success
      ? await parcelDetailFor(code.data, user.id)
      : null;
    if (!detail) {
      const body: ApiError = {
        error: { code: "parcel_not_found", message: "Parcel not found." },
      };
      return Response.json(body, { status: 404 });
    }
    return Response.json(GetParcelDetail.response.parse(detail), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
