import { redirect } from "next/navigation";
import { Suspense } from "react";
import { MobileShell, TopBar } from "@/components/ui/shells";
import { AcceptButton } from "@/features/driver/accept-button";
import { LoadView } from "@/features/driver/load-view";
import { getSession } from "@/server/auth";
import { driverLoadFor } from "@/server/trips";
import { loadCount } from "@/server/trips/load";

/**
 * D01 "Your load" (app.parktrack.ng/driver): the driver's assigned parcels
 * by stop in route order and Accept load. Signed-out visitors are sent to
 * sign-in by src/proxy.ts; other roles go back to their own home.
 *
 * Cache Components: the session and load are per request, so they're read
 * inside <Suspense>.
 */
export default function DriverLoadPage() {
  return (
    <Suspense
      fallback={
        <MobileShell topBar={<TopBar title="Your load" />}>
          <span className="sr-only">Loading your load</span>
        </MobileShell>
      }
    >
      <DriverLoad />
    </Suspense>
  );
}

async function DriverLoad() {
  const user = await getSession();
  if (!user || user.role !== "DRIVER") redirect("/");
  const load = await driverLoadFor(user.id);
  const count = loadCount(load);
  return (
    <LoadView
      load={load}
      driverName={user.name ?? user.phone}
      accept={
        load.trip ? <AcceptButton tripId={load.trip.id} count={count} /> : null
      }
    />
  );
}
