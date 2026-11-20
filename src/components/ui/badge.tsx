import { cn } from "@/lib/utils";

/**
 * Badges (Foundations): colour only ever means status. Every badge has a dot
 * so it still reads in greyscale. Blue moving, amber needs action, green done,
 * red problem, neutral waiting/closed, volt live.
 */
export type BadgeTone = "neutral" | "blue" | "amber" | "green" | "red" | "volt";

const toneClass: Record<BadgeTone, string> = {
  neutral: "bg-sunken text-fg-2",
  blue: "bg-blue-bg text-blue-fg",
  amber: "bg-amber-bg text-amber-fg",
  green: "bg-green-bg text-green-fg",
  red: "bg-red-bg text-red-fg",
  volt: "bg-volt text-volt-ink",
};

export function Badge({
  tone = "neutral",
  dot = true,
  className,
  children,
  ...props
}: React.ComponentProps<"span"> & { tone?: BadgeTone; dot?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-badge px-2 text-[12px] leading-none font-medium whitespace-nowrap",
        toneClass[tone],
        className,
      )}
      {...props}
    >
      {dot ? (
        <span aria-hidden className="size-1.5 rounded-full bg-current" />
      ) : null}
      {children}
    </span>
  );
}

/**
 * Parcel status → label and tone, matching the designs (PRD §8 states).
 * The status union is redeclared from src/contracts once Scope 01 sl8 lands.
 */
export const PARCEL_STATUS_BADGE = {
  DRAFT: { label: "Draft", tone: "neutral" },
  AWAITING_DROPOFF: { label: "Awaiting drop-off", tone: "neutral" },
  RECEIVED_AT_ORIGIN: { label: "At origin park", tone: "blue" },
  ASSIGNED: { label: "Assigned", tone: "blue" },
  IN_TRANSIT: { label: "In transit", tone: "blue" },
  DELIVERED_ROADSIDE: { label: "Delivered roadside", tone: "green" },
  ARRIVED: { label: "Ready to collect", tone: "amber" },
  COLLECTED: { label: "Collected", tone: "green" },
  SETTLED: { label: "Settled", tone: "green" },
  UNCLAIMED: { label: "Unclaimed", tone: "amber" },
  RETURNED: { label: "Returned", tone: "neutral" },
  DISPUTED: { label: "Disputed", tone: "red" },
  RESOLVED: { label: "Resolved", tone: "neutral" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
} as const satisfies Record<string, { label: string; tone: BadgeTone }>;

export type ParcelStatusKey = keyof typeof PARCEL_STATUS_BADGE;

export function StatusBadge({
  status,
  className,
}: {
  status: ParcelStatusKey;
  className?: string;
}) {
  const { label, tone } = PARCEL_STATUS_BADGE[status];
  return (
    <Badge tone={tone} className={className}>
      {label}
    </Badge>
  );
}

/** Green pulsing dot for live states ("Sharing location", "Live"). */
export function LiveDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2 shrink-0 rounded-full bg-live shadow-[0_0_0_3px_rgba(101,163,13,0.2)]",
        className,
      )}
    />
  );
}
