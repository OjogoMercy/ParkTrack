import { redirect } from "next/navigation";
import { Suspense } from "react";
import { consoleHome } from "@/features/identity/redirects";
import { getSession } from "@/server/auth";

/**
 * parktrack.ng/console — sends each signed-in staff member to their role's
 * home (agent → /console/counter, driver → /console/driver, park admin →
 * /console/park, platform admin → /console/platform). Signed-out visitors
 * never get here: src/proxy.ts sends them to /signin first. A USER account
 * (no staff role) goes home.
 */
export default function ConsoleHome() {
  return (
    <Suspense fallback={null}>
      <RoleRedirect />
    </Suspense>
  );
}

async function RoleRedirect(): Promise<null> {
  const user = await getSession();
  const home = user ? consoleHome(user.role) : null;
  redirect(home ?? "/");
}
