import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { MobileShell, TopBar } from "@/components/ui/shells";
import { Notice } from "@/components/ui/surface";
import { formatPhone } from "@/lib/phone";
import { ParkTrackLogo } from "@/features/identity/logo";
import { SignOutButton } from "@/features/identity/sign-out-button";
import {
  consoleHome,
  consolePublicPath,
  safeNext,
} from "@/features/identity/redirects";
import { SignInForm } from "@/features/identity/sign-in-form";
import { getSession } from "@/server/auth";

export const metadata: Metadata = {
  title: "Staff sign in",
  robots: { index: false },
};

/**
 * Console sign-in: app.parktrack.ng/signin (S02 layout). Only existing staff
 * can sign in here; each role then lands on its home (agent → counter,
 * driver → driver, park admin → park, platform admin → platform), unless
 * `?next=` says where they were going.
 */
export default function ConsoleSignInPage({
  searchParams,
}: PageProps<"/console/signin">) {
  return (
    <MobileShell
      topBar={<TopBar leading={<ParkTrackLogo />} />}
      className="gap-0 p-0"
    >
      <Suspense fallback={null}>
        <ConsoleSignIn searchParams={searchParams} />
      </Suspense>
    </MobileShell>
  );
}

async function ConsoleSignIn({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const next = safeNext((await searchParams).next);
  const user = await getSession();
  const home = user ? consoleHome(user.role) : null;
  if (home) redirect(next ?? consolePublicPath(home));
  return (
    <SignInForm
      title="Staff sign in"
      intro="For park agents, drivers and admins. We send a 6-digit code to your phone by WhatsApp, or SMS if WhatsApp isn’t available."
      next={next}
      staff
      footnote="Sending a parcel? Sign in on your park’s page instead."
      banner={
        user ? (
          // Signed in, but not as staff (a sender account).
          <Notice tone="amber" className="mt-1 items-center">
            <div className="flex items-center justify-between gap-3">
              <span>
                You’re signed in as {formatPhone(user.phone)}, which isn’t a
                staff account. Park admins add staff.
              </span>
              <SignOutButton />
            </div>
          </Notice>
        ) : null
      }
    />
  );
}
