import { z } from "zod";
import * as D from "./dto";
import {
  CollectorKind,
  DeliveryMode,
  DisputeType,
  HandshakeMethod,
  ItemCategory,
  Language,
  LedgerAccount,
  NotificationChannel,
  PaymentPurpose,
  SizeClass,
} from "./enums";
import {
  Bay,
  Id,
  IsoDateTime,
  KoboAmount,
  LatLng,
  MaskedPhone,
  Ok,
  ParkSlug,
  PhoneInput,
  PublicToken,
  SixDigitCode,
  TxnRef,
} from "./primitives";

/**
 * Request and response schemas for every API route (PRD §13 plus the routes
 * added in docs/scopes/02–09). Grouped by owning scope. Route handlers parse
 * the request with `.parse()` and return data that satisfies the response.
 * FROZEN after Scope 01: add optional fields or new routes only.
 */

type Route = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
};

// ─── Scope 02: auth and parks ───────────────────────────────────────────────

export const AuthOtp = {
  route: { method: "POST", path: "/api/auth/otp" } satisfies Route,
  body: z.object({
    phone: PhoneInput,
    channel: z.enum(["WHATSAPP", "SMS"]).optional(),
  }),
  response: z.object({
    sent: z.literal(true),
    channel: z.enum(["WHATSAPP", "SMS"]),
    sentTo: MaskedPhone,
    resendInSeconds: z.number().int(),
  }),
};

export const AuthVerify = {
  route: { method: "POST", path: "/api/auth/verify" } satisfies Route,
  body: z.object({ phone: PhoneInput, code: SixDigitCode }),
  response: z.object({ user: D.SessionUser, isNew: z.boolean() }),
};

export const AuthSignout = {
  route: { method: "POST", path: "/api/auth/signout" } satisfies Route,
  response: Ok,
};

export const GetPark = {
  route: { method: "GET", path: "/api/park" } satisfies Route,
  response: D.ParkPublic,
};

// ─── Scope 03: uploads ──────────────────────────────────────────────────────

export const CreateUpload = {
  route: { method: "POST", path: "/api/uploads" } satisfies Route,
  body: z.object({
    kind: z.enum(["dropoff", "arrival_damage", "release", "collector"]),
    parcelId: Id,
    contentType: z.literal("image/jpeg"),
    sizeBytes: z.number().int().positive().max(500_000),
  }),
  response: z.object({
    uploadUrl: z.url(),
    publicUrl: z.url(),
    path: z.string(),
  }),
};

// ─── Scope 04: payments and ledger ──────────────────────────────────────────

export const StartPayment = {
  route: { method: "POST", path: "/api/parcels/:id/pay" } satisfies Route,
  /** The amount is always computed on the server, never sent by the client. */
  body: z.object({
    purpose: PaymentPurpose.exclude(["REFUND", "INSURANCE"]),
    /** Recipient payments (POD, storage) authenticate with the signed link. */
    trackingLink: z.string().optional(),
  }),
  response: z.object({
    paymentId: Id,
    txnRef: TxnRef,
    amountKobo: KoboAmount,
    /** Interswitch Web Checkout: POST these fields to the URL. */
    checkout: z.object({
      url: z.url(),
      fields: z.record(z.string(), z.string()),
    }),
  }),
};

export const PaymentStatusRoute = {
  route: { method: "GET", path: "/api/payments/:ref/status" } satisfies Route,
  response: D.PaymentStatusView,
};

export const GetLedger = {
  route: { method: "GET", path: "/api/ledger/:account" } satisfies Route,
  params: z.object({ account: LedgerAccount }),
  query: z.object({
    from: IsoDateTime.optional(),
    to: IsoDateTime.optional(),
    accountRefId: Id.optional(),
  }),
  response: D.LedgerView,
};

export const GetEarnings = {
  route: { method: "GET", path: "/api/ledger/DRIVER/earnings" } satisfies Route,
  query: z.object({ period: z.enum(["week", "month"]).default("week") }),
  response: D.EarningsView,
};

