"use client";

import { Lock } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/surface";
import { formatNaira } from "@/lib/money";

/**
 * S04 "Pay ₦X": starts the Interswitch Web Checkout for the booking
 * (POST /api/parcels/:id/pay, Scope 04) and sends the browser to
 * Interswitch's page with the form fields it returns. The amount is worked
 * out on the server; this only says what is being paid for. Interswitch
 * brings the payer back to /pay/{ref}, which moves on to the booking.
 */
export function PayButton({
  parcelId,
  totalKobo,
}: {
  parcelId: string;
  totalKobo: number;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/parcels/${encodeURIComponent(parcelId)}/pay`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ purpose: "SHIPPING" }),
        },
      );
      const json = (await res.json().catch(() => null)) as {
        checkout?: { url: string; fields: Record<string, string> };
        error?: { message?: string };
      } | null;
      if (!res.ok || !json?.checkout) {
        setError(
          json?.error?.message ?? "Couldn’t start the payment. Try again.",
        );
        setBusy(false);
        return;
      }
      // Interswitch Web Checkout is a form POST to their page.
      const form = document.createElement("form");
      form.method = "POST";
      form.action = json.checkout.url;
      for (const [name, value] of Object.entries(json.checkout.fields)) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
      }
      document.body.appendChild(form);
      form.submit(); // stay busy while the browser leaves
    } catch {
      setError("No connection. Check your data and try again.");
      setBusy(false);
    }
  };

  return (
    <>
      {error ? <Notice tone="red">{error}</Notice> : null}
      <Button size="lg" block onClick={pay} disabled={busy}>
        <Lock className="size-4" aria-hidden />
        {busy ? "Opening Interswitch…" : `Pay ${formatNaira(totalKobo)}`}
      </Button>
      <p className="text-center text-caption text-fg-3">
        You’ll finish on Interswitch’s secure page.
      </p>
    </>
  );
}
