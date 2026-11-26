"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { clientEnv } from "@/lib/env";
import { TRACKING_EVENT } from "@/server/tracking/topics";

/**
 * Keeps a tracking page current without a reload (TRK-1): refreshes when
 * the server pings `topic` over Supabase Realtime, when the tab comes back
 * into view, and every `everySeconds` as a fallback. Renders nothing.
 */
export function LiveRefresh({
  topic,
  everySeconds = 30,
}: {
  topic: string | null;
  everySeconds?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = window.setInterval(refresh, everySeconds * 1000);
    document.addEventListener("visibilitychange", refresh);

    const client = topic ? realtimeClient() : null;
    const channel = client
      ?.channel(topic!)
      .on("broadcast", { event: TRACKING_EVENT }, () => router.refresh())
      .subscribe();

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      if (client && channel) void client.removeChannel(channel);
    };
  }, [topic, everySeconds, router]);

  return null;
}

let shared: SupabaseClient | null | undefined;

/** One browser client for Realtime only (no sign-in), or null if unset. */
function realtimeClient(): SupabaseClient | null {
  if (shared !== undefined) return shared;
  const { SUPABASE_URL: url, SUPABASE_ANON_KEY: key } = clientEnv;
  shared =
    url && key
      ? createClient(url, key, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        })
      : null;
  return shared;
}
