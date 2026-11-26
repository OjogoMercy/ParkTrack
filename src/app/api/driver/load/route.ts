import { errorResponse, requireRole } from "@/server/auth";
import { driverLoadFor } from "@/server/trips";

/**
 * GET /api/driver/load — the signed-in driver's current load, grouped by
 * stop in route order, plus the manifest token once accepted (D01, D02,
 * D05; DRV-3, DRV-6). `trip: null` when nothing is assigned.
 * Errors: 401 signed_out, 403 wrong_role.
 */
export async function GET(): Promise<Response> {
  try {
    const driver = await requireRole("DRIVER");
    return Response.json(await driverLoadFor(driver.id), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
