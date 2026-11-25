import { CreateRecipient, ListRecipients } from "@/contracts/api";
import {
  errorResponse,
  invalidInputResponse,
  requireRole,
} from "@/server/auth";
import { createRecipient, listRecipients } from "@/server/recipients";

const noStore = { "Cache-Control": "no-store" };

/** GET /api/me/recipients — the sender's saved recipients (S12, S03 chips). */
export async function GET(): Promise<Response> {
  try {
    const user = await requireRole();
    const recipients = await listRecipients(user.id);
    return Response.json(ListRecipients.response.parse({ recipients }), {
      headers: noStore,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * POST /api/me/recipients — { name, phone, preferredParkId?,
 * preferredRoadsidePointId? }. 400 invalid_input (with fields), 401
 * signed_out, 409 recipient_exists / too_many_recipients.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const user = await requireRole();
    const parsed = CreateRecipient.body.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return invalidInputResponse(parsed.error);
    const created = await createRecipient(user.id, parsed.data);
    return Response.json(CreateRecipient.response.parse(created), {
      status: 201,
      headers: noStore,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
