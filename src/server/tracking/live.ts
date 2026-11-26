import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { db } from "@/lib/db";
import { serverEnv } from "@/lib/env";
import { recipientTopic, senderTopic, TRACKING_EVENT } from "./topics";

/**
 * Live updates for open tracking pages (TRK-1, R01–R03) over Supabase
 * Realtime Broadcast. The server only says "this parcel changed" on
 * channels named by the parcel's random ids (the sender's booking id,
 * which only the sender holds, and the recipient's tracking-link id); pages then
 * re-read through the normal, access-checked routes. Nothing about the
 * parcel travels over Realtime, and no table is exposed to the browser.
 *
 * Pages also refresh on a timer, so a missed ping (or Realtime not being
 * configured) only makes an update slower, never wrong.
 */

/**
 * Tells open tracking pages of these parcels to refresh. Never throws and
 * never blocks for long: a failed ping is logged and the timer catches up.
 */
export async function pingParcels(parcelIds: string[]): Promise<void> {
  if (parcelIds.length === 0) return;
  const client = realtimeAdmin();
  if (!client) return;
  try {
    const rows = await db.parcel.findMany({
      where: { id: { in: parcelIds } },
      select: { publicId: true, trackingLinkId: true },
    });
    const topics = rows.flatMap((r) => [
      senderTopic(r.publicId),
      ...(r.trackingLinkId ? [recipientTopic(r.trackingLinkId)] : []),
    ]);
    await Promise.all(
      topics.map(async (topic) => {
        const channel = client.channel(topic);
        try {
          await channel.httpSend(TRACKING_EVENT, {}, { timeout: 5000 });
        } finally {
          await client.removeChannel(channel);
        }
      }),
    );
  } catch (e) {
    console.warn("[tracking] live ping failed", e);
  }
}

/** pingParcels after the response is sent (or straight away outside a request). */
export function pingParcelsLater(parcelIds: string[]): void {
  try {
    after(() => pingParcels(parcelIds));
  } catch {
    void pingParcels(parcelIds);
  }
}

let admin: SupabaseClient | null | undefined;

/**
 * Server-side Supabase client for broadcasting, or null when Supabase isn't
 * configured. Uses the secret key when there is one, else the public
 * (anon) key: tracking channels are public and a ping carries no data.
 */
function realtimeAdmin(): SupabaseClient | null {
  if (admin !== undefined) return admin;
  const env = serverEnv();
  const url = env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY ||
    env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  admin =
    url && key
      ? createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null;
  return admin;
}
