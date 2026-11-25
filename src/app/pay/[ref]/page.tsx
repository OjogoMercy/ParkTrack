import type { Metadata } from "next";
import { redirect } from "next/navigation";
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
 * parktrack.ng/pay/{ref}: where the payer lands after Interswitch (via
 * /api/payments/callback). Shows what our server verified, never the
 * redirect's own values: S05 confirming, S06 failed, or straight back to
 * the booking once verified.
 */
export default function PaymentPage({ params }: PageProps<"/pay/[ref]">) {
  return (
    <Suspense fallback={<Checking />}>
      <PaymentResult params={params} />
    </Suspense>
  );
}

async function PaymentResult({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const view = await paymentStatus(ref);
  if (!view) {
    return (
      <MobileShell
        topBar={<TopBar leading={<ParkTrackLogo />} />}
        className="gap-2 px-5 py-8"
      >
        <h1 className="text-title">Payment not found</h1>
        <p className="text-sub text-fg-2">
          Check the link, or start the payment again from your booking.
        </p>
      </MobileShell>
    );
  }
  // Verified and applied: nothing to show here.
  if (view.status === "VERIFIED" && !view.reason) redirect(view.returnTo);
  return <PaymentStatusPanel initial={view} />;
}

function Checking() {
  return (
    <MobileShell className="items-center justify-center p-8 text-center">
      <p className="text-sub text-fg-2" role="status">
        Checking your payment…
      </p>
    </MobileShell>
  );
}
