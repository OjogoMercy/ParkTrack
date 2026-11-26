import { errorResponse, requireRole } from "@/server/auth";
import { acceptLoad } from "@/server/trips";

/**
 * POST /api/trips/:id/accept — the driver accepts their load (DRV-4): the
 * trip goes on the road, its manifest is created and every ASSIGNED parcel
 * becomes IN_TRANSIT. Safe to repeat. Returns the updated DriverLoad.
 * Errors: 401 signed_out, 403 wrong_role / not_your_trip, 404
 * trip_not_found, 409 trip_closed / nothing_to_accept.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const driver = await requireRole("DRIVER");
    const { id } = await params;
    return Response.json(await acceptLoad(id, driver.id), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
