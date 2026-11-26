import { Suspense } from "react";
import { MobileShell, TopBar } from "@/components/ui/shells";
import {
  HeaderAccount,
  HeaderAccountSkeleton,
} from "@/features/identity/header-account";
import { ParkTrackLogo } from "@/features/identity/logo";
import { ParkFinder } from "@/features/identity/park-finder";

/**
 * Home: parktrack.ng. Everything is on one domain (Q45): anyone signs up
 * here, then picks the park they send from. Sending or receiving is what a
 * person does with a parcel, not a kind of account.
 */
export default function Home() {
  return (
    <MobileShell
      topBar={
        <TopBar
          leading={<ParkTrackLogo />}
          trailing={
            <Suspense fallback={<HeaderAccountSkeleton />}>
              <HeaderAccount signInHref="/signin" />
            </Suspense>
          }
        />
      }
      className="gap-6 px-5 py-8"
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-title">Send a parcel from your motor park</h1>
        <p className="text-sub text-fg-2">
          Book and pay here, drop it at the park counter, and the person you
          send to collects with a one-time code. Every naira goes through
          Interswitch.
        </p>
      </div>
      <ParkFinder />
    </MobileShell>
  );
}
