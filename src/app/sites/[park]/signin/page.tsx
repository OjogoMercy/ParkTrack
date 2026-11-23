import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { MobileShell, TopBar } from "@/components/ui/shells";
import { safeNext } from "@/features/identity/redirects";
import { SignInForm } from "@/features/identity/sign-in-form";
import { getSession } from "@/server/auth";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false },
};

/**
 * S02 — sender sign-in on a park subdomain: {park}.parktrack.ng/signin.
 * `?next=/send` returns there afterwards. Someone already signed in goes
 * straight to `next`. The search params and session are request data, so
 * they're read inside <Suspense>; the shell renders instantly.
 */
export default function ParkSignInPage({
  searchParams,
}: PageProps<"/sites/[park]/signin">) {
  return (
    <MobileShell topBar={<TopBar backHref="/" />} className="gap-0 p-0">
      <Suspense fallback={<SignInSkeleton />}>
        <ParkSignIn searchParams={searchParams} />
      </Suspense>
    </MobileShell>
  );
}

async function ParkSignIn({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const next = safeNext((await searchParams).next);
  if (await getSession()) redirect(next ?? "/");
  return (
    <SignInForm
      title={next?.startsWith("/send") ? "Sign in to book" : "Sign in"}
      intro="No password. We send a 6-digit code to your phone by WhatsApp, or SMS if WhatsApp isn’t available."
      next={next}
      footnote="Your account works on every ParkTrack park, not just this one."
    />
  );
}

function SignInSkeleton() {
  return (
    <div className="flex flex-col gap-6 px-5 pt-6" aria-hidden>
      <div className="h-7 w-40 rounded-badge bg-sunken" />
      <div className="h-11 w-full rounded-badge bg-sunken" />
      <div className="h-12 w-full rounded-control bg-sunken" />
    </div>
  );
}
