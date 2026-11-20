"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Navigation: BottomTabs (mobile apps, e.g. "Today · Loads · Me") and SideNav
 * (admin console sidebar). Active state comes from the current path.
 */

export type NavItem = {
  href: string;
  label: string;
  icon?: React.ReactNode;
  count?: React.ReactNode;
  /** Match only the exact path (use for index routes like /console/counter). */
  exact?: boolean;
};

function useIsActive() {
  const pathname = usePathname();
  return (item: NavItem) =>
    item.exact
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function BottomTabs({
  items,
  className,
}: {
  items: NavItem[];
  className?: string;
}) {
  const isActive = useIsActive();
  return (
    <nav
      aria-label="Main"
      className={cn(
        "grid h-16 shrink-0 border-t border-line bg-panel pb-[env(safe-area-inset-bottom)]",
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((item) => {
        const on = isActive(item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 text-tab text-fg-3 no-underline [&_svg]:size-5",
              on && "text-fg",
            )}
          >
            {item.icon}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function SideNav({
  items,
  label,
  className,
}: {
  items: NavItem[];
  label?: string;
  className?: string;
}) {
  const isActive = useIsActive();
  return (
    <nav
      aria-label={label ?? "Sections"}
      className={cn("flex flex-col gap-0.5", className)}
    >
      {label ? (
        <span className="px-2.5 pt-4 pb-1.5 text-caption text-fg-3">
          {label}
        </span>
      ) : null}
      {items.map((item) => {
        const on = isActive(item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "flex h-[34px] items-center gap-2.5 rounded-control px-2.5 text-sub font-medium text-fg-2 no-underline hover:bg-sunken hover:text-fg [&_svg]:size-4",
              on && "bg-sunken text-fg",
            )}
          >
            {item.icon}
            <span className="flex-1 truncate">{item.label}</span>
            {item.count != null ? (
              <span className="text-[12px] font-normal text-fg-3 num">
                {item.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
