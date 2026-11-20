import { z } from "zod";
import {
  CollectorKind,
  CreatedBy,
  DeliveryMode,
  DisputeStatus,
  DisputeType,
  Language,
  LedgerAccount,
  NotificationChannel,
  ParcelEventType,
  ParcelStatus,
  PaymentPurpose,
  PaymentStatus,
  Role,
  SizeClass,
  TripStatus,
} from "./enums";
import {
  Bay,
  Id,
  IsoDateTime,
  Kobo,
  KoboAmount,
  MaskedPhone,
  ParcelCode,
  ParkSlug,
  Phone,
  PublicToken,
  TxnRef,
} from "./primitives";

/**
 * Data shapes the API returns, one per screen or reusable piece. Screen ids
 * (S01, A03, D01 …) refer to docs/reference/screen-map.md.
 * FROZEN after Scope 01: add optional fields only.
 */

const nullable = <T extends z.ZodType>(t: T) => t.nullable();

// ─── Shared pieces ──────────────────────────────────────────────────────────

export const BySize = z.object({ S: KoboAmount, M: KoboAmount, L: KoboAmount });
export type BySize = z.infer<typeof BySize>;

export const ParkRef = z.object({
  id: Id,
  slug: ParkSlug,
  name: z.string(),
  city: z.string(),
});
export type ParkRef = z.infer<typeof ParkRef>;

export const PersonRef = z.object({
  name: z.string(),
  phone: Phone.optional(),
});
export type PersonRef = z.infer<typeof PersonRef>;

export const DriverRef = z.object({
  userId: Id,
  name: z.string(),
  vehiclePlate: z.string(),
  vehicleType: z.string().optional(),
  usesApp: z.boolean(),
  verified: z.boolean(),
});
export type DriverRef = z.infer<typeof DriverRef>;

export const RoadsidePointDto = z.object({
  id: Id,
  name: z.string(),
  order: z.number().int(),
  minutesFromOrigin: z.number().int(),
  lat: z.number(),
  lng: z.number(),
});
export type RoadsidePointDto = z.infer<typeof RoadsidePointDto>;

export const RouteSummary = z.object({
  id: Id,
  destination: ParkRef,
  typicalMinutes: z.number().int(),
  fareKobo: BySize,
  roadsidePoints: z.array(RoadsidePointDto),
});
export type RouteSummary = z.infer<typeof RouteSummary>;

/** Fee breakdown shown before payment (BOOK-4, S03 live total, S04). */
export const Quote = z.object({
  fareKobo: KoboAmount,
  platformFeeKobo: KoboAmount,
  insuranceKobo: KoboAmount,
  totalKobo: KoboAmount,
  podAmountKobo: KoboAmount,
  lines: z.array(z.object({ label: z.string(), amountKobo: Kobo })),
});
export type Quote = z.infer<typeof Quote>;

export const PaymentSummary = z.object({
  txnRef: TxnRef,
  purpose: PaymentPurpose,
  amountKobo: KoboAmount,
  status: PaymentStatus,
  verifiedAt: nullable(IsoDateTime),
});
export type PaymentSummary = z.infer<typeof PaymentSummary>;

export const TimelineEntry = z.object({
  type: ParcelEventType,
  title: z.string(),
  sub: nullable(z.string()),
  at: IsoDateTime,
  photoUrl: nullable(z.url()),
});
export type TimelineEntry = z.infer<typeof TimelineEntry>;

export const Notice = z.object({
  tone: z.enum(["neutral", "amber", "blue", "red", "green"]),
  message: z.string(),
});
export type Notice = z.infer<typeof Notice>;

// ─── People and accounts ────────────────────────────────────────────────────

export const SessionUser = z.object({
  id: Id,
  phone: Phone,
  name: nullable(z.string()),
  role: Role,
  /** Park an agent/driver/park admin belongs to. */
  park: nullable(ParkRef),
  /** Park whose subdomain a sender first signed up on (AUTH-3). */
  signupPark: nullable(ParkRef),
  isVendor: z.boolean(),
});
export type SessionUser = z.infer<typeof SessionUser>;

export const VendorProfileDto = z.object({
  businessName: z.string(),
  payoutBank: nullable(z.string()),
  payoutAccountName: nullable(z.string()),
  payoutAccountLast4: nullable(z.string().regex(/^\d{4}$/)),
});
export type VendorProfileDto = z.infer<typeof VendorProfileDto>;

/** S12 account screen. */
export const Profile = SessionUser.extend({
  language: Language,
  notifyChannel: NotificationChannel,
  vendor: nullable(VendorProfileDto),
});
export type Profile = z.infer<typeof Profile>;

