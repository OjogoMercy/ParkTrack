import { CreateParcel, ListMyParcels } from "@/contracts/api";
import type { ApiError } from "@/contracts/primitives";
import {
  AuthError,
  enforceRateLimit,
  errorResponse,
  invalidInputResponse,
  requireRole,
} from "@/server/auth";
import { createBooking, listMyParcels } from "@/server/booking";
import { getPark } from "@/server/parks";
import { resolveHost } from "@/server/parks/host";

/** Plenty for a busy vendor; stops a script filling the parcels table. */
const BOOKINGS_PER_HOUR = { limit: 30, windowSeconds: 60 * 60 };

/**
 * POST /api/parcels — S03 "Review": creates the unpaid booking (DRAFT) for
 * the signed-in sender at the park of this subdomain (BOOK-1). Body is the
 * contract's BookingInput; the price is worked out on the server.
 *
 * 201 { parcel, quote }. Errors: 400 invalid_input / invalid_booking /
 * prohibited_item / pod_too_high (with fields), 401 signed_out, 403
 * wrong_role (staff book walk-ins from the counter), 404 park_not_found /
 * route_not_found, 429 rate_limited.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const user = await requireRole("SENDER");
    const target = resolveHost(
      request.headers.get("host") ?? "",
      process.env.ROOT_DOMAIN || "localhost:3000",
    );
    const park = target.kind === "park" ? await getPark(target.slug) : null;
    if (!park) {
      const body: ApiError = {
        error: {
          code: "park_not_found",
          message: "Book from your park's own page.",
        },
      };
      return Response.json(body, { status: 404 });
    }

    const parsed = CreateParcel.body.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return invalidInputResponse(parsed.error);

    await enforceRateLimit("booking", user.id, BOOKINGS_PER_HOUR);
    const result = await createBooking(parsed.data, {
      originParkId: park.id,
      senderId: user.id,
      createdBy: "SENDER",
      createdByUserId: user.id,
    });
    return Response.json(CreateParcel.response.parse(result), {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof AuthError) return error.toResponse();
    return errorResponse(error);
  }
}

/**
 * GET /api/parcels?tab=active|delivered|drafts — the sender's parcels
 * (S08), newest first, with vendor totals for vendors. 400 invalid_input,
 * 401 signed_out.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const user = await requireRole();
    const query = ListMyParcels.query.safeParse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    if (!query.success) return invalidInputResponse(query.error);
    const result = await listMyParcels(user.id, query.data.tab);
    return Response.json(ListMyParcels.response.parse(result), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
