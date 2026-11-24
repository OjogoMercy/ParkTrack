import { unstable_rethrow } from "next/navigation";
import { db } from "@/lib/db";
import { canSeeParcel, getSession, verifyRecipientLink } from "@/server/auth";
import { signedViewUrl } from "@/server/uploads";
import { parseViewPath } from "@/server/uploads/rules";

/**
 * GET /api/uploads/view/{bucket}/{parcelId}/{file}.jpg — shows a parcel
 * photo to someone allowed to see the parcel: a signed-in person who passes
 * the tenancy rules (sender, driver carrying it, staff of its parks,
 * platform admin), or the recipient with their tracking link (?t=token).
 * Redirects to a Storage link valid for one minute. Anyone else gets 404,
 * the same as a photo that doesn't exist.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const notFound = () =>
    new Response("Not found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });

  const target = parseViewPath((await params).path);
  if (!target) return notFound();

  // A failed access check (e.g. database down) never shows the photo.
  const allowed = await mayView(request, target.parcelId).catch(
    (e: unknown) => {
      unstable_rethrow(e);
      console.error("[uploads] access check failed", e);
      return false;
    },
  );
  if (!allowed) return notFound();

  const url = await signedViewUrl(target.bucket, target.object);
  if (!url) return notFound();
  return new Response(null, {
    status: 302,
    headers: { Location: url, "Cache-Control": "private, no-store" },
  });
}

async function mayView(request: Request, parcelId: string): Promise<boolean> {
  const token = new URL(request.url).searchParams.get("t");
  if (token) {
    const link = await verifyRecipientLink(token);
    if (link?.parcelId === parcelId) return true;
  }
  const user = await getSession();
  if (!user) return false;
  const parcel = await db.parcel.findUnique({
    where: { id: parcelId },
    select: {
      originParkId: true,
      destinationParkId: true,
      senderId: true,
      tripParcels: { select: { trip: { select: { driverId: true } } } },
    },
  });
  return (
    !!parcel &&
    canSeeParcel(user, {
      ...parcel,
      driverIds: parcel.tripParcels.map((tp) => tp.trip.driverId),
    })
  );
}