// ─── Scope 05: sender booking ───────────────────────────────────────────────

export const GetQuote = {
  route: { method: "GET", path: "/api/quote" } satisfies Route,
  query: z.object({
    routeId: Id,
    size: SizeClass,
    podKobo: z.coerce.number().int().nonnegative().default(0),
  }),
  response: D.Quote,
};

/** S03 one-page booking; also used by agents for walk-ins (Scope 06). */
export const BookingInput = z
  .object({
    destinationParkId: Id,
    deliveryMode: DeliveryMode,
    roadsidePointId: Id.optional(),
    recipient: z.object({
      name: z.string().trim().min(2).max(80),
      phone: PhoneInput,
    }),
    saveRecipient: z.boolean().default(false),
    category: ItemCategory,
    description: z.string().trim().min(2).max(140),
    declaredValueKobo: KoboAmount,
    sizeClass: SizeClass,
    podAmountKobo: KoboAmount.default(0),
  })
  .refine((b) => b.deliveryMode !== "ROADSIDE" || !!b.roadsidePointId, {
    message: "Choose a drop point on the route",
    path: ["roadsidePointId"],
  });
export type BookingInput = z.infer<typeof BookingInput>;

export const CreateParcel = {
  route: { method: "POST", path: "/api/parcels" } satisfies Route,
  body: BookingInput,
  response: z.object({ parcel: D.ParcelSummary, quote: D.Quote }),
};

export const ListMyParcels = {
  route: { method: "GET", path: "/api/parcels" } satisfies Route,
  query: z.object({
    tab: z.enum(["active", "delivered", "drafts"]).default("active"),
  }),
  response: z.object({
    parcels: z.array(D.ParcelSummary),
    vendor: D.VendorTotals.nullable(),
  }),
};

export const GetMe = {
  route: { method: "GET", path: "/api/me" } satisfies Route,
  response: D.Profile,
};

export const UpdateMe = {
  route: { method: "PATCH", path: "/api/me" } satisfies Route,
  body: z.object({
    name: z.string().trim().min(2).max(80).optional(),
    language: Language.optional(),
    notifyChannel: NotificationChannel.exclude(["CONSOLE"]).optional(),
  }),
  response: D.Profile,
};

export const SavedRecipientInput = z.object({
  name: z.string().trim().min(2).max(80),
  phone: PhoneInput,
  preferredParkId: Id.nullable().optional(),
  preferredRoadsidePointId: Id.nullable().optional(),
});

export const ListRecipients = {
  route: { method: "GET", path: "/api/me/recipients" } satisfies Route,
  response: z.object({ recipients: z.array(D.SavedRecipientDto) }),
};
export const CreateRecipient = {
  route: { method: "POST", path: "/api/me/recipients" } satisfies Route,
  body: SavedRecipientInput,
  response: D.SavedRecipientDto,
};
export const UpdateRecipient = {
  route: { method: "PATCH", path: "/api/me/recipients/:id" } satisfies Route,
  body: SavedRecipientInput.partial(),
  response: D.SavedRecipientDto,
};
export const DeleteRecipient = {
  route: { method: "DELETE", path: "/api/me/recipients/:id" } satisfies Route,
  response: Ok,
};

export const PutVendorProfile = {
  route: { method: "PUT", path: "/api/me/vendor" } satisfies Route,
  body: z.object({
    businessName: z.string().trim().min(2).max(80),
    payoutBank: z.string().trim().max(60).optional(),
    payoutAccountName: z.string().trim().max(80).optional(),
    /** Only the last 4 digits are stored until real payouts exist. */
    payoutAccountLast4: z
      .string()
      .regex(/^\d{4}$/)
      .optional(),
  }),
  response: D.Profile,
};

// ─── Scope 06: origin counter ───────────────────────────────────────────────

