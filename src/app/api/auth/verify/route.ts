import { AuthVerify } from "@/contracts/api";
import { errorResponse, invalidInputResponse, verifyOtp } from "@/server/auth";

/**
 * POST /api/auth/verify — checks the sign-in code and signs the person in
 * (AUTH-2). Body: { phone, code }. One sign-in for everyone (Q45): a new
 * phone becomes a USER account; staff accounts sign in the same way and the
 * sign-in page sends them to their console.
 *
 * Errors: 400 invalid_input / invalid_phone / otp_missing / otp_expired /
 * otp_wrong (with attemptsLeft); 429 otp_locked; 403 account_deactivated.
 */
export async function POST(request: Request): Promise<Response> {
  const parsed = AuthVerify.body.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return invalidInputResponse(parsed.error);
  const { phone, code } = parsed.data;
  try {
    const result = await verifyOtp(phone, code);
    return Response.json(AuthVerify.response.parse(result), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
