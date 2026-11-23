import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { TopBar } from "@/components/ui/shells";
import { parkHostLabel } from "@/server/parks/host";
import { ParkInitials } from "./logo";

/**
 * Park top bar from S01/S08: initials tile, park name, subdomain, and a
 * "Sign in" button on the right. Pages on a park subdomain pass it to
 * <MobileShell topBar={…}>. Pass `trailing` to replace "Sign in" (for
 * example with the signed-in user's avatar, from Scope 02 sl4).
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
      leading={<ParkInitials name={park.name} />}
      title={<span className="text-[15px]">{park.name}</span>}
      sub={host}
      trailing={
        trailing ?? (
          <Link
            href={signInHref}
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            Sign in
          </Link>
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
