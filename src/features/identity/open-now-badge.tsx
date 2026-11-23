"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { formatClock, openStatus, type OpeningHours } from "@/lib/dates";

/**
 * "Open · closes 7:00 PM" / "Closed now" badge (S01). Worked out in the
 * browser from the park's opening hours (always in Lagos time), so park pages
 * stay cached and prerenderable. Rechecks every minute; renders nothing until
 * mounted to avoid a server/browser mismatch.
 */
export function OpenNowBadge({
  hours,
  className,
}: {
  hours: OpeningHours;
  className?: string;
}) {
  const [status, setStatus] = useState<ReturnType<typeof openStatus> | null>(
    null,
  );

  useEffect(() => {
    const update = () => setStatus(openStatus(hours));
    update();
    const id = window.setInterval(update, 60_000);
    return () => window.clearInterval(id);
  }, [hours]);

  if (!status)
    return (
      <span
        aria-hidden
        className={`inline-block h-[22px] ${className ?? ""}`}
      />
    );
  return status.open ? (
    <Badge tone="green" className={className}>
      Open · closes {status.closesAt ? formatClock(status.closesAt) : "later"}
    </Badge>
  ) : (
    <Badge tone="neutral" className={className}>
      Closed now
    </Badge>
  );
}
