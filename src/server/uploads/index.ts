/**
 * STUB (Scope 01) — owned by Scope 03 (docs/scopes/03-parcel-engine.md).
 * Exported names and types are FINAL. Scope 03 replaces the bodies;
 * callers never change. Until then everything returns fixture data.
 */
import { stub } from "@/mocks/stub";

export const STUB = true;

export type UploadKind = "dropoff" | "arrival_damage" | "release" | "collector";

/** Signed Supabase Storage upload for a browser-compressed photo (≤ 500 KB). */
export async function createSignedUpload(args: {
  kind: UploadKind;
  parcelId: string;
  contentType: "image/jpeg";
  sizeBytes: number;
}): Promise<{ uploadUrl: string; publicUrl: string; path: string }> {
  const path = `${args.kind}/${args.parcelId}/photo.jpg`;
  return stub({
    uploadUrl: `https://example.test/upload/${path}`,
    publicUrl: `https://example.test/photos/${path}`,
    path,
  });
}
