import { GetLedger } from "@/contracts/api";
import type { ApiError } from "@/contracts/primitives";
import { AuthError, invalidInputResponse, requireRole } from "@/server/auth";
import { ledger } from "@/server/ledger";

/**
 * GET /api/ledger/:account?from&to&accountRefId — P03 ledger, balances for
 * D06 (drivers) and S08 (vendors). Who may read what:
 *   PARK      park admins: their own park only; platform admins: any park
 *   DRIVER    drivers: themselves; platform admins: anyone
 *   VENDOR, SENDER   that person; platform admins: anyone
 *   PLATFORM, INSURER, HELD   platform admins only
 * Errors: 400 invalid_input, 401 signed_out, 403 wrong_role / not_yours.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ account: string }> },
): Promise<Response> {
  const url = new URL(request.url);
  const parsed = GetLedger.params.safeParse(await params);
  const query = GetLedger.query.safeParse(
    Object.fromEntries(url.searchParams.entries()),
  );
  if (!parsed.success) return invalidInputResponse(parsed.error);
  if (!query.success) return invalidInputResponse(query.error);
  const { account } = parsed.data;

  try {
    const user = await requireRole();
    const admin = user.role === "PLATFORM_ADMIN";
    let accountRefId = query.data.accountRefId;
    if (!admin) {
      if (account === "PARK" && user.role === "PARK_ADMIN" && user.park) {
        accountRefId = user.park.id;
      } else if (
        (account === "DRIVER" && user.role === "DRIVER") ||
        ((account === "VENDOR" || account === "SENDER") && user.role === "USER")
      ) {
        accountRefId = user.id;
      } else {
        throw new AuthError("not_yours", "You can't see this ledger.", 403);
      }
      if (query.data.accountRefId && query.data.accountRefId !== accountRefId) {
        throw new AuthError("not_yours", "You can't see this ledger.", 403);
      }
    }
    const view = await ledger({
      account,
      accountRefId,
      from: query.data.from ? new Date(query.data.from) : undefined,
      to: query.data.to ? new Date(query.data.to) : undefined,
    });
    return Response.json(GetLedger.response.parse(view), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof AuthError) return error.toResponse();
    console.error("[ledger] read", error);
    const body: ApiError = {
      error: {
        code: "server_error",
        message: "Couldn't load the ledger. Try again in a moment.",
      },
    };
    return Response.json(body, { status: 500 });
  }
}
