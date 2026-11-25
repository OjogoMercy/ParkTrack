import type { Metadata } from "next";
import { Check } from "lucide-react";
import { Suspense } from "react";
import { Money } from "@/components/ui/display";
import { BottomBar, MobileShell, TopBar } from "@/components/ui/shells";
import { Card, KeyValue, Notice } from "@/components/ui/surface";
import { formatDay, formatTime } from "@/lib/dates";
import { ParkTrackLogo } from "@/features/identity/logo";
import { PrintButton } from "@/features/payments/print-button";
import { paymentReceipt, type PaymentReceipt } from "@/server/payments";

export const metadata: Metadata = {
  title: "Receipt",
  robots: { index: false },
};

const PURPOSE: Record<PaymentReceipt["purpose"], string> = {
  SHIPPING: "Shipping fee",
  TOP_UP: "Size top-up",
  POD: "Pay on delivery",
  STORAGE: "Storage",
};

/**
 * parktrack.ng/pay/{ref}/receipt: the receipt for one payment (PAY-8),
 * linked from the receipt message and the booking. Amount, reference,
 * purpose, time and parcel; no names or phone numbers.
 */
export default function ReceiptPage({
  params,
}: PageProps<"/pay/[ref]/receipt">) {
  return (
    <Suspense
      fallback={
        <MobileShell topBar={<TopBar leading={<ParkTrackLogo />} />}>
          <p className="text-sub text-fg-2" role="status">
            Loading the receipt…
          </p>
        </MobileShell>
      }
    >
      <Receipt params={params} />
    </Suspense>
  );
}

async function Receipt({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const receipt = await paymentReceipt(ref);
  const shell = (children: React.ReactNode, bottom?: React.ReactNode) => (
    <MobileShell
      topBar={<TopBar leading={<ParkTrackLogo />} title="Receipt" />}
      bottomBar={bottom ? <BottomBar>{bottom}</BottomBar> : undefined}
      className="gap-5 px-5 py-6"
    >
      {children}
    </MobileShell>
  );

  if (!receipt) {
    return shell(
      <div className="flex flex-col gap-1.5">
        <h1 className="text-title">Receipt not found</h1>
        <p className="text-sub text-fg-2">
          Check the link in your message. Receipts are only for completed
          payments.
        </p>
      </div>,
    );
  }
  if (receipt.status !== "VERIFIED" || !receipt.paidAt) {
    return shell(
      <div className="flex flex-col gap-1.5">
        <h1 className="text-title">No receipt yet</h1>
        <p className="text-sub text-fg-2">
          This payment isn’t confirmed, so there’s no receipt for it.
        </p>
        <a
          href={`/pay/${encodeURIComponent(receipt.txnRef)}`}
          className="text-sub font-medium underline"
        >
          See where the payment stands
        </a>
      </div>,
    );
  }

  return shell(
    <>
      <div className="flex flex-col items-start gap-3">
        <span
          className="grid size-11 place-items-center rounded-control bg-green-bg text-green-fg [&_svg]:size-[22px]"
          aria-hidden
        >
          <Check />
        </span>
        <div className="flex flex-col gap-1">
          <p className="text-sub text-fg-2">
            {PURPOSE[receipt.purpose]} · {receipt.parcelCode}
          </p>
          <h1>
            <span className="sr-only">Paid </span>
            <Money kobo={receipt.amountKobo} className="text-amount" />
          </h1>
          <p className="text-sub text-fg-2">
            Paid {formatDay(receipt.paidAt)} {lagosYear(receipt.paidAt)},{" "}
            {formatTime(receipt.paidAt)}
          </p>
        </div>
      </div>
      {receipt.refundPending ? (
        <Notice tone="amber">
          This payment couldn’t be used and will be refunded to you.
        </Notice>
      ) : null}
      <Card className="px-4 py-2">
        <KeyValue label="Paid for" value={PURPOSE[receipt.purpose]} />
        <KeyValue
          label="Parcel"
          value={<span className="font-mono">{receipt.parcelCode}</span>}
        />
        <KeyValue label="Route" value={receipt.route} />
        <KeyValue
          label="Reference"
          value={
            <span className="font-mono text-[13px]">{receipt.txnRef}</span>
          }
        />
        {receipt.providerRef ? (
          <KeyValue
            label="Interswitch ref"
            value={
              <span className="font-mono text-[12px] break-all">
                {receipt.providerRef}
              </span>
            }
          />
        ) : null}
        <KeyValue label="Paid through" value="Interswitch" />
      </Card>
      <p className="text-caption text-fg-3">
        ParkTrack · parcels between motor parks. Keep this receipt; the
        reference is how we find your payment.
      </p>
    </>,
    <PrintButton />,
  );
}

function lagosYear(d: Date): string {
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: "Africa/Lagos",
    year: "numeric",
  }).format(d);
}
