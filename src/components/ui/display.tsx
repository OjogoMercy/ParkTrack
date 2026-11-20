import { formatNaira, formatNairaCompact } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Display atoms: Money (tabular, from kobo), Code (Geist Mono for anything
 * read aloud or written down), CodeTag, Avatar (initials), Kbd, Kpi tile.
 */

export function Money({
  kobo,
  sign,
  compact,
  className,
}: {
  kobo: number;
  sign?: boolean;
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("num", className)}>
      {compact ? formatNairaCompact(kobo) : formatNaira(kobo, { sign })}
    </span>
  );
}

/** Codes, plates and phone codes: PT-7K3Q, 482 913, OYO 482 KJ. */
export function Code({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("font-mono tracking-normal", className)}
      translate="no"
      {...props}
    />
  );
}

/** Small grey pill around a code, e.g. the parcel code in lists. */
export function CodeTag({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <Code
      className={cn(
        "rounded-badge bg-sunken px-1.5 py-[3px] text-[13px] font-semibold tracking-[0.02em]",
        className,
      )}
      {...props}
    />
  );
}

/** "Tolu Adeyemi" → "TA". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full border border-line bg-sunken font-semibold text-fg-2",
        size === "lg" ? "size-10 text-[14px]" : "size-8 text-[12px]",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "rounded-[4px] border border-line bg-panel px-[5px] py-px font-mono text-[11px] font-medium text-fg-3",
        className,
      )}
      {...props}
    />
  );
}

/** Dashboard KPI: label, big value, optional delta ("+14% on last Friday"). */
export function Kpi({
  label,
  value,
  delta,
  trend,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  delta?: React.ReactNode;
  trend?: "up" | "down" | "flat";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-card border border-line bg-panel p-4",
        className,
      )}
    >
      <span className="text-caption text-fg-3">{label}</span>
      <span className="text-kpi num">{value}</span>
      {delta ? (
        <span
          className={cn(
            "text-[12px] font-medium",
            trend === "up" && "text-green-fg",
            trend === "down" && "text-red-fg",
            (!trend || trend === "flat") && "text-fg-3",
          )}
        >
          {delta}
        </span>
      ) : null}
    </div>
  );
}
