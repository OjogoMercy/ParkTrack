import { GetEarnings } from "@/contracts/api";
import type { ApiError } from "@/contracts/primitives";
import { AuthError, invalidInputResponse, requireRole } from "@/server/auth";
import { driverEarnings } from "@/server/ledger";

/**
 * GET /api/ledger/DRIVER/earnings?period=week|month — D06 for the signed-in
 * driver. Only the DRIVER account has earnings (404 for the others).
 * Errors: 400 invalid_input, 401 signed_out, 403 wrong_role.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ account: string }> },
): Promise<Response> {
  const { account } = await params;
  if (account !== "DRIVER") return new Response(null, { status: 404 });
  const query = GetEarnings.query.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  );
  if (!query.success) return invalidInputResponse(query.error);
  try {
    const user = await requireRole("DRIVER");
    const view = await driverEarnings(user.id, query.data.period);
    return Response.json(GetEarnings.response.parse(view), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof AuthError) return error.toResponse();
    console.error("[ledger] earnings", error);
    const body: ApiError = {
      error: {
        code: "server_error",
        message: "Couldn't load your earnings. Try again in a moment.",
      },
    };
    return Response.json(body, { status: 500 });
  }
}
