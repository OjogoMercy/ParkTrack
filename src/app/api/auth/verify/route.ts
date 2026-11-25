import { AuthVerify } from "@/contracts/api";
import {
  errorResponse,
  invalidInputResponse,
  verifyOtp,
  verifyStaffOtp,
} from "@/server/auth";
import { getPark } from "@/server/parks";
import { resolveHost } from "@/server/parks/host";

/**
 * POST /api/auth/verify — checks the sign-in code and signs the person in
 * (AUTH-2). Body: { phone, code }. On a park subdomain a new phone becomes a
 * sender tied to that park (AUTH-3); on the console (app.) only existing
 * staff can sign in. Sets the session cookie on the root domain, so the
 * sign-in works on every park and on the console.
 *
 * Errors: 400 invalid_input / invalid_phone / otp_missing / otp_expired /
 * otp_wrong (with attemptsLeft); 429 otp_locked; 403 account_deactivated /
 * not_staff (console).
 */
export async function POST(request: Request): Promise<Response> {
  const parsed = AuthVerify.body.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return invalidInputResponse(parsed.error);
  const { phone, code } = parsed.data;

  const target = resolveHost(
    request.headers.get("host") ?? "",
    process.env.ROOT_DOMAIN || "localhost:3000",
  );

  try {
    let result;
    if (target.kind === "console") {
      result = await verifyStaffOtp(phone, code);
    } else {
      const park = target.kind === "park" ? await getPark(target.slug) : null;
      result = await verifyOtp(phone, code, park?.id);
    }
    return Response.json(AuthVerify.response.parse(result), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
