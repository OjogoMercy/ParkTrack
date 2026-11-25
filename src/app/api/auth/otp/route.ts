import { AuthOtp } from "@/contracts/api";
import {
  errorResponse,
  clientIp,
  enforceRateLimit,
  invalidInputResponse,
  RATE_LIMITS,
  sendOtp,
  sendStaffOtp,
} from "@/server/auth";
import { resolveHost } from "@/server/parks/host";

/**
 * POST /api/auth/otp — sends a 6-digit sign-in code (AUTH-1).
 * Body: { phone, channel?: "WHATSAPP" | "SMS" } (WhatsApp by default).
 * On the console host (app.) only staff phones get a code.
 *
 * Limits: 5 codes per phone per hour, 20 requests per IP per hour, and 30 s
 * between codes on the same channel.
 *
 * Errors: 400 invalid_input / invalid_phone; 403 not_staff (console);
 * 429 otp_resend_too_soon / otp_rate_limited / rate_limited, each with
 * retryInSeconds and a Retry-After header.
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
    await enforceRateLimit(
      "otp-ip",
      clientIp(request.headers),
      RATE_LIMITS.otpPerIp,
    );
    const { phone, channel } = parsed.data;
    const result = staffOnly
      ? await sendStaffOtp(phone, channel)
      : await sendOtp(phone, channel);
    return Response.json(AuthOtp.response.parse(result), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
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