export const GetHandshake = {
  route: { method: "GET", path: "/api/handshake/:publicId" } satisfies Route,
  params: z.object({ publicId: PublicToken }),
  response: D.HandshakeView,
};

export const ConfirmHandshake = {
  route: {
    method: "POST",
    path: "/api/handshake/:publicId/confirm",
  } satisfies Route,
  body: z.discriminatedUnion("method", [
    z.object({ method: z.literal(HandshakeMethod.enum.AGENT_SCAN) }),
    z.object({
      method: z.literal(HandshakeMethod.enum.SENDER_SCAN),
      agentQrToken: PublicToken,
    }),
    z.object({
      method: z.literal(HandshakeMethod.enum.SMS_CODE),
      code: SixDigitCode,
    }),
  ]),
  response: z.object({ ok: z.literal(true), parcel: D.ParcelSummary }),
};

export const SendHandshakeSms = {
  route: {
    method: "POST",
    path: "/api/handshake/:publicId/sms",
  } satisfies Route,
  response: z.object({ sentTo: MaskedPhone, expiresAt: IsoDateTime }),
};

export const CompleteDropoff = {
  route: { method: "POST", path: "/api/parcels/:id/dropoff" } satisfies Route,
  body: z.object({
    sizeClass: SizeClass,
    codeWritten: z.literal(true),
    photoUrl: z.url(),
    corrections: z
      .object({ description: z.string().max(140), category: ItemCategory })
      .partial()
      .optional(),
  }),
  response: z.discriminatedUnion("state", [
    z.object({ state: z.literal("received"), parcel: D.ParcelSummary }),
    /** Bigger than booked: the sender must pay this first (HS-5). */
    z.object({ state: z.literal("top_up_required"), topUpKobo: KoboAmount }),
  ]),
};

export const RefuseParcel = {
  route: { method: "POST", path: "/api/parcels/:id/refuse" } satisfies Route,
  body: z.object({ reason: z.string().trim().min(3).max(200) }),
  response: z.object({ parcel: D.ParcelSummary, refundStarted: z.boolean() }),
};

export const GetCounterToday = {
  route: { method: "GET", path: "/api/counter/today" } satisfies Route,
  response: D.CounterToday,
};

export const GetLoads = {
  route: { method: "GET", path: "/api/counter/loads" } satisfies Route,
  response: D.LoadsView,
};

export const GetAssignView = {
  route: { method: "GET", path: "/api/counter/assign" } satisfies Route,
  response: D.AssignView,
};

export const WalkInBooking = {
  route: { method: "POST", path: "/api/counter/walk-in" } satisfies Route,
  body: z.object({
    sender: z.object({
      phone: PhoneInput,
      name: z.string().trim().min(2).max(80),
    }),
    booking: BookingInput,
  }),
  response: z.object({
    parcel: D.ParcelSummary,
    quote: D.Quote,
    agentQrToken: PublicToken,
  }),
};

export const AssignParcels = {
  route: { method: "POST", path: "/api/parcels/assign" } satisfies Route,
  body: z.object({
    parcelIds: z.array(Id).min(1).max(50),
    driverId: Id,
    scheduledDepartureAt: IsoDateTime.optional(),
  }),
  response: z.object({ tripId: Id, assigned: z.number().int() }),
};

export const RemindDriver = {
  route: {
    method: "POST",
    path: "/api/counter/loads/:tripId/remind",
  } satisfies Route,
  response: Ok,
};

export const ReassignLoad = {
  route: {
    method: "POST",
    path: "/api/counter/loads/:tripId/reassign",
  } satisfies Route,
  body: z.object({ parcelIds: z.array(Id).min(1).optional() }),
  response: z.object({ released: z.number().int() }),
};

// ─── Scope 07: driver, roadside and tracking ────────────────────────────────

export const GetDriverLoad = {
  route: { method: "GET", path: "/api/driver/load" } satisfies Route,
  response: D.DriverLoad,
};

