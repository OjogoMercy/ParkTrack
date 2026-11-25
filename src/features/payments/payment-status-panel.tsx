"use client";

import { AlertTriangle, RefreshCcw, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { PaymentStatusView } from "@/contracts/dto";
import { buttonVariants } from "@/components/ui/button";
import { CodeTag } from "@/components/ui/display";
import { BottomBar, MobileShell, TopBar } from "@/components/ui/shells";
import { Card, KeyValue } from "@/components/ui/surface";
import { formatNaira } from "@/lib/money";
import { cn } from "@/lib/utils";
import { REPLACED_REASON, REVIEW_MESSAGE } from "@/server/payments/messages";

/** How often S05 asks the server, and for how long. */
const POLL_MS = 3000;
const POLL_FOR_MS = 3 * 60 * 1000;

/**
 * /pay/{ref} after Interswitch, from what OUR server verified:
 *   pending   S05 "Confirming your payment", asks every 3 s for 3 minutes
 *   verified  straight back to the booking (returnTo)
 *   failed    S06 "Payment didn't go through" with Interswitch's reason
 * plus the cases the designs don't draw: a payment held for review, a
 * replaced checkout, and money received that will be refunded.
 */
export function PaymentStatusPanel({
  initial,
}: {
  initial: PaymentStatusView;
}) {
  const [view, setView] = useState(initial);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (view.status !== "PENDING") return;
    const started = Date.now();
    const id = window.setInterval(async () => {
      if (Date.now() - started > POLL_FOR_MS) {
        setSlow(true);
        window.clearInterval(id);
        return;
      }
      const res = await fetch(
        `/api/payments/${encodeURIComponent(view.txnRef)}/status`,
        { cache: "no-store" },
      ).catch(() => null);
      if (res?.ok) setView((await res.json()) as PaymentStatusView);
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [view.status, view.txnRef]);

  const verifiedAndUsed = view.status === "VERIFIED" && !view.reason;
  useEffect(() => {
    if (verifiedAndUsed) window.location.replace(view.returnTo);
  }, [verifiedAndUsed, view.returnTo]);

  if (view.status === "PENDING" || verifiedAndUsed) {
    return <Confirming view={view} slow={slow} done={verifiedAndUsed} />;
  }
  if (view.status === "VERIFIED") return <Refunding view={view} />;
  if (view.reason === REVIEW_MESSAGE) return <UnderReview view={view} />;
  if (view.reason === REPLACED_REASON) return <Replaced view={view} />;
  return <Failed view={view} />;
}

/** S05. Also shown for a moment while moving on after "verified". */
function Confirming({
  view,
  slow,
  done,
}: {
  view: PaymentStatusView;
  slow: boolean;
  done: boolean;
}) {
  return (
    <MobileShell className="gap-0 p-0 text-center">
      <div className="flex flex-1 flex-col items-center justify-center gap-5 p-8">
        <Spinner />
        <div className="flex flex-col gap-1.5" role="status" aria-live="polite">
          <h1 className="text-heading">
            {done ? "Payment confirmed" : "Confirming your payment"}
          </h1>
          <p className="text-sub text-fg-2">
            {done
              ? "Taking you back to your booking…"
              : slow
                ? "This is taking longer than usual. We’ll keep checking with Interswitch in the background."
                : "We’re checking with Interswitch before we confirm your booking. This takes a few seconds."}
          </p>
        </div>
        <CodeTag className="text-[12px] font-medium">Ref {view.txnRef}</CodeTag>
        {done ? (
          <a href={view.returnTo} className="text-sub font-medium underline">
            Continue
          </a>
        ) : null}
      </div>
      {done ? null : (
        <p className="px-8 pb-8 text-caption text-fg-3">
          {view.purpose === "SHIPPING"
            ? "Closed the page? No problem. We’ll send your booking QR by WhatsApp as soon as it’s confirmed."
            : "Closed the page? No problem. It will show as paid on the parcel as soon as it’s confirmed."}
        </p>
      )}
    </MobileShell>
  );
}

/** S06: declined, cancelled, or never completed. Nothing was taken. */
function Failed({ view }: { view: PaymentStatusView }) {
  return (
    <Outcome
      view={view}
      tone="red"
      icon={<X />}
      title="Payment didn’t go through"
      sub={
        view.purpose === "SHIPPING"
          ? "Interswitch didn’t approve this payment. You haven’t been charged, and your booking is still saved."
          : "Interswitch didn’t approve this payment. You haven’t been charged."
      }
      reason={view.reason ?? "Payment not completed"}
      actions={
        <>
          <a
            href={view.returnTo}
            className={buttonVariants({ size: "lg", block: true })}
          >
            Try again
          </a>
          <p className="text-center text-caption text-fg-3">
            Interswitch’s page also takes bank transfer and USSD.
          </p>
        </>
      }
    />
  );
}

/** Interswitch said paid, but not what we charged: a person checks it. */
function UnderReview({ view }: { view: PaymentStatusView }) {
  return (
    <Outcome
      view={view}
      tone="amber"
      icon={<AlertTriangle />}
      title="We’re checking this payment"
      sub="We couldn’t confirm it with Interswitch. Our team will check it and contact you. Please don’t pay again."
      actions={<BackLink view={view} />}
    />
  );
}

/** An older checkout for the same booking, closed when a newer one began. */
function Replaced({ view }: { view: PaymentStatusView }) {
  return (
    <Outcome
      view={view}
      tone="neutral"
      icon={<RefreshCcw />}
      title="This checkout was replaced"
      sub="A newer payment was started for this booking. Use that one; you haven’t been charged for this one."
      actions={<BackLink view={view} />}
    />
  );
}

/** Paid, but it couldn't be used (already paid, cancelled, ...). */
function Refunding({ view }: { view: PaymentStatusView }) {
  return (
    <Outcome
      view={view}
      tone="amber"
      icon={<RefreshCcw />}
      title="We’ll refund this payment"
      sub="We received this payment but couldn’t use it, so it will be refunded to you. You don’t need to do anything."
      reason={view.reason ?? undefined}
      actions={<BackLink view={view} />}
    />
  );
}

const tileTone = {
  red: "bg-red-bg text-red-fg",
  amber: "bg-amber-bg text-amber-fg",
  neutral: "bg-sunken text-fg-2",
} as const;

function Outcome({
  view,
  tone,
  icon,
  title,
  sub,
  reason,
  actions,
}: {
  view: PaymentStatusView;
  tone: keyof typeof tileTone;
  icon: React.ReactNode;
  title: string;
  sub: string;
  reason?: string;
  actions: React.ReactNode;
}) {
  const close = new URL(view.returnTo).origin;
  return (
    <MobileShell
      topBar={
        <TopBar
          className="pl-2"
          leading={
            <a
              href={close}
              aria-label="Close"
              className={buttonVariants({ variant: "ghost", size: "icon" })}
            >
              <X className="size-5" />
            </a>
          }
        />
      }
      bottomBar={<BottomBar>{actions}</BottomBar>}
      className="gap-5 px-5 py-6"
    >
      <span
        className={cn(
          "grid size-11 place-items-center rounded-control [&_svg]:size-[22px]",
          tileTone[tone],
        )}
        aria-hidden
      >
        {icon}
      </span>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-title">{title}</h1>
        <p className="text-sub text-fg-2">{sub}</p>
      </div>
      <Card className="px-4 py-2">
        <KeyValue label="Amount" value={formatNaira(view.amountKobo)} />
        <KeyValue
          label="Reference"
          value={<span className="font-mono text-[13px]">{view.txnRef}</span>}
        />
        {reason ? <KeyValue label="Reason" value={reason} /> : null}
      </Card>
    </MobileShell>
  );
}

function BackLink({ view }: { view: PaymentStatusView }) {
  return (
    <a
      href={view.returnTo}
      className={buttonVariants({
        variant: "secondary",
        size: "lg",
        block: true,
      })}
    >
      {view.purpose === "SHIPPING"
        ? "Back to my booking"
        : "Back to the parcel"}
    </a>
  );
}

function Spinner() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      aria-hidden="true"
      className="animate-spin motion-reduce:animate-none"
    >
      <circle
        cx="20"
        cy="20"
        r="17"
        className="stroke-line"
        strokeWidth="3"
        fill="none"
      />
      <path
        d="M20 3a17 17 0 0 1 17 17"
        className="stroke-fg"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
