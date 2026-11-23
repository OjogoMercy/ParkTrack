import { Suspense } from "react";
import { TopBar } from "@/components/ui/shells";
import { parkHostLabel } from "@/server/parks/host";
import { HeaderAccount, HeaderAccountSkeleton } from "./header-account";
import { ParkInitials } from "./logo";

/**
 * Park top bar from S01/S08: initials tile, park name, subdomain, and on the
 * right either "Sign in" or the signed-in person's initials (linking to
 * /account). Pages on a park subdomain pass it to <MobileShell topBar={…}>.
 * Pass `trailing` to replace the right side with the page's own control.
 *
 * The account slot reads the session inside its own <Suspense>, so the rest
 * of the bar stays in the cached shell and renders instantly.
 */
export function ParkHeader({
  park,
  trailing,
  signInNext,
}: {
  park: { slug: string; name: string };
  trailing?: React.ReactNode;
  /** Path to return to after signing in, e.g. "/send". */
  signInNext?: string;
}) {
  const host = parkHostLabel(
    park.slug,
    process.env.ROOT_DOMAIN || "localhost:3000",
  );
  const signInHref = signInNext
    ? `/signin?next=${encodeURIComponent(signInNext)}`
    : "/signin";
  return (
    <TopBar
      leading={<ParkInitials name={park.slug} />}
      title={<span className="text-[15px]">{park.name}</span>}
      sub={host}
      trailing={
        trailing ?? (
          <Suspense fallback={<HeaderAccountSkeleton />}>
            <HeaderAccount signInHref={signInHref} />
          </Suspense>
        )
      }
    />
  );
}

/** Same bar while the park is loading (keeps the layout from jumping). */
export function ParkHeaderSkeleton() {
  return (
    <TopBar
      leading={
        <span className="size-8 rounded-control bg-sunken" aria-hidden />
      }
      title={
        <span className="block h-4 w-40 rounded-badge bg-sunken" aria-hidden />
      }
    />
  );
}
