import { cn } from "@/lib/utils";

/** ParkTrack mark from the designs: Volt square with a route line. */
export function ParkTrackMark({
  size = 24,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      className={cn("shrink-0", className)}
    >
      <rect width="24" height="24" rx="6" fill="#D4F86A" />
      <path
        d="M6 16.5 10.5 12l3 3L18 8.5"
        fill="none"
        stroke="#09090B"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="6" cy="16.5" r="1.7" fill="#09090B" />
    </svg>
  );
}

/** Mark + "ParkTrack" wordmark (S13 top bar, sign-in screens). */
export function ParkTrackLogo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <ParkTrackMark />
      <span className="text-[15px] font-semibold tracking-[-0.03em]">
        ParkTrack
      </span>
    </span>
  );
}

/** Dark rounded tile with park initials ("OG", "IR"), as in S01/S13. */
export function ParkInitials({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const letters = name
    .replace(/[^A-Za-z ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-control bg-fg text-[12px] font-semibold tracking-[-0.02em] text-white",
        className,
      )}
    >
      {letters || "P"}
    </span>
  );
}