export const AcceptLoad = {
  route: { method: "POST", path: "/api/trips/:id/accept" } satisfies Route,
  response: D.DriverLoad,
};

export const PostLocation = {
  route: { method: "POST", path: "/api/trips/:id/location" } satisfies Route,
  body: LatLng.extend({
    recordedAt: IsoDateTime.optional(),
    accuracyM: z.number().optional(),
  }),
  response: Ok,
};

/** Demo only: plays the trip along the route and fires approach alerts. */
export const SimulateTrip = {
  route: { method: "POST", path: "/api/trips/:id/simulate" } satisfies Route,
  body: z.object({ speed: z.number().min(1).max(600).default(60) }),
  response: Ok,
};

export const RoadsideAction = {
  route: { method: "POST", path: "/api/parcels/:id/roadside" } satisfies Route,
  body: z.discriminatedUnion("action", [
    z.object({ action: z.literal("handover"), code: SixDigitCode }),
    z.object({
      action: z.literal("missed"),
      reason: z.enum(["not_at_stop", "code_mismatch"]),
    }),
  ]),
  response: z.discriminatedUnion("result", [
    z.object({ result: z.literal("delivered"), parcel: D.ParcelSummary }),
    z.object({ result: z.literal("missed"), parcel: D.ParcelSummary }),
    z.object({
      result: z.literal("wrong_code"),
      attemptsLeft: z.number().int(),
    }),
  ]),
};

export const GetTracking = {
  route: { method: "GET", path: "/api/track/:link" } satisfies Route,
  response: D.TrackingView,
};

export const GetParcelDetail = {
  route: { method: "GET", path: "/api/track/parcel/:code" } satisfies Route,
  response: D.ParcelDetail,
};

export const CancelParcel = {
  route: { method: "POST", path: "/api/parcels/:id/cancel" } satisfies Route,
  body: z.object({ reason: z.string().max(200).optional() }),
  response: z.object({ parcel: D.ParcelSummary, refundStarted: z.boolean() }),
};

// ─── Scope 08: arrival and collection ───────────────────────────────────────

export const GetArrivals = {
  route: { method: "GET", path: "/api/arrivals" } satisfies Route,
  response: D.ArrivalsView,
};

export const GetManifest = {
  route: { method: "GET", path: "/api/manifests/:token" } satisfies Route,
  params: z.object({ token: PublicToken }),
  response: D.ManifestView,
};

export const TickParcel = {
  route: { method: "POST", path: "/api/manifests/:token/tick" } satisfies Route,
  body: z.discriminatedUnion("mark", [
    z.object({ mark: z.literal("arrived"), parcelId: Id, bay: Bay }),
    z.object({ mark: z.literal("missing"), parcelId: Id }),
    z.object({
      mark: z.literal("damaged"),
      parcelId: Id,
      bay: Bay,
      photoUrl: z.url(),
      note: z.string().max(200).optional(),
    }),
  ]),
  response: D.ManifestView,
};

/** "Finish · notify N recipients" (V02). */
export const FinishManifest = {
  route: {
    method: "POST",
    path: "/api/manifests/:token/finish",
  } satisfies Route,
  response: z.object({
    notified: z.number().int(),
    disputesOpened: z.number().int(),
  }),
};

export const GetStore = {
  route: { method: "GET", path: "/api/arrivals/store" } satisfies Route,
  query: z.object({
    filter: z.enum(["all", "fees_due", "over_5_days"]).default("all"),
  }),
  response: z.object({ items: z.array(D.StoreItem) }),
};

export const GetRelease = {
  route: { method: "GET", path: "/api/arrivals/release/:code" } satisfies Route,
  response: D.ReleaseView,
};

export const GetCollect = {
  route: { method: "GET", path: "/api/collect/:parkToken" } satisfies Route,
  params: z.object({ parkToken: PublicToken }),
  /** Identified by the signed tracking link, or by phone + OTP (open question Q16). */
  query: z.object({ link: z.string().optional() }),
  response: D.CollectView,
};

