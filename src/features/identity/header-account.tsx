import Link from "next/link";
import { UserRound } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Avatar } from "@/components/ui/display";
import { getSession } from "@/server/auth";

/**
 * Right side of the park top bar: the signed-in person's initials (S08),
 * linking to their account (S12, /account), or "Sign in" (S01).
 *
 * Reads the session, so it must sit inside <Suspense>; ParkHeader does that
 * with <HeaderAccountSkeleton /> as the fallback.
 */
export async function HeaderAccount({ signInHref }: { signInHref: string }) {
  const user = await getSession();
  if (!user) {
    return (
      <Link
        href={signInHref}
        className={buttonVariants({ variant: "secondary", size: "sm" })}
      >
        Sign in
      </Link>
    );
  }
  const label = user.name ? `Account: ${user.name}` : "Account";
  return (
    <Link
      href="/account"
      aria-label={label}
      className="rounded-full outline-none focus-visible:shadow-focus"
    >
      {user.name ? (
        <Avatar name={user.name} />
      ) : (
        <span className="grid size-8 place-items-center rounded-full border border-line bg-sunken text-fg-2">
          <UserRound className="size-4" aria-hidden />
        </span>
      )}
    </Link>
  );
}

/** Same footprint while the session loads, so the bar doesn't jump. */
export function HeaderAccountSkeleton() {
  return <span aria-hidden className="size-8 rounded-full bg-sunken" />;
}
