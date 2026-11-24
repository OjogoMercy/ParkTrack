"use client";

import { useEffect, useState } from "react";
import type { PaymentStatusView } from "@/contracts/dto";
import { buttonVariants } from "@/components/ui/button";
import { formatNaira } from "@/lib/money";

/**
 * Payment result that keeps asking the server while the payment is still
 * pending (every 3 s, up to 3 minutes). Plain sl2 version; sl6 replaces the
 * look with S05/S06.
 */
export function PaymentStatusPanel({
  initial,
}: {
  initial: PaymentStatusView;
}) {
  const [view, setView] = useState(initial);
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    if (view.status !== "PENDING") return;
    const started = Date.now();
    const id = window.setInterval(async () => {
      if (Date.now() - started > 3 * 60 * 1000) {
        setGaveUp(true);
        window.clearInterval(id);
        return;
      }
      const res = await fetch(
        `/api/payments/${encodeURIComponent(view.txnRef)}/status`,
        { cache: "no-store" },
      ).catch(() => null);
      if (res?.ok) setView((await res.json()) as PaymentStatusView);
    }, 3000);
    return () => window.clearInterval(id);
  }, [view.status, view.txnRef]);

  const amount = formatNaira(view.amountKobo);
  if (view.status === "VERIFIED") {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-title">Payment confirmed</h1>
        <p className="text-sub text-fg-2">
          {amount} for {view.parcelCode}. Reference{" "}
          <span className="font-mono">{view.txnRef}</span>.
        </p>
        <a
          href={view.returnTo}
          className={buttonVariants({ size: "lg", block: true })}
        >
          Continue
        </a>
      </div>
    );
  }
  if (view.status === "FAILED") {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-title">Payment failed</h1>
        <p className="text-sub text-fg-2">
          {amount} for {view.parcelCode}. {view.reason ? `${view.reason}.` : ""}{" "}
          No money was taken.
        </p>
        <p className="font-mono text-caption text-fg-3">{view.txnRef}</p>
        <a
          href={view.returnTo}
          className={buttonVariants({
            variant: "secondary",
            size: "lg",
            block: true,
          })}
        >
          Back to the booking
        </a>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-title">Confirming your payment</h1>
      <p className="text-sub text-fg-2">
        {gaveUp
          ? "This is taking longer than usual. Closed the page? We'll confirm by WhatsApp once Interswitch does."
          : `Checking ${amount} for ${view.parcelCode} with Interswitch…`}
      </p>
      <p className="font-mono text-caption text-fg-3">{view.txnRef}</p>
    </div>
  );
}