export const RequestCollectionCode = {
  route: {
    method: "POST",
    path: "/api/collect/:parkToken/code",
  } satisfies Route,
  body: z.object({ parcelId: Id, link: z.string().optional() }),
  response: z.object({ sentTo: MaskedPhone, expiresAt: IsoDateTime }),
};

export const ReleaseParcel = {
  route: { method: "POST", path: "/api/parcels/:id/release" } satisfies Route,
  body: z.object({
    code: SixDigitCode,
    collector: z.object({
      kind: CollectorKind,
      name: z.string().trim().min(2).max(80).optional(),
    }),
    photoUrl: z.url().optional(),
  }),
  response: z.discriminatedUnion("result", [
    z.object({ result: z.literal("released"), parcel: D.ParcelSummary }),
    z.object({
      result: z.literal("wrong_code"),
      attemptsLeft: z.number().int(),
    }),
    z.object({ result: z.literal("locked") }),
    z.object({ result: z.literal("dues_unpaid"), dues: D.Dues }),
  ]),
};

export const AdminRelease = {
  route: {
    method: "POST",
    path: "/api/parcels/:id/admin-release",
  } satisfies Route,
  body: z.object({
    idPhotoUrl: z.url(),
    collectorName: z.string().trim().min(2).max(80),
  }),
  response: z.object({ parcel: D.ParcelSummary }),
};

// ─── Scope 09: admin, disputes and jobs ─────────────────────────────────────

export const GetParkOverview = {
  route: { method: "GET", path: "/api/dashboard/park" } satisfies Route,
  query: z.object({ range: z.enum(["today", "7d", "30d"]).default("today") }),
  response: D.ParkOverview,
};

export const OpenDispute = {
  route: { method: "POST", path: "/api/disputes" } satisfies Route,
  body: z.object({
    parcelId: Id,
    type: DisputeType,
    note: z.string().trim().min(5).max(500),
    trackingLink: z.string().optional(),
  }),
  response: D.DisputeDto,
};

export const UpsertRoute = {
  route: { method: "PUT", path: "/api/admin/routes/:id" } satisfies Route,
  body: z.object({
    destinationParkId: Id,
    typicalMinutes: z
      .number()
      .int()
      .min(10)
      .max(24 * 60),
    fareKobo: D.BySize,
    roadsidePoints: z.array(
      z.object({
        name: z.string().trim().min(2),
        lat: z.number(),
        lng: z.number(),
        minutesFromOrigin: z.number().int().min(1),
      }),
    ),
    active: z.boolean().default(true),
  }),
  response: D.RouteSummary,
};

export const UpdateStorageRules = {
  route: { method: "PUT", path: "/api/admin/storage-rules" } satisfies Route,
  body: z.object({
    windowHours: z.number().int().min(1).max(168),
    dailyRateKobo: D.BySize,
    maxHoldDays: z.number().int().min(1).max(60),
    dropoffDeadlineHours: z.number().int().min(1).max(168),
  }),
  response: D.ParkPublic.shape.storage,
};

export const InviteStaff = {
  route: { method: "POST", path: "/api/admin/team/invites" } satisfies Route,
  body: z.object({
    phone: PhoneInput,
    role: z.enum(["AGENT", "DRIVER"]),
    driver: z
      .object({
        vehiclePlate: z.string().trim().min(3),
        vehicleType: z.string().trim().min(2),
        usesApp: z.boolean(),
      })
      .optional(),
  }),
  response: Ok,
};

export const CreatePark = {
  route: { method: "POST", path: "/api/admin/parks" } satisfies Route,
  body: z.object({
    slug: ParkSlug,
    name: z.string().trim().min(3).max(80),
    city: z.string().trim().min(2),
    state: z.string().trim().min(2),
    address: z.string().trim().min(5),
  }),
  response: D.ParkRef,
};
