import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { MobileShell, TopBar } from "@/components/ui/shells";
import { consoleHome, safeNext } from "@/features/identity/redirects";
import { SignInForm } from "@/features/identity/sign-in-form";
import { getSession } from "@/server/auth";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false },
};

/**
 * S02 sign-in: parktrack.ng/signin. One sign-in for everyone (Q45): a new
 * phone gets an account; staff go to their console afterwards, everyone
 * else to `?next=` (on-site paths only) or home. Someone already signed in
 * goes straight there. The search params and session are request data, so
 * they're read inside <Suspense>; the shell renders instantly.
 */
export default function SignInPage({ searchParams }: PageProps<"/signin">) {
  return (
    <MobileShell topBar={<TopBar backHref="/" />} className="gap-0 p-0">
      <Suspense fallback={<SignInSkeleton />}>
        <SignIn searchParams={searchParams} />
      </Suspense>
    </MobileShell>
  );
}

async function SignIn({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const next = safeNext((await searchParams).next);
  const user = await getSession();
  if (user) redirect(next ?? consoleHome(user.role) ?? "/");
  return (
    <SignInForm
      title={next?.startsWith("/send") ? "Sign in to book" : "Sign in"}
      intro="No password. We send a 6-digit code to your phone by WhatsApp, or SMS if WhatsApp isn’t available."
      next={next}
      footnote="One account for sending and receiving, at every ParkTrack park."
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
