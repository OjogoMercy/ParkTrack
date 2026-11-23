import { AuthVerify } from "@/contracts/api";
import { AuthError, invalidInputResponse, verifyOtp } from "@/server/auth";
import { getPark } from "@/server/parks";
import { resolveHost } from "@/server/parks/host";

/**
 * POST /api/auth/verify — checks the sign-in code and signs the person in
 * (AUTH-2). Body: { phone, code }. A new phone becomes a sender tied to the
 * park whose subdomain they're on (AUTH-3). Sets the session cookie on the
 * root domain, so the sign-in works on every park and on the console.
 *
 * Errors: 400 invalid_input / invalid_phone / otp_missing / otp_expired /
 * otp_wrong (with attemptsLeft); 429 otp_locked; 403 account_deactivated.
 */
export async function POST(request: Request): Promise<Response> {
  const parsed = AuthVerify.body.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return invalidInputResponse(parsed.error);

  const target = resolveHost(
    request.headers.get("host") ?? "",
    process.env.ROOT_DOMAIN || "localhost:3000",
  );
  const park = target.kind === "park" ? await getPark(target.slug) : null;

  try {
    const result = await verifyOtp(
      parsed.data.phone,
      parsed.data.code,
      park?.id,
    );
    return Response.json(AuthVerify.response.parse(result), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof AuthError) return error.toResponse();
    throw error;
  }
}
