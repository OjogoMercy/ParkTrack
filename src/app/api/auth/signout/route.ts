import { AuthSignout } from "@/contracts/api";
import { signOut } from "@/server/auth";

/** POST /api/auth/signout — clears the session cookie on every subdomain. */
export async function POST(): Promise<Response> {
  await signOut();
  return Response.json(AuthSignout.response.parse({ ok: true }), {
    headers: { "Cache-Control": "no-store" },
  });
}
