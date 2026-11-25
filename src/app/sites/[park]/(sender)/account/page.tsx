import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { MobileShell, TopBar } from "@/components/ui/shells";
import { Card, KeyValue, Section } from "@/components/ui/surface";
import {
  Preferences,
  ProfileCard,
  SavedRecipients,
  SignOutBlock,
  type CollectOption,
  type RecipientRow,
} from "@/features/sender/account";
import { SENDER_TABS } from "@/features/sender/tabs";
import { formatPhone } from "@/lib/phone";
import { getSession } from "@/server/auth";
import { getPark, parkDisplayName } from "@/server/parks";
import { listRecipients } from "@/server/recipients";
import { getProfile } from "@/server/vendors";

export const metadata: Metadata = { title: "Account" };

/**
 * S12 account ({park}.parktrack.ng/account): profile, business details for
 * vendors, saved recipients (add, edit, remove), message preferences, sign
 * out and the park the account joined through. Signed-out visitors go to
 * sign in and come back here.
 */
export default function AccountPage({
  params,
}: PageProps<"/sites/[park]/account">) {
  return (
    <Suspense
      fallback={
        // No tabs here: they read the URL, which the static shell can't.
        <MobileShell topBar={<TopBar title="Account" />}>
          <span className="sr-only">Loading your account</span>
        </MobileShell>
      }
    >
      <Account params={params} />
    </Suspense>
  );
}

async function Account({ params }: { params: Promise<{ park: string }> }) {
  const [{ park: slug }, user] = await Promise.all([params, getSession()]);
  if (!user) redirect("/signin?next=/account");

  const [profile, recipients, park] = await Promise.all([
    getProfile(user.id),
    listRecipients(user.id),
    getPark(slug),
  ]);

  // "Where they usually collect": the parks this park sends to, and the
  // roadside points on the way.
  const options: CollectOption[] = [];
  for (const r of park?.routes ?? []) {
    options.push({
      value: `park:${r.destination.id}`,
      label: `Collect at ${parkDisplayName(r.destination)}`,
    });
    for (const p of r.roadsidePoints) {
      options.push({ value: `point:${p.id}`, label: `Roadside · ${p.name}` });
    }
  }
  const rows: RecipientRow[] = recipients.map((r) => {
    const choice = r.preferredRoadsidePoint
      ? `point:${r.preferredRoadsidePoint.id}`
      : r.preferredPark
        ? `park:${r.preferredPark.id}`
        : "";
    // Keep a preference from another park's routes selectable.
    if (choice && !options.some((o) => o.value === choice)) {
      options.push({
        value: choice,
        label: r.preferredRoadsidePoint
          ? `Roadside · ${r.preferredRoadsidePoint.name}`
          : `Collect at ${parkDisplayName(r.preferredPark!)}`,
      });
    }
    return {
      id: r.id,
      name: r.name,
      phone: r.phone,
      where: r.preferredRoadsidePoint
        ? `Roadside · ${r.preferredRoadsidePoint.name}`
        : r.preferredPark
          ? parkDisplayName(r.preferredPark)
          : formatPhone(r.phone),
      choice,
    };
  });

  return (
    <MobileShell
      topBar={<TopBar title="Account" />}
      tabs={SENDER_TABS}
      className="gap-5 p-4"
    >
      <ProfileCard profile={profile} />

      {profile.vendor ? (
        <Section
          title="Business"
          action={
            <Badge tone="volt" dot={false}>
              Vendor
            </Badge>
          }
        >
          <Card className="px-4 py-1">
            <KeyValue label="Business" value={profile.vendor.businessName} />
            <KeyValue
              label="Payout account"
              value={
                profile.vendor.payoutAccountLast4
                  ? `${profile.vendor.payoutBank ?? "Bank"} ···· ${profile.vendor.payoutAccountLast4}`
                  : "Not added yet"
              }
            />
          </Card>
        </Section>
      ) : null}

      <SavedRecipients recipients={rows} options={options} />
      <Preferences profile={profile} />
      <SignOutBlock />
      {profile.signupPark ? (
        <p className="text-center text-caption text-fg-3">
          Joined through {profile.signupPark.name}
        </p>
      ) : null}
    </MobileShell>
  );
}
