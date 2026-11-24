/**
 * Photo upload rules (HS-6 and the arrival/release photos). Pure, so they
 * are unit-tested; ./index.ts and the /api/uploads routes apply them.
 *
 * One PRIVATE Supabase Storage bucket per kind of photo. Buckets only
 * accept JPEG up to 500 KB (PhotoCapture compresses to ~200 KB in the
 * browser first). Objects live at {parcelId}/{random}.jpg, so a stored path
 * says which parcel it belongs to but can't be guessed.
 *
 * Photos are never public: `publicUrl` is a ParkTrack address
 * (/api/uploads/view/{bucket}/{parcelId}/{file}) that checks who is asking
 * and redirects to a Storage link valid for one minute.
 */

export type UploadKind = "dropoff" | "arrival_damage" | "release" | "collector";

export const MAX_PHOTO_BYTES = 500_000;
export const VIEW_LINK_SECONDS = 60;

export const BUCKETS: Record<UploadKind, string> = {
  dropoff: "parcel-dropoff",
  arrival_damage: "parcel-damage",
  release: "parcel-release",
  collector: "parcel-collector",
};

/** Which park's staff may upload this kind of photo for a parcel. */
export function uploadSide(kind: UploadKind): "origin" | "destination" {
  return kind === "dropoff" ? "origin" : "destination";
}

/** Object path inside the bucket. */
export function objectPath(parcelId: string, token: string): string {
  return `${parcelId}/${token}.jpg`;
}

/**
 * Splits a view path "parcel-dropoff/{parcelId}/{token}.jpg" into its
 * parts, or null if it isn't one of ours (unknown bucket, odd characters,
 * extra folders). Keeps the view route from serving anything else.
 */
export function parseViewPath(
  segments: string[],
): { bucket: string; parcelId: string; object: string } | null {
  if (segments.length !== 3) return null;
  const [bucket, parcelId, file] = segments;
  if (!Object.values(BUCKETS).includes(bucket)) return null;
  if (!/^[a-z0-9]{10,40}$/.test(parcelId)) return null;
  if (!/^[A-Za-z0-9_-]{10,64}\.jpg$/.test(file)) return null;
  return { bucket, parcelId, object: `${parcelId}/${file}` };
}
