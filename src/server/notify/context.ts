import "server-only";
import type { ParcelStatus } from "@/contracts/enums";
import type { Audience } from "@/contracts/notifications";
import { db } from "@/lib/db";
import { signRecipientLink } from "@/server/auth";
import type { LiveChannel } from "./channels";
import { messageLinks } from "./links";
import type { MessageContext } from "./templates";

export type Person = {
  audience: Audience;
  phone: string;
  preferred: LiveChannel;
};

/** Before the drop-off handshake the recipient hears nothing (HS-7). */
const BEFORE_HANDSHAKE: readonly ParcelStatus[] = ["DRAFT", "AWAITING_DROPOFF"];

const channelOf = (c: string | null | undefined): LiveChannel =>
  c === "SMS" ? "SMS" : "WHATSAPP";

/**
 * Everything the templates need for one parcel, plus who should hear the
 * message: one entry per phone per audience. Returns null for an unknown
 * parcel.
 */
export async function loadMessageContext(
  parcelId: string,
  audiences: readonly Audience[],
  extra: Record<string, string | number>,
  { rootDomain, now = new Date() }: { rootDomain: string; now?: Date },
): Promise<{ context: MessageContext; people: Person[] } | null> {
  const parcel = await db.parcel.findUnique({
    where: { id: parcelId },
    include: {
      sender: { select: { name: true, phone: true, notifyChannel: true } },
      originPark: {
        select: { id: true, name: true, city: true, slug: true },
      },
      destinationPark: {
        select: {
          id: true,
          name: true,
          city: true,
          counterLocationText: true,
          storageWindowHours: true,
        },
      },
      roadsidePoint: { select: { name: true, minutesFromOrigin: true } },
      route: { select: { typicalMinutes: true } },
      tripParcels: {
        orderBy: { assignedAt: "desc" },
        take: 1,
        select: {
          trip: {
            select: {
              vehiclePlate: true,
              driver: {
                select: { name: true, phone: true, notifyChannel: true },
              },
            },
          },
        },
      },
    },
  });
  if (!parcel) return null;

  const trip = parcel.tripParcels[0]?.trip ?? null;
  const recipientAllowed = !BEFORE_HANDSHAKE.includes(parcel.status);
  const wantsRecipient = audiences.includes("recipient") && recipientAllowed;

  const [rate, recipientUser, staff, recipientToken] = await Promise.all([
    db.storageRate.findFirst({
      where: {
        parkId: parcel.destinationParkId,
        sizeClass: parcel.sizeClass,
        effectiveFrom: { lte: now },
      },
      orderBy: { effectiveFrom: "desc" },
      select: { dailyRateKobo: true },
    }),
    wantsRecipient
      ? db.user.findUnique({
          where: { phone: parcel.recipientPhone },
          select: { notifyChannel: true },
        })
      : null,
    staffFor(audiences, parcel.originParkId, parcel.destinationParkId),
    wantsRecipient ? signRecipientLink(parcel.id) : null,
  ]);

  const notifiedAt = parcel.arrivalNotifiedAt ?? now;
  const context: MessageContext = {
    parcelCode: parcel.parcelCode,
    recipientName: parcel.recipientName,
    senderName: parcel.sender?.name ?? "Someone",
    originPark: parcel.originPark,
    destinationPark: parcel.destinationPark,
    deliveryMode: parcel.deliveryMode,
    roadsidePointName: parcel.roadsidePoint?.name ?? null,
    bay: parcel.bay,
    dropoffDeadline: parcel.dropoffDeadline,
    podAmountKobo: parcel.podAmountKobo,
    totalKobo: parcel.totalKobo,
    driver: trip ? { name: trip.driver.name, plate: trip.vehiclePlate } : null,
    storage: {
      freeUntil: new Date(
        notifiedAt.getTime() +
          parcel.destinationPark.storageWindowHours * 60 * 60 * 1000,
      ),
      dailyRateKobo: rate?.dailyRateKobo ?? 0,
    },
    minutesToDestination:
      parcel.deliveryMode === "ROADSIDE" && parcel.roadsidePoint
        ? parcel.roadsidePoint.minutesFromOrigin
        : parcel.route.typicalMinutes,
    links: messageLinks({
      rootDomain,
      originSlug: parcel.originPark.slug,
      parcelCode: parcel.parcelCode,
      recipientToken,
    }),
    now,
    extra,
  };

  const people: Person[] = [];
  for (const audience of audiences) {
    switch (audience) {
      case "sender":
        if (parcel.sender)
          people.push({
            audience,
            phone: parcel.sender.phone,
            preferred: channelOf(parcel.sender.notifyChannel),
          });
        break;
      case "recipient":
        if (wantsRecipient)
          people.push({
            audience,
            phone: parcel.recipientPhone,
            preferred: channelOf(recipientUser?.notifyChannel),
          });
        break;
      case "driver":
        if (trip)
          people.push({
            audience,
            phone: trip.driver.phone,
            preferred: channelOf(trip.driver.notifyChannel),
          });
        break;
      default:
        for (const s of staff[audience] ?? [])
          people.push({
            audience,
            phone: s.phone,
            preferred: channelOf(s.notifyChannel),
          });
    }
  }
  return { context, people };
}

/** Active agents and park admins the event goes to. */
async function staffFor(
  audiences: readonly Audience[],
  originParkId: string,
  destinationParkId: string,
): Promise<
  Partial<Record<Audience, { phone: string; notifyChannel: string }[]>>
> {
  const out: Partial<
    Record<Audience, { phone: string; notifyChannel: string }[]>
  > = {};
  const find = (role: "AGENT" | "PARK_ADMIN", parkIds: string[]) =>
    db.user.findMany({
      where: { role, status: "ACTIVE", parkId: { in: parkIds } },
      select: { phone: true, notifyChannel: true },
    });
  if (audiences.includes("origin_agent"))
    out.origin_agent = await find("AGENT", [originParkId]);
  if (audiences.includes("arrival_agent"))
    out.arrival_agent = await find("AGENT", [destinationParkId]);
  if (audiences.includes("park_admin"))
    out.park_admin = await find("PARK_ADMIN", [
      originParkId,
      destinationParkId,
    ]);
  return out;
}
