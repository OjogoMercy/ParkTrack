import { PutVendorProfile } from "@/contracts/api";
import {
  errorResponse,
  invalidInputResponse,
  requireRole,
} from "@/server/auth";
import { upsertVendorProfile } from "@/server/vendors";

/**
 * PUT /api/me/vendor — { businessName, payoutBank?, payoutAccountName?,
 * payoutAccountLast4? }: turns a sender into a vendor (S12 Business) or
 * updates their business details. Only the last 4 digits of the payout
 * account are ever sent or kept (real payouts are post-pilot, PAY-7).
 * 200 Profile. Errors: 400 invalid_input, 401 signed_out, 403 wrong_role
 * (staff accounts aren't vendors).
 */
export async function PUT(request: Request): Promise<Response> {
  try {
    const user = await requireRole("SENDER");
    const parsed = PutVendorProfile.body.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return invalidInputResponse(parsed.error);
    const profile = await upsertVendorProfile(user.id, {
      businessName: parsed.data.businessName,
      payoutBank: parsed.data.payoutBank ?? null,
      payoutAccountName: parsed.data.payoutAccountName ?? null,
      payoutAccountLast4: parsed.data.payoutAccountLast4 ?? null,
    });
    return Response.json(PutVendorProfile.response.parse(profile), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
