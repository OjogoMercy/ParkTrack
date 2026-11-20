import Link from "next/link";
import { ChevronLeft, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "./button";
import { Avatar, Kbd } from "./display";
import { BottomTabs, SideNav, type NavItem } from "./nav";

/**
 * App shells from the designs.
 *
 * MobileShell: every phone screen (senders, recipients, agents, drivers).
 *   Designed at 390px; on wider screens it stays a centred column.
 *   Top bar (56px) · scrolling content · bottom tabs OR a sticky action bar.
 * ConsoleShell: park admin and platform admin (P01–P07).
 *   232px sidebar · 56px header with search · body up to 1240px.
 */

export function TopBar({
  title,
  sub,
  backHref,
  leading,
  trailing,
  className,
}: {
  title?: React.ReactNode;
  sub?: React.ReactNode;
  /** Shows a back chevron linking here. */
  backHref?: string;
  /** Replaces the back button, e.g. a park avatar. */
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-panel pr-3 pl-4",
        className,
      )}
    >
      {backHref ? (
        <Link
          href={backHref}
          aria-label="Back"
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "-ml-2",
          )}
        >
          <ChevronLeft className="size-5" />
        </Link>
      ) : (
        leading
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        {title ? (
          <h1 className="truncate text-[16px] font-semibold tracking-[-0.01em]">
            {title}
          </h1>
        ) : null}
        {sub ? (
          <span className="truncate text-caption font-normal text-fg-3">
            {sub}
          </span>
        ) : null}
      </div>
      {trailing}
    </header>
  );
}

/** Sticky footer for the main action(s) of a screen, e.g. "Pay ₦2,650". */
export function BottomBar({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 mt-auto flex shrink-0 flex-col gap-2.5 border-t border-line bg-panel px-4 pt-3 pb-[max(20px,env(safe-area-inset-bottom))]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function MobileShell({
  topBar,
  tabs,
  bottomBar,
  className,
  children,
}: {
  topBar?: React.ReactNode;
  /** Bottom tabs for app home screens (e.g. Today · Loads · Me). */
  tabs?: NavItem[];
  /** Sticky action bar for task screens. Don't combine with `tabs`. */
  bottomBar?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-bg sm:bg-sunken">
      <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-bg sm:border-x sm:border-line">
        {topBar}
        <main className={cn("flex flex-1 flex-col gap-4 p-4", className)}>
          {children}
        </main>
        {bottomBar}
        {tabs ? (
          <BottomTabs items={tabs} className="sticky bottom-0 z-10" />
        ) : null}
      </div>
    </div>
  );
}

export function ConsoleShell({
  brand,
  nav,
  user,
  title,
  actions,
  search = true,
  className,
  children,
}: {
  /** Top of the sidebar, e.g. park initials + name + subdomain. */
  brand: { name: string; sub?: string };
  nav: { label?: string; items: NavItem[] }[];
  user: { name: string; role: string };
  title: React.ReactNode;
  actions?: React.ReactNode;
  /** Shows the "Search parcels, phones, codes ⌘K" box (wired up by Scope 09). */
  search?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-wrap items-stretch bg-bg text-sub">
      <aside className="flex w-full flex-col gap-0.5 border-b border-line bg-panel p-3 lg:w-[232px] lg:shrink-0 lg:border-r lg:border-b-0">
        <div className="flex items-center gap-2.5 px-1.5 pt-1 pb-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-control bg-fg text-[12px] font-semibold text-volt">
            {brand.name
              .split(/\s+/)
              .slice(0, 2)
              .map((w) => w[0])
              .join("")
              .toUpperCase()}
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sub font-semibold">
              {brand.name}
            </span>
            {brand.sub ? (
              <span className="truncate text-caption font-normal text-fg-3">
                {brand.sub}
              </span>
            ) : null}
          </div>
        </div>
        {nav.map((group, i) => (
          <SideNav
            key={group.label ?? i}
            label={group.label}
            items={group.items}
          />
        ))}
        <div className="mt-auto hidden items-center gap-2.5 border-t border-line px-1.5 pt-3 lg:flex">
          <Avatar name={user.name} />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-small font-medium">{user.name}</span>
            <span className="truncate text-caption font-normal text-fg-3">
              {user.role}
            </span>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-[999_1_560px] flex-col">
        <div className="flex min-h-14 flex-wrap items-center gap-3 border-b border-line bg-panel px-6 py-2">
          <h1 className="flex-1 text-[16px] font-semibold tracking-[-0.01em]">
            {title}
          </h1>
          {search ? (
            <div className="flex h-[34px] w-[280px] max-w-full items-center gap-2 rounded-control border border-line bg-bg px-2.5 text-small text-fg-3">
              <Search className="size-4" />
              <span className="flex-1 truncate">
                Search parcels, phones, codes
              </span>
              <Kbd>⌘K</Kbd>
            </div>
          ) : null}
          {actions}
        </div>
        <main
          className={cn(
            "flex w-full max-w-[1240px] flex-col gap-5 p-6",
            className,
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