export const SavedRecipientDto = z.object({
  id: Id,
  name: z.string(),
  phone: Phone,
  preferredPark: nullable(ParkRef),
  preferredRoadsidePoint: nullable(
    RoadsidePointDto.pick({ id: true, name: true }),
  ),
});
export type SavedRecipientDto = z.infer<typeof SavedRecipientDto>;

// ─── Parks ──────────────────────────────────────────────────────────────────

/** Public park page data, resolved from the subdomain (S01, PARK-1). */
export const ParkPublic = z.object({
  id: Id,
  slug: ParkSlug,
  name: z.string(),
  logoUrl: nullable(z.url()),
  city: z.string(),
  state: z.string(),
  address: z.string(),
  counterLocationText: nullable(z.string()),
  /** Day key ("mon"…"sun") → [opens, closes] as "HH:MM", null when closed. */
  openingHours: z.record(
    z.string(),
    nullable(z.tuple([z.string(), z.string()])),
  ),
  openNow: z.boolean(),
  closesAt: nullable(z.string()),
  storage: z.object({
    windowHours: z.number().int(),
    maxHoldDays: z.number().int(),
    dropoffDeadlineHours: z.number().int(),
    dailyRateKobo: BySize,
  }),
  routes: z.array(RouteSummary),
});
export type ParkPublic = z.infer<typeof ParkPublic>;

// ─── Parcels (sender side) ──────────────────────────────────────────────────

