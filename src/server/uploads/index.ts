/**
 * Owned by Scope 03 (docs/scopes/03-parcel-engine.md). Exported names and
 * types are FINAL; callers never change. Real since Scope 03 sl8: signed
 * uploads into private Supabase Storage buckets. Rules in ./rules.ts.
 */
import "server-only";
import { serverEnv } from "@/lib/env";
import { db } from "@/lib/db";
import { publicToken } from "@/lib/ids";
import { siteUrl } from "@/server/notify/links";
import { ParcelError } from "@/server/parcels";
import {
  BUCKETS,
  MAX_PHOTO_BYTES,
  objectPath,
  VIEW_LINK_SECONDS,
  type UploadKind,
} from "./rules";
import { ensureBucket, storageAdmin } from "./storage";

export const STUB = false;

export type { UploadKind } from "./rules";
export { uploadSide } from "./rules";

/**
 * Signed Supabase Storage upload for a browser-compressed photo (≤ 500 KB).
 *
 * The browser PUTs the JPEG to `uploadUrl` (content-type image/jpeg) within
 * two hours. `publicUrl` is the address to save on the parcel event, e.g.
 * transition(…, { photoUrl: publicUrl }): a ParkTrack link that checks who
 * is asking before showing the photo; the bucket itself is private.
 * `path` is "{bucket}/{parcelId}/{file}.jpg".
 *
 * Who may ask is checked by the caller (POST /api/uploads: staff of the
 * right park). Throws ParcelError parcel_not_found (404) or invalid_upload
 * (400) for a wrong type or size, uploads_unavailable (503) when Storage
 * isn't set up or reachable.
 */
export async function createSignedUpload(args: {
  kind: UploadKind;
  parcelId: string;
  contentType: "image/jpeg";
  sizeBytes: number;
}): Promise<{ uploadUrl: string; publicUrl: string; path: string }> {
  if (args.contentType !== "image/jpeg") {
    throw new ParcelError("invalid_upload", "Photos must be JPEG.", 400);
  }
  if (!(args.sizeBytes > 0 && args.sizeBytes <= MAX_PHOTO_BYTES)) {
    throw new ParcelError(
      "invalid_upload",
      "The photo is too large. Take it again.",
      400,
    );
  }
  const parcel = await db.parcel.findUnique({
    where: { id: args.parcelId },
    select: { id: true },
  });
  if (!parcel) {
    throw new ParcelError("parcel_not_found", "Parcel not found.", 404);
  }

  const bucket = BUCKETS[args.kind];
  const object = objectPath(parcel.id, publicToken());
  let signed: { signedUrl: string } | null = null;
  try {
    await ensureBucket(bucket);
    const { data, error } = await storageAdmin()
      .storage.from(bucket)
      .createSignedUploadUrl(object);
    if (error) throw error;
    signed = data;
  } catch (e) {
    // Missing keys or Storage down: tell the person simply, log the cause.
    console.error("[uploads] signed upload failed", e);
  }
  if (!signed) {
    throw new ParcelError(
      "uploads_unavailable",
      "Photo uploads aren't available right now. Try again in a moment.",
      503,
    );
  }
  const path = `${bucket}/${object}`;
  return {
    uploadUrl: signed.signedUrl,
    publicUrl: siteUrl(
      serverEnv().ROOT_DOMAIN,
      null,
      `/api/uploads/view/${path}`,
    ),
    path,
  };
}

/**
 * A one-minute Storage link to show a photo (after the caller checked
 * access), or null if the photo doesn't exist or Storage isn't reachable.
 */
export async function signedViewUrl(
  bucket: string,
  object: string,
): Promise<string | null> {
  try {
    const { data, error } = await storageAdmin()
      .storage.from(bucket)
      .createSignedUrl(object, VIEW_LINK_SECONDS);
    return error || !data ? null : data.signedUrl;
  } catch (e) {
    console.error("[uploads] view link failed", e);
    return null;
  }
}
