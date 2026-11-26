import type { ParcelDetail } from "@/contracts/dto";
import { formatDay, formatTime } from "@/lib/dates";
import { APPROACH_MINUTES, shortPark } from "@/server/tracking/journey";

/**
 * The sender's timeline (S09–S11): what already happened (from parcel
 * events, done), what is happening now, and what comes next (todo). Pure,
 * so it is unit-tested.
 */

export type Step = {
  title: string;
  sub: string | null;
  meta: string | null;
  state: "done" | "now" | "todo";
};

const first = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** "9:14 AM" today, else "Thu 4:12 PM". */
export function stepTime(at: string, now: Date): string {
  const same = formatDay(at) === formatDay(now);
  return same
    ? formatTime(at)
    : `${formatDay(at).split(" ")[0]} ${formatTime(at)}`;
}

export function journeySteps(p: ParcelDetail, now: Date): Step[] {
  const done: Step[] = p.timeline.map((e) => ({
    title: e.title,
    sub: e.sub,
    meta: stepTime(e.at, now),
    state: "done",
  }));

  const roadside = p.deliveryMode === "ROADSIDE" && p.roadsidePoint;
  const toCity = p.destinationPark.city;
  const endSteps: string[] = roadside
    ? [`Handover at ${p.roadsidePoint!.name}`]
    : [
        `Ready at ${p.destinationPark.name}`,
        `Collected by ${first(p.recipientName)}`,
      ];
  const todo = (titles: string[]): Step[] =>
    titles.map((title) => ({ title, sub: null, meta: null, state: "todo" }));
  const now_ = (title: string, sub: string | null = null): Step => ({
    title,
    sub,
    meta: null,
    state: "now",
  });

  switch (p.status) {
    case "AWAITING_DROPOFF":
      return [
        ...done,
        now_(
          `Drop off at ${p.originPark.name}`,
          "The agent scans your QR and photographs the parcel",
        ),
        ...todo([`On the road to ${toCity}`, ...endSteps]),
      ];
    case "RECEIVED_AT_ORIGIN":
      return [
        ...done,
        now_(
          "Waiting for a bus",
          `An agent puts it on the next bus to ${toCity}`,
        ),
        ...todo([`On the road to ${toCity}`, ...endSteps]),
      ];
    case "ASSIGNED":
      return [
        ...done,
        now_(
          p.driver
            ? `Waiting for ${first(p.driver.name)} to accept the load`
            : "Waiting for the driver to accept the load",
        ),
        ...todo([`On the road to ${toCity}`, ...endSteps]),
      ];
    case "IN_TRANSIT":
      return [
        ...done,
        now_(
          "On the road",
          roadside
            ? `${first(p.recipientName)} is alerted ${APPROACH_MINUTES} minutes before the bus reaches ${p.roadsidePoint!.name}`
            : `To ${shortPark(p.destinationPark.name)}, ${toCity}`,
        ),
        ...todo(endSteps),
      ];
    case "ARRIVED":
      return [
        ...done,
        now_(
          `Collected by ${first(p.recipientName)}`,
          `Waiting at ${p.destinationPark.name}`,
        ),
      ];
    default:
      // Delivered, collected, settled, cancelled, under review…: the events
      // tell the whole story.
      return done;
  }
}