/** One row in lists (S08 my parcels, A01, P02). */
export const ParcelSummary = z.object({
  id: Id,
  parcelCode: ParcelCode,
  status: ParcelStatus,
  deliveryMode: DeliveryMode,
  recipientName: z.string(),
  senderName: z.string(),
  originPark: ParkRef,
  destinationPark: ParkRef,
  roadsidePointName: nullable(z.string()),
  sizeClass: SizeClass,
  category: z.string(),
  podAmountKobo: KoboAmount,
  totalKobo: KoboAmount,
  bay: nullable(Bay),
  etaMinutes: nullable(z.number().int()),
  dropoffDeadline: nullable(IsoDateTime),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type ParcelSummary = z.infer<typeof ParcelSummary>;

/** S08 vendor strip. */
export const VendorTotals = z.object({
  collectedThisMonthKobo: KoboAmount,
  awaitingCollectionKobo: KoboAmount,
});
export type VendorTotals = z.infer<typeof VendorTotals>;

/** Sender's parcel page (S09 awaiting drop-off, S10 in transit, S11 collected). */
export const ParcelDetail = ParcelSummary.extend({
  /** Only returned to the sender who owns it; it is the booking QR content. */
  publicId: PublicToken.optional(),
  description: z.string(),
  declaredValueKobo: KoboAmount,
  sender: PersonRef,
  recipient: PersonRef,
  roadsidePoint: nullable(RoadsidePointDto),
  driver: nullable(DriverRef),
  timeline: z.array(TimelineEntry),
  payments: z.array(PaymentSummary),
  dropoffPhotoUrl: nullable(z.url()),
  releasePhotoUrl: nullable(z.url()),
  collected: nullable(
    z.object({
      at: IsoDateTime,
      by: z.string(),
      kind: CollectorKind,
      releasedBy: z.string(),
      parkName: z.string(),
    }),
  ),
  storageDueKobo: KoboAmount,
  freeUntil: nullable(IsoDateTime),
  /** Live map is shown only while the driver app shares location (TRK-2). */
  live: nullable(
    z.object({ lat: z.number(), lng: z.number(), at: IsoDateTime }),
  ),
  cancellable: z.boolean(),
  /** S11 money breakdown for vendors: shipping, POD collected, fee, credited. */
  settlement: nullable(
    z.object({
      podCollectedKobo: KoboAmount,
      podFeeKobo: KoboAmount,
      creditedKobo: KoboAmount,
    }),
  ),
});
export type ParcelDetail = z.infer<typeof ParcelDetail>;

// ─── Recipient tracking (R01–R03) ───────────────────────────────────────────

export const TrackingStop = z.object({
  name: z.string(),
  kind: z.enum(["origin", "roadside", "destination"]),
  /** Departure time for the origin, ETA for later stops. */
  at: nullable(IsoDateTime),
  isYourStop: z.boolean(),
  passed: z.boolean(),
});
export type TrackingStop = z.infer<typeof TrackingStop>;

/** What the recipient sees through their signed link. Never the driver's exact position (RD-1). */
export const TrackingView = z.object({
  parcelCode: ParcelCode,
  status: ParcelStatus,
  deliveryMode: DeliveryMode,
  senderName: z.string(),
  sizeClass: SizeClass,
  category: z.string(),
  sentAt: IsoDateTime,
  stops: z.array(TrackingStop),
  eta: nullable(z.object({ minutes: z.number().int(), at: IsoDateTime })),
  /** ~20 minutes from the recipient's roadside stop (RD-2). */
  approaching: z.boolean(),
  driver: nullable(
    DriverRef.pick({ name: true, vehiclePlate: true, vehicleType: true }),
  ),
  dues: z.object({
    podKobo: KoboAmount,
    podPayee: nullable(z.string()),
    storageKobo: KoboAmount,
    totalKobo: KoboAmount,
    paid: z.boolean(),
  }),
  /** Shown after POD is paid for roadside handover (R02). */
  handoverCode: nullable(z.string().regex(/^\d{6}$/)),
  arrival: nullable(
    z.object({
      parkName: z.string(),
      parkSlug: ParkSlug,
      bay: nullable(Bay),
      arrivedAt: IsoDateTime,
      freeUntil: IsoDateTime,
      dailyRateKobo: KoboAmount,
      maxHoldDays: z.number().int(),
      counterLocationText: nullable(z.string()),
      openingHoursText: nullable(z.string()),
    }),
  ),
  collected: nullable(
    z.object({ at: IsoDateTime, by: z.string(), releasedBy: z.string() }),
  ),
});
export type TrackingView = z.infer<typeof TrackingView>;

// ─── Origin counter (A01–A07) ───────────────────────────────────────────────

/** What the agent sees after scanning a booking QR (HS-2, A03). */
export const HandshakeView = z.object({
  parcelId: Id,
  parcelCode: ParcelCode,
  status: ParcelStatus,
  createdBy: CreatedBy,
  sender: z.object({ name: z.string(), phone: Phone }),
  recipient: z.object({ name: z.string() }),
  destinationPark: ParkRef,
  deliveryMode: DeliveryMode,
  roadsidePointName: nullable(z.string()),
  category: z.string(),
  description: z.string(),
  sizeClass: SizeClass,
  declaredValueKobo: KoboAmount,
  podAmountKobo: KoboAmount,
  paidKobo: KoboAmount,
  /** Fare difference for each bigger size, for the top-up prompt (HS-5). */
  topUpIfKobo: z.object({ M: KoboAmount, L: KoboAmount }).partial(),
  scannedAt: IsoDateTime,
});
export type HandshakeView = z.infer<typeof HandshakeView>;

export const CounterRow = z.object({
  parcelId: Id,
  parcelCode: ParcelCode,
  senderName: z.string(),
  destinationCity: z.string(),
  sizeClass: SizeClass,
  status: ParcelStatus,
  /** "4:12 PM", "Due in 2h", "Yesterday". */
  note: z.string(),
});
export type CounterRow = z.infer<typeof CounterRow>;

/** A01 counter today. */
export const CounterToday = z.object({
  park: ParkRef,
  agentName: z.string(),
  kpis: z.object({
    expected: z.number().int(),
    checkedIn: z.number().int(),
    toAssign: z.number().int(),
  }),
  notices: z.array(Notice),
  expected: z.array(CounterRow),
  checkedIn: z.array(CounterRow),
});
export type CounterToday = z.infer<typeof CounterToday>;

/** A06 assign to driver. */
export const AssignView = z.object({
  groups: z.array(
    z.object({
      destination: ParkRef,
      parcels: z.array(
        z.object({
          parcelId: Id,
          parcelCode: ParcelCode,
          recipientName: z.string(),
          sizeClass: SizeClass,
          deliveryMode: DeliveryMode,
          roadsidePointName: nullable(z.string()),
        }),
      ),
    }),
  ),
  drivers: z.array(
    DriverRef.extend({
      departsAt: nullable(IsoDateTime),
      /** False for drivers not on the app (DRV-2). */
      canTakeRoadside: z.boolean(),
    }),
  ),
});
export type AssignView = z.infer<typeof AssignView>;

export const TripCard = z.object({
  tripId: Id,
  status: TripStatus,
  driver: DriverRef,
  destination: ParkRef,
  scheduledDepartureAt: nullable(IsoDateTime),
  acceptedAt: nullable(IsoDateTime),
  departedAt: nullable(IsoDateTime),
  arrivedAt: nullable(IsoDateTime),
  parcelCodes: z.array(ParcelCode),
  /** When the park admin is/was alerted about a load not accepted (DRV-5). */
  alertAt: nullable(IsoDateTime),
});
export type TripCard = z.infer<typeof TripCard>;

/** A07 loads. */
export const LoadsView = z.object({
  notAccepted: z.array(TripCard),
  onTheRoad: z.array(TripCard),
  departedToday: z.array(TripCard),
  handedOver: z.array(TripCard),
});
export type LoadsView = z.infer<typeof LoadsView>;

// ─── Driver (D01–D06) ───────────────────────────────────────────────────────

export const LoadParcel = z.object({
  parcelId: Id,
  parcelCode: ParcelCode,
  sizeClass: SizeClass,
  category: z.string(),
  recipientName: z.string(),
  status: ParcelStatus,
  /** Roadside only: POD paid (or nothing due), so handover is allowed (RD-3). */
  duesPaid: z.boolean(),
});
export type LoadParcel = z.infer<typeof LoadParcel>;

export const LoadStop = z.object({
  kind: z.enum(["roadside", "arrival"]),
  name: z.string(),
  order: z.number().int(),
  roadsidePointId: nullable(Id),
  parkId: nullable(Id),
  etaAt: nullable(IsoDateTime),
  passed: z.boolean(),
  parcels: z.array(LoadParcel),
});
export type LoadStop = z.infer<typeof LoadStop>;

/** D01 load to accept / D02 trip / D05 manifest. */
export const DriverLoad = z.object({
  trip: nullable(
    z.object({
      id: Id,
      status: TripStatus,
      vehiclePlate: z.string(),
      origin: ParkRef,
      destination: ParkRef,
      assignedByName: z.string(),
      assignedAt: IsoDateTime,
      scheduledDepartureAt: nullable(IsoDateTime),
      acceptedAt: nullable(IsoDateTime),
      departedAt: nullable(IsoDateTime),
      sharingLocation: z.boolean(),
    }),
  ),
  stops: z.array(LoadStop),
  manifest: nullable(
    z.object({
      token: PublicToken,
      destinationParkName: z.string(),
      parcelCodes: z.array(ParcelCode),
    }),
  ),
});
export type DriverLoad = z.infer<typeof DriverLoad>;

/** D06 earnings. */
export const EarningsView = z.object({
  periodKobo: KoboAmount,
  changePct: nullable(z.number()),
  byDay: z.array(z.object({ day: z.string(), kobo: KoboAmount })),
  trips: z.array(
    z.object({
      tripId: Id,
      label: z.string(),
      date: IsoDateTime,
      parcelCount: z.number().int(),
      kobo: KoboAmount,
      state: z.enum(["in_progress", "credited"]),
    }),
  ),
});
export type EarningsView = z.infer<typeof EarningsView>;

// ─── Arrival and collection (V01–V05, R04–R06) ──────────────────────────────

/** V01 arrivals. */
export const ArrivalsView = z.object({
  park: ParkRef,
  agentName: z.string(),
  arriving: z.array(
    z.object({
      tripId: Id,
      driver: DriverRef.pick({ name: true, vehiclePlate: true }),
      origin: ParkRef,
      parcelCount: z.number().int(),
      etaAt: nullable(IsoDateTime),
    }),
  ),
  store: z.object({
    held: z.number().int(),
    feesDue: z.number().int(),
    over5Days: z.number().int(),
  }),
});
export type ArrivalsView = z.infer<typeof ArrivalsView>;

/** V02 tick off the load, after scanning the manifest QR (ARR-1). */
export const ManifestView = z.object({
  manifestToken: PublicToken,
  tripId: Id,
  driver: DriverRef,
  origin: ParkRef,
  parcels: z.array(
    z.object({
      parcelId: Id,
      parcelCode: ParcelCode,
      sizeClass: SizeClass,
      recipientName: z.string(),
      dropoffPhotoUrl: nullable(z.url()),
      tickedOff: z.boolean(),
      bay: nullable(Bay),
      flag: nullable(z.enum(["MISSING", "DAMAGED"])),
    }),
  ),
});
export type ManifestView = z.infer<typeof ManifestView>;

/** V03 one parcel in the store. */
export const StoreItem = z.object({
  parcelId: Id,
  parcelCode: ParcelCode,
  recipientName: z.string(),
  bay: nullable(Bay),
  sizeClass: SizeClass,
  arrivedAt: IsoDateTime,
  freeUntil: IsoDateTime,
  daysHeld: z.number().int(),
  storageDueKobo: KoboAmount,
  locked: z.boolean(),
  lastDay: z.boolean(),
});
export type StoreItem = z.infer<typeof StoreItem>;

export const Dues = z.object({
  podKobo: KoboAmount,
  podPayee: nullable(z.string()),
  storageKobo: KoboAmount,
  totalKobo: KoboAmount,
  paid: z.boolean(),
  verifiedAt: nullable(IsoDateTime),
});
export type Dues = z.infer<typeof Dues>;

/** R04/R05 recipient at the counter after scanning the poster QR (COL-1). */
export const CollectView = z.object({
  park: z.object({
    name: z.string(),
    counterLocationText: nullable(z.string()),
  }),
  collectingAs: MaskedPhone,
  parcels: z.array(
    z.object({
      parcelId: Id,
      parcelCode: ParcelCode,
      senderName: z.string(),
      sizeClass: SizeClass,
      bay: nullable(Bay),
      dues: Dues,
      code: nullable(z.object({ sentTo: MaskedPhone, expiresAt: IsoDateTime })),
    }),
  ),
});
export type CollectView = z.infer<typeof CollectView>;

/** V04/V05 release screen for the arrival agent. */
export const ReleaseView = z.object({
  parcelId: Id,
  parcelCode: ParcelCode,
  bay: nullable(Bay),
  recipientName: z.string(),
  recipientPhone: MaskedPhone,
  sizeClass: SizeClass,
  dues: Dues,
  code: nullable(z.object({ sentTo: MaskedPhone, validUntil: IsoDateTime })),
  attemptsLeft: z.number().int().min(0).max(5),
  locked: z.boolean(),
  dropoffPhotoUrl: nullable(z.url()),
});
export type ReleaseView = z.infer<typeof ReleaseView>;

// ─── Money views ────────────────────────────────────────────────────────────

/** S05/S06 payment status page. */
export const PaymentStatusView = z.object({
  txnRef: TxnRef,
  purpose: PaymentPurpose,
  amountKobo: KoboAmount,
  status: PaymentStatus,
  responseCode: nullable(z.string()),
  /** Human reason for failures, e.g. "Card declined (51)". */
  reason: nullable(z.string()),
  parcelCode: ParcelCode,
  /** Where to send the payer when verified. */
  returnTo: z.string(),
});
export type PaymentStatusView = z.infer<typeof PaymentStatusView>;

export const LedgerEntryDto = z.object({
  id: Id,
  at: IsoDateTime,
  parcelCode: nullable(ParcelCode),
  account: LedgerAccount,
  /** "Vendor · Tolu's Fabrics", "Driver · Ade Lawal". */
  accountLabel: z.string(),
  reason: z.string(),
  amountKobo: Kobo,
  paymentRef: nullable(TxnRef),
});
export type LedgerEntryDto = z.infer<typeof LedgerEntryDto>;

/** P03 ledger and the per-account balance used by D06 and S08. */
export const LedgerView = z.object({
  account: LedgerAccount,
  balanceKobo: Kobo,
  totals: z.object({
    parkShareKobo: Kobo,
    driverSharesKobo: Kobo,
    collectedForVendorsKobo: Kobo,
    refundsKobo: Kobo,
  }),
  entries: z.array(LedgerEntryDto),
});
export type LedgerView = z.infer<typeof LedgerView>;

// ─── Admin (P01–P07) ────────────────────────────────────────────────────────

/** P01 park overview. */
export const ParkOverview = z.object({
  park: ParkRef,
  kpis: z.object({
    parcelsToday: z.number().int(),
    parcelsDelta: z.number().int(),
    onTheRoad: z.number().int(),
    busesOnRoad: z.number().int(),
    inStore: z.number().int(),
    withStorageFees: z.number().int(),
    revenueTodayKobo: Kobo,
    revenueDeltaPct: nullable(z.number()),
  }),
  series: z.array(z.object({ date: z.string(), count: z.number().int() })),
  needsAttention: z.array(
    z.object({
      kind: z.enum([
        "load_not_accepted",
        "missing_at_tickoff",
        "uncollected",
        "expiring_bookings",
      ]),
      title: z.string(),
      detail: z.string(),
      parcelCode: ParcelCode.optional(),
    }),
  ),
  liveTrips: z.array(TripCard),
});
export type ParkOverview = z.infer<typeof ParkOverview>;

export const DisputeDto = z.object({
  id: Id,
  parcelCode: ParcelCode,
  type: DisputeType,
  status: DisputeStatus,
  previousStatus: ParcelStatus,
  openedByName: nullable(z.string()),
  resolution: nullable(z.string()),
  createdAt: IsoDateTime,
  resolvedAt: nullable(IsoDateTime),
});
export type DisputeDto = z.infer<typeof DisputeDto>;
