import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ParcelCode } from "@/contracts/primitives";
import { MobileShell, TopBar } from "@/components/ui/shells";
import { Card } from "@/components/ui/surface";
import { LiveRefresh } from "@/features/tracking/live-refresh";
import { SenderParcelView } from "@/features/tracking/sender-parcel";
import { getSession } from "@/server/auth";
import { receiptUrl } from "@/server/payments";
import { parcelDetailFor } from "@/server/tracking";
import { senderTopic } from "@/server/tracking/topics";

export const metadata: Metadata = {
  title: "Your parcel",
  robots: { index: false },
};

/**
 * S09–S11: the sender's parcel page, {park}.parktrack.ng/parcels/PT-7K3Q.
 * Only the sender who booked it can open it (anyone else sees "not
 * found"). Stays current without a reload (Realtime ping + timer).
 */
export default function SenderParcelPage({
  params,
}: PageProps<"/sites/[park]/parcels/[code]">) {
  return (
    <Suspense
      fallback={
        <MobileShell topBar={<TopBar backHref="/parcels" title="Parcel" />}>
          <span className="sr-only">Loading your parcel</span>
        </MobileShell>
      }
    >
      <SenderParcel params={params} />
    </Suspense>
  );
}

async function SenderParcel({
  params,
}: {
  params: Promise<{ park: string; code: string }>;
}) {
  const { code: raw } = await params;
  const code = decodeURIComponent(raw).toUpperCase();
  // Per request: the session check and countdowns depend on the clock.
  await connection();
  const user = await getSession();
  if (!user) redirect(`/signin?next=${encodeURIComponent(`/parcels/${code}`)}`);

  const valid = ParcelCode.safeParse(code);
  const parcel = valid.success ? await parcelDetailFor(code, user.id) : null;
  if (!parcel) {
    return (
      <MobileShell topBar={<TopBar backHref="/parcels" title={code} />}>
        <Card className="flex flex-col gap-1.5 p-5">
          <h1 className="text-heading">We can’t find that parcel</h1>
          <p className="text-sub text-fg-2">
            Check the code, or open it from My parcels. Only the person who
            booked a parcel can see it here.
          </p>
        </Card>
      </MobileShell>
    );
  }
  const shipping = parcel.payments.findLast(
    (x) => x.purpose === "SHIPPING" && x.status === "VERIFIED",
  );
  return (
    <>
      <SenderParcelView
        parcel={parcel}
        now={requestTime()}
        backHref="/parcels"
        receiptHref={shipping ? receiptUrl(shipping.txnRef) : null}
      />
      {parcel.publicId ? (
        <LiveRefresh topic={senderTopic(parcel.publicId)} />
      ) : null}
    </>
  );
}

/** The time this page is rendered for (countdowns, "today"). */
function requestTime(): Date {
  return new Date();
}
