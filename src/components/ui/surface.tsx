import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Surfaces (Foundations): rows over boxes; cards group, they don't decorate.
 * Card, List/ListRow, KeyValue, Notice, Section, Divider.
 */

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-card border border-line bg-panel", className)}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  action,
  className,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 border-b border-line px-4 py-3.5",
        className,
      )}
    >
      <h3 className="flex-1 text-sub font-semibold tracking-[-0.01em]">
        {title}
      </h3>
      {action}
    </div>
  );
}

/** A titled group of content with an optional action on the right. */
export function Section({
  title,
  action,
  className,
  children,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("flex flex-col gap-2", className)}>
      {title || action ? (
        <div className="flex items-center justify-between px-1">
          {title ? (
            <h2 className="text-caption text-fg-3">{title}</h2>
          ) : (
            <span />
          )}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function List({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col", className)} {...props} />;
}

/**
 * One row: optional leading avatar/tile, title + subtitle, trailing badge/amount.
 * Pass `href` to make the whole row a link.
 */
export function ListRow({
  title,
  sub,
  leading,
  trailing,
  href,
  className,
}: {
  title: React.ReactNode;
  sub?: React.ReactNode;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  href?: string;
  className?: string;
}) {
  const inner = (
    <>
      {leading}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] leading-5 font-medium">
          {title}
        </span>
        {sub ? (
          <span className="truncate text-small text-fg-3">{sub}</span>
        ) : null}
      </div>
      {trailing}
    </>
  );
  const cls = cn(
    "flex items-center gap-3 border-t border-line px-4 py-3 text-inherit no-underline first:border-t-0",
    href && "hover:bg-bg",
    className,
  );
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

/** Label/value line, e.g. "Declared value ₦45,000". Values are tabular. */
export function KeyValue({
  label,
  value,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 py-2 text-sub",
        className,
      )}
    >
      <span className="text-fg-3">{label}</span>
      <span className="text-right font-medium num">{value}</span>
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return (
    <div role="separator" className={cn("h-px shrink-0 bg-line", className)} />
  );
}

export type NoticeTone = "neutral" | "amber" | "blue" | "red" | "green";

const noticeTone: Record<NoticeTone, string> = {
  neutral: "bg-sunken text-fg-2",
  amber: "bg-amber-bg text-amber-fg",
  blue: "bg-blue-bg text-blue-fg",
  red: "bg-red-bg text-red-fg",
  green: "bg-green-bg text-green-fg",
};

/** Inline notice, e.g. amber "Musa hasn't accepted his load. Departs 10:30 AM." */
export function Notice({
  tone = "neutral",
  icon,
  className,
  children,
}: {
  tone?: NoticeTone;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role={tone === "red" || tone === "amber" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-control p-3 text-small",
        noticeTone[tone],
        className,
      )}
    >
      {icon ? (
        <span className="mt-px shrink-0 [&_svg]:size-4">{icon}</span>
      ) : null}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** Rounded square for an icon (36px). */
export function Tile({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-control bg-sunken text-fg-2 [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}
