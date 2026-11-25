/**
 * Owned by Scope 05 (docs/scopes/05-sender-app.md). Exported names and
 * types are FINAL; callers never change. Real since sl2.
 *
 * Saved recipients (S12, chips in S03). Every call is scoped to the
 * sender's own user id: nobody can read or change someone else's list.
 * Phones are stored as E.164. A preferred park must be live; a preferred
 * roadside point must be on a route into that park (picking a point
 * without a park takes the route's destination).
 */
import "server-only";
import type { SavedRecipientDto } from "@/contracts/dto";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { normalizeNgPhone } from "@/lib/phone";
import { RecipientError } from "./errors";

export const STUB = false;

export { RecipientError } from "./errors";

export type RecipientInput = {
  name: string;
  phone: string;
  preferredParkId?: string | null;
  preferredRoadsidePointId?: string | null;
};

/** Enough for any sender; stops a script filling the table. */
export const MAX_RECIPIENTS = 50;

const include = {
  preferredPark: { select: { id: true, slug: true, name: true, city: true } },
  preferredRoadsidePoint: { select: { id: true, name: true } },
} as const;

type Row = Prisma.SavedRecipientGetPayload<{ include: typeof include }>;

function toDto(r: Row): SavedRecipientDto {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    preferredPark: r.preferredPark,
    preferredRoadsidePoint: r.preferredRoadsidePoint,
  };
}

export async function listRecipients(
  userId: string,
): Promise<SavedRecipientDto[]> {
  const rows = await db.savedRecipient.findMany({
    where: { userId },
    include,
    orderBy: [{ name: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(toDto);
}

export async function createRecipient(
  userId: string,
  input: RecipientInput,
): Promise<SavedRecipientDto> {
  const data = await validate(input);
  const count = await db.savedRecipient.count({ where: { userId } });
  if (count >= MAX_RECIPIENTS) {
    throw new RecipientError(
      "too_many_recipients",
      `You can save up to ${MAX_RECIPIENTS} recipients. Remove one to add another.`,
      409,
    );
  }
  await assertPhoneFree(userId, data.phone);
  const row = await db.savedRecipient.create({
    data: { userId, ...data },
    include,
  });
  return toDto(row);
}

export async function updateRecipient(
  userId: string,
  id: string,
  input: Partial<RecipientInput>,
): Promise<SavedRecipientDto> {
  const current = await db.savedRecipient.findFirst({ where: { id, userId } });
  if (!current) throw notFound();
  const data = await validate({
    name: input.name ?? current.name,
    phone: input.phone ?? current.phone,
    preferredParkId:
      input.preferredParkId !== undefined
        ? input.preferredParkId
        : // A new drop point without a park takes the point's park.
          input.preferredRoadsidePointId
          ? null
          : current.preferredParkId,
    preferredRoadsidePointId:
      input.preferredRoadsidePointId !== undefined
        ? input.preferredRoadsidePointId
        : // A new park clears an old drop point (it may not be on the way).
          input.preferredParkId !== undefined
          ? null
          : current.preferredRoadsidePointId,
  });
  if (data.phone !== current.phone) {
    await assertPhoneFree(userId, data.phone, id);
  }
  const row = await db.savedRecipient.update({
    where: { id },
    data,
    include,
  });
  return toDto(row);
}

export async function deleteRecipient(
  userId: string,
  id: string,
): Promise<void> {
  const { count } = await db.savedRecipient.deleteMany({
    where: { id, userId },
  });
  if (!count) throw notFound();
}

function notFound() {
  return new RecipientError(
    "recipient_not_found",
    "That recipient isn't in your list.",
    404,
  );
}

async function assertPhoneFree(
  userId: string,
  phone: string,
  exceptId?: string,
): Promise<void> {
  const clash = await db.savedRecipient.findFirst({
    where: { userId, phone, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { name: true },
  });
  if (clash) {
    throw new RecipientError(
      "recipient_exists",
      `You already saved this number as ${clash.name}.`,
      409,
      { phone: `Already saved as ${clash.name}` },
    );
  }
}

async function validate(input: RecipientInput): Promise<{
  name: string;
  phone: string;
  preferredParkId: string | null;
  preferredRoadsidePointId: string | null;
}> {
  const fields: Record<string, string> = {};
  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) {
    fields.name = "Enter their name (2 to 80 characters)";
  }
  const phone = normalizeNgPhone(input.phone);
  if (!phone) {
    fields.phone = "Enter a Nigerian phone number, e.g. 0803 555 4471";
  }

  let parkId = input.preferredParkId ?? null;
  const pointId = input.preferredRoadsidePointId ?? null;
  if (pointId) {
    const point = await db.roadsidePoint.findUnique({
      where: { id: pointId },
      select: { route: { select: { destinationParkId: true, active: true } } },
    });
    if (!point || !point.route.active) {
      fields.preferredRoadsidePointId = "Choose a drop point on the route";
    } else if (parkId && parkId !== point.route.destinationParkId) {
      fields.preferredRoadsidePointId =
        "That drop point isn't on the way to this park";
    } else {
      parkId = point.route.destinationParkId;
    }
  }
  if (parkId) {
    const park = await db.park.findFirst({
      where: { id: parkId, status: "LIVE" },
      select: { id: true },
    });
    if (!park) fields.preferredParkId = "Choose a park on ParkTrack";
  }
  if (Object.keys(fields).length) {
    throw new RecipientError(
      "invalid_input",
      "Check the recipient's details and try again.",
      400,
      fields,
    );
  }
  return {
    name,
    phone: phone!,
    preferredParkId: parkId,
    preferredRoadsidePointId: pointId,
  };
}
