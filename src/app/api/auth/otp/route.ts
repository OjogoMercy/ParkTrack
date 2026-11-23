import { AuthOtp } from "@/contracts/api";
import { AuthError, invalidInputResponse, sendOtp } from "@/server/auth";

/**
 * POST /api/auth/otp — sends a 6-digit sign-in code (AUTH-1).
 * Body: { phone, channel?: "WHATSAPP" | "SMS" } (WhatsApp by default).
 *
 * Errors: 400 invalid_input / invalid_phone; 429 otp_resend_too_soon with
 * retryInSeconds and a Retry-After header. Per-phone and per-IP rate limits
 * are added in sl8.
 */
export async function POST(request: Request): Promise<Response> {
  const parsed = AuthOtp.body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return invalidInputResponse(
      parsed.error,
      "Check the phone number and try again.",
    );
  }

  try {
    const result = await sendOtp(parsed.data.phone, parsed.data.channel);
    return Response.json(AuthOtp.response.parse(result), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof AuthError) return error.toResponse();
    throw error;
  }
}
