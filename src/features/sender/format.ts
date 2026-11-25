/** Journey time as the designs write it: 90 → "1h 30m", 540 → "9h", 45 → "45m". */
export function formatJourney(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** "Ibadan · Iwo Road Park" (city first, as S01 and S03 list destinations). */
export function destinationLabel(park: { city: string; name: string }): string {
  return park.name.toLowerCase().startsWith(park.city.toLowerCase())
    ? park.name
    : `${park.city} · ${park.name}`;
}

type RowParcel = {
  parcelCode: string;
  status: string;
  deliveryMode: "PARK" | "ROADSIDE";
  originPark: { city: string };
  destinationPark: { name: string };
  roadsidePointName: string | null;
  bay: string | null;
  etaMinutes: number | null;
  dropoffDeadline: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Unpaid bookings are kept this long (Scope 03 createDraft). */
const DRAFT_HOURS = 24;

/**
 * The second line of an S08 row, after the PT- code: what matters about
 * the parcel right now ("Drop off by Sat 22 Nov, 6:00 PM", "Owode
 * junction · ~1h 10m", "Iwo Road Park · bay C4", "Collected Fri 14 Nov").
 * `day` and `dayTime` format dates in Lagos time.
 */
export function parcelRowDetail(
  p: RowParcel,
  fmt: { day: (d: Date) => string; dayTime: (d: Date) => string },
  now: Date = new Date(),
): string {
  const updated = new Date(p.updatedAt);
  const eta = p.etaMinutes != null ? ` · ~${formatJourney(p.etaMinutes)}` : "";
  switch (p.status) {
    case "DRAFT": {
      const left =
        new Date(p.createdAt).getTime() +
        DRAFT_HOURS * 3600_000 -
        now.getTime();
      if (left <= 0) return "Not paid · expired";
      const hours = Math.ceil(left / 3600_000);
      return `Not paid · pay within ${hours}h`;
    }
    case "AWAITING_DROPOFF":
      return p.dropoffDeadline
        ? `Drop off by ${fmt.dayTime(new Date(p.dropoffDeadline))}`
        : "Waiting for drop-off";
    case "RECEIVED_AT_ORIGIN":
      return `Checked in at ${p.originPark.city}`;
    case "ASSIGNED":
    case "IN_TRANSIT":
      return `${p.deliveryMode === "ROADSIDE" && p.roadsidePointName ? p.roadsidePointName : p.destinationPark.name}${eta}`;
    case "ARRIVED":
    case "UNCLAIMED":
      return `${p.destinationPark.name}${p.bay ? ` · bay ${p.bay}` : ""}`;
    case "DELIVERED_ROADSIDE":
      return `Roadside · ${fmt.day(updated)}`;
    case "COLLECTED":
    case "SETTLED":
      return p.deliveryMode === "ROADSIDE"
        ? `Roadside · ${fmt.day(updated)}`
        : `Collected ${fmt.day(updated)}`;
    case "CANCELLED":
      return "Cancelled · refunded if paid";
    case "RETURNED":
      return "Returned to you";
    case "DISPUTED":
      return "Case open";
    case "RESOLVED":
      return "Case closed";
    default:
      return p.destinationPark.name;
  }
}

/** Where an S08 row goes: pay it, show its QR, or follow it (Scope 07). */
export function parcelRowHref(p: {
  parcelCode: string;
  status: string;
}): string {
  if (p.status === "DRAFT") return `/send/review?parcel=${p.parcelCode}`;
  if (p.status === "AWAITING_DROPOFF") return `/parcels/booked/${p.parcelCode}`;
  return `/parcels/${p.parcelCode}`;
}
