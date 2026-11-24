import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";
import { MAX_PHOTO_BYTES } from "./rules";

/**
 * Server-only Supabase client for Storage (Q17: Prisma for data, Supabase
 * only for Storage and Realtime). Uses the secret key (sb_secret_…, which
 * Supabase recommends) or the legacy service_role key; never sent to a
 * browser. Built lazily so builds and tests don't need the keys.
 */

let client: SupabaseClient | undefined;

export function storageAdmin(): SupabaseClient {
  if (client) return client;
  const env = serverEnv();
  const url = env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Photo uploads need SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) in .env.local.",
    );
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

const ready = new Set<string>();

/** Creates the private bucket the first time it's needed. */
export async function ensureBucket(name: string): Promise<void> {
  if (ready.has(name)) return;
  const storage = storageAdmin().storage;
  const existing = await storage.getBucket(name);
  if (existing.error) {
    const created = await storage.createBucket(name, {
      public: false,
      fileSizeLimit: MAX_PHOTO_BYTES,
      allowedMimeTypes: ["image/jpeg"],
    });
    if (created.error && !/exist/i.test(created.error.message)) {
      throw new Error(
        `Couldn't create bucket ${name}: ${created.error.message}`,
      );
    }
  } else if (existing.data.public) {
    // Never serve parcel photos from a public bucket.
    throw new Error(`Bucket ${name} is public; make it private in Supabase.`);
  }
  ready.add(name);
}
