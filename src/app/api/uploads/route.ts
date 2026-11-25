import { CreateUpload } from "@/contracts/api";
import { db } from "@/lib/db";
import {
  errorResponse,
  invalidInputResponse,
  requireParkStaff,
  requireRole,
} from "@/server/auth";
import { ParcelError } from "@/server/parcels";
import { createSignedUpload, uploadSide } from "@/server/uploads";

/**
 * POST /api/uploads — a signed upload for one parcel photo (HS-6, arrival
 * damage, release, collector). Body: { kind, parcelId, contentType:
 * "image/jpeg", sizeBytes ≤ 500 KB }.
 *
 * Only agents and park admins of the right park: the origin park for
 * drop-off photos, the arrival park for the rest. Returns { uploadUrl,
 * publicUrl, path }; the browser PUTs the JPEG to uploadUrl, then the
 * feature saves publicUrl on the parcel event.
 */
export async function POST(request: Request): Promise<Response> {
  const parsed = CreateUpload.body.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return invalidInputResponse(parsed.error, "Take the photo again.");
  }
  const { kind, parcelId } = parsed.data;

  try {
    await requireRole("AGENT", "PARK_ADMIN");
    const parcel = await db.parcel.findUnique({
      where: { id: parcelId },
      select: { originParkId: true, destinationParkId: true },
    });
    if (!parcel) {
      throw new ParcelError("parcel_not_found", "Parcel not found.", 404);
    }
    await requireParkStaff(
      uploadSide(kind) === "origin"
        ? parcel.originParkId
        : parcel.destinationParkId,
    );
    const result = await createSignedUpload(parsed.data);
    return Response.json(CreateUpload.response.parse(result), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
