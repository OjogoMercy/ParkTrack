import { AuthSignout } from "@/contracts/api";
import { errorResponse, signOut } from "@/server/auth";

/** POST /api/auth/signout — clears the session cookie. */
export async function POST(): Promise<Response> {
  try {
    await signOut();
    return Response.json(AuthSignout.response.parse({ ok: true }), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
