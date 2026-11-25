import { DeleteRecipient, UpdateRecipient } from "@/contracts/api";
import {
  errorResponse,
  invalidInputResponse,
  requireRole,
} from "@/server/auth";
import { deleteRecipient, updateRecipient } from "@/server/recipients";

const noStore = { "Cache-Control": "no-store" };

/**
 * PATCH /api/me/recipients/:id — any of name, phone, preferredParkId,
 * preferredRoadsidePointId. Only the sender's own recipients: someone
 * else's id is 404, like one that doesn't exist.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const user = await requireRole();
    const parsed = UpdateRecipient.body.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return invalidInputResponse(parsed.error);
    const { id } = await params;
    const updated = await updateRecipient(user.id, id, parsed.data);
    return Response.json(UpdateRecipient.response.parse(updated), {
      headers: noStore,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/** DELETE /api/me/recipients/:id — 404 when it isn't theirs. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const user = await requireRole();
    const { id } = await params;
    await deleteRecipient(user.id, id);
    return Response.json(DeleteRecipient.response.parse({ ok: true }), {
      headers: noStore,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
