import { redirect } from "next/navigation";
import { Suspense } from "react";
import { consoleHome, consolePublicPath } from "@/features/identity/redirects";
import { getSession } from "@/server/auth";

/**
 * app.parktrack.ng/ — sends each signed-in staff member to their role's home
 * (agent → /counter, driver → /driver, park admin → /park, platform admin →
 * /platform). Signed-out visitors never get here: src/proxy.ts sends them to
 * /signin first. A sender (no console role) goes back to sign-in.
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
  redirect(home ? consolePublicPath(home) : "/signin");
}
