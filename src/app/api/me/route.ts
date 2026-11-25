import { GetMe, UpdateMe } from "@/contracts/api";
import {
  errorResponse,
  invalidInputResponse,
  requireRole,
} from "@/server/auth";
import { getProfile, updateProfile } from "@/server/vendors";

const noStore = { "Cache-Control": "no-store" };

/** GET /api/me — the signed-in person's profile (S12). 401 signed_out. */
export async function GET(): Promise<Response> {
  try {
    const user = await requireRole();
    return Response.json(GetMe.response.parse(await getProfile(user.id)), {
      headers: noStore,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * PATCH /api/me — { name?, language?, notifyChannel? } (S12 Edit and
 * Preferences). 400 invalid_input, 401 signed_out.
 */
export async function PATCH(request: Request): Promise<Response> {
  try {
    const user = await requireRole();
    const parsed = UpdateMe.body.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return invalidInputResponse(parsed.error);
    const profile = await updateProfile(user.id, parsed.data);
    return Response.json(UpdateMe.response.parse(profile), {
      headers: noStore,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
