import { AuthOtp } from "@/contracts/api";
import {
  AuthError,
  invalidInputResponse,
  sendOtp,
  sendStaffOtp,
} from "@/server/auth";
import { resolveHost } from "@/server/parks/host";

/**
 * POST /api/auth/otp — sends a 6-digit sign-in code (AUTH-1).
 * Body: { phone, channel?: "WHATSAPP" | "SMS" } (WhatsApp by default).
 * On the console host (app.) only staff phones get a code.
 *
 * Errors: 400 invalid_input / invalid_phone; 403 not_staff (console);
 * 429 otp_resend_too_soon with retryInSeconds and a Retry-After header.
 * Per-phone and per-IP rate limits are added in sl8.
 */
export async function POST(request: Request): Promise<Response> {
  const parsed = AuthOtp.body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return invalidInputResponse(
      parsed.error,
      "Check the phone number and try again.",
    );
  }
  const staffOnly = isConsoleHost(request);

  try {
    const { phone, channel } = parsed.data;
    const result = staffOnly
      ? await sendStaffOtp(phone, channel)
      : await sendOtp(phone, channel);
    return Response.json(AuthOtp.response.parse(result), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof AuthError) return error.toResponse();
    throw error;
  }
}

function isConsoleHost(request: Request): boolean {
  return (
    resolveHost(
      request.headers.get("host") ?? "",
      process.env.ROOT_DOMAIN || "localhost:3000",
    ).kind === "console"
  );
}
