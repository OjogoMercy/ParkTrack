import type { Metadata } from "next";
import { Suspense } from "react";
import { MobileShell, TopBar } from "@/components/ui/shells";
import { ParkTrackLogo } from "@/features/identity/logo";
import { PaymentStatusPanel } from "@/features/payments/payment-status-panel";
import { paymentStatus } from "@/server/payments";

export const metadata: Metadata = {
  title: "Payment",
  robots: { index: false },
};

/**
 * parktrack.ng/pay/{ref} — where the payer lands after Interswitch. Shows
 * the result our server verified (never the redirect's own values). Plain
 * version for the sl2 end-to-end test; sl6 builds S05 "Confirming" and S06
 * "Payment failed" from the designs.
 */
export default function PaymentPage({ params }: PageProps<"/pay/[ref]">) {
  return (
    <MobileShell
      topBar={<TopBar leading={<ParkTrackLogo />} />}
      className="gap-5 px-5 py-8"
    >
      <Suspense fallback={<p className="text-sub text-fg-2">Checking…</p>}>
        <PaymentResult params={params} />
      </Suspense>
    </MobileShell>
  );
}

async function PaymentResult({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const view = await paymentStatus(ref);
  if (!view) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-title">Payment not found</h1>
        <p className="text-sub text-fg-2">
          Check the link, or start the payment again from your booking.
        </p>
      </div>
    );
  }
  return <PaymentStatusPanel initial={view} />;
}
