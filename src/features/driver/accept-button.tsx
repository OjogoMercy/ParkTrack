"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/surface";

/**
 * D01 "Accept load · N parcels": POST /api/trips/:id/accept, then shows the
 * accepted load. A refusal (e.g. the counter moved parcels meanwhile) is
 * shown above the button and the load is refreshed.
 */
export function AcceptButton({
  tripId,
  count,
}: {
  tripId: string;
  count: number;
}) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const busy = sending || refreshing;

  async function accept() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/trips/${encodeURIComponent(tripId)}/accept`,
        {
          method: "POST",
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setError(
          body?.error?.message ?? "We couldn’t accept the load. Try again.",
        );
      }
    } catch {
      setError("No connection. Check your data and try again.");
    } finally {
      setSending(false);
      startRefresh(() => router.refresh());
    }
  }

  return (
    <>
      {error ? <Notice tone="red">{error}</Notice> : null}
      <Button size="lg" block disabled={busy} onClick={accept}>
        {busy
          ? "Accepting…"
          : `Accept load · ${count} ${count === 1 ? "parcel" : "parcels"}`}
      </Button>
    </>
  );
}
