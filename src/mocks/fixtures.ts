import type * as D from "@/contracts/dto";

/**
 * Fixtures for every DTO, built from the design copy (Tolu, Kemi, PT-7K3Q,
 * Musa Ibrahim, Bay C4, ₦2,650 …). Used by the service stubs (sl11) and by
 * UI work before the real services exist. tests/mocks/fixtures.test.ts
 * validates every fixture against its zod schema.
 *
 * Times are fixed around the demo week (Lagos = UTC+1).
 */

const T = (iso: string) => iso; // readability: all times are ISO strings

// ─── Shared refs ────────────────────────────────────────────────────────────

export const ogbomoso: D.ParkRef = {
  id: "park_ogbomoso",
  slug: "ogbomoso",
  name: "Ogbomoso Motor Park",
  city: "Ogbomoso",
};
export const ibadan: D.ParkRef = {
  id: "park_ibadan",
  slug: "ibadan",
  name: "Iwo Road Park",
  city: "Ibadan",
};

export const owode: D.RoadsidePointDto = {
  id: "rp_owode_out",
  name: "Owode junction, Oyo",
  order: 1,
  minutesFromOrigin: 31,
  lat: 7.8526,
  lng: 3.931,
};

export const musa: D.DriverRef = {
  userId: "user_musa",
  name: "Musa Ibrahim",
  vehiclePlate: "OYO 482 KJ",
  vehicleType: "White Toyota Hiace",
  usesApp: true,
  verified: true,
};
export const adeLawal: D.DriverRef = {
  userId: "user_ade",
  name: "Ade Lawal",
  vehiclePlate: "OYO 903 GH",
  vehicleType: "Toyota Hiace",
  usesApp: true,
  verified: true,
};
export const suleBello: D.DriverRef = {
  userId: "user_sule",
  name: "Sule Bello",
  vehiclePlate: "KWR 115 AA",
  vehicleType: "Nissan Urvan",
  usesApp: false,
  verified: true,
};

export const BOOKING_PUBLIC_ID = "pub7K3QxN9mVw4cLs8Rt";
export const MANIFEST_TOKEN = "manMusaIbadan20261122";
export const COUNTER_TOKEN = "ctrIwoRoadGate2Ibadan";
export const TRACKING_LINK = "trkKemiBakare7K3Qlink";

export const quoteMedium: D.Quote = {
  fareKobo: 250_000,
  platformFeeKobo: 15_000,
  insuranceKobo: 0,
  totalKobo: 265_000,
  podAmountKobo: 2_500_000,
  lines: [
    { label: "Fare · Medium", amountKobo: 250_000 },
    { label: "Service fee", amountKobo: 15_000 },
  ],
};

// ─── Accounts ───────────────────────────────────────────────────────────────

export const toluSession: D.SessionUser = {
  id: "user_tolu",
  phone: "+2340000000101",
  name: "Tolu Adeyemi",
  role: "USER",
  park: null,
  signupPark: ogbomoso,
  isVendor: true,
};

export const bayoSession: D.SessionUser = {
  id: "user_bayo",
  phone: "+2340000000301",
  name: "Bayo Kareem",
  role: "AGENT",
  park: ogbomoso,
  signupPark: null,
  isVendor: false,
};

export const toluProfile: D.Profile = {
  ...toluSession,
  language: "EN",
  notifyChannel: "WHATSAPP",
  vendor: {
    businessName: "Tolu's Fabrics",
    payoutBank: "GTBank",
    payoutAccountName: "Tolu Adeyemi",
    payoutAccountLast4: "4021",
  },
};

export const savedRecipients: D.SavedRecipientDto[] = [
  {
    id: "rcp_kemi",
    name: "Kemi Bakare",
    phone: "+2340000000201",
    preferredPark: ibadan,
    preferredRoadsidePoint: null,
  },
  {
    id: "rcp_dayo",
    name: "Dayo Alabi",
    phone: "+2340000000202",
    preferredPark: null,
    preferredRoadsidePoint: { id: owode.id, name: owode.name },
  },
];

// ─── Park page (S01) ────────────────────────────────────────────────────────

const week = (open: string, close: string, sun: [string, string] | null) => ({
  mon: [open, close] as [string, string],
  tue: [open, close] as [string, string],
  wed: [open, close] as [string, string],
  thu: [open, close] as [string, string],
  fri: [open, close] as [string, string],
  sat: [open, close] as [string, string],
  sun,
});

export const parkOgbomoso: D.ParkPublic = {
  id: ogbomoso.id,
  slug: "ogbomoso",
  name: "Ogbomoso Motor Park",
  logoUrl: null,
  city: "Ogbomoso",
  state: "Oyo",
  address: "Takie, Ogbomoso, Oyo State",
  counterLocationText: "ParkTrack counter by the main loading bay",
  openingHours: week("06:00", "19:00", ["08:00", "17:00"]),
  openNow: true,
  closesAt: "19:00",
  storage: {
    windowHours: 24,
    maxHoldDays: 7,
    dropoffDeadlineHours: 48,
    dailyRateKobo: { S: 30_000, M: 30_000, L: 30_000 },
  },
  routes: [
    {
      id: "route_ogb_ibd",
      destination: ibadan,
      typicalMinutes: 90,
      fareKobo: { S: 150_000, M: 250_000, L: 400_000 },
      roadsidePoints: [owode],
    },
  ],
};

// ─── Parcels (S07–S11) ──────────────────────────────────────────────────────

export const parcelAwaiting: D.ParcelSummary = {
  id: "parcel_7k3q",
  parcelCode: "PT-7K3Q",
  status: "AWAITING_DROPOFF",
  deliveryMode: "PARK",
  recipientName: "Kemi Bakare",
  senderName: "Tolu Adeyemi",
  originPark: ogbomoso,
  destinationPark: ibadan,
  roadsidePointName: null,
  sizeClass: "M",
  category: "Clothing & fabric",
  podAmountKobo: 2_500_000,
  totalKobo: 265_000,
  bay: null,
  etaMinutes: null,
  dropoffDeadline: T("2026-11-22T17:00:00+00:00"),
  createdAt: T("2026-11-20T15:12:00+00:00"),
  updatedAt: T("2026-11-20T15:12:00+00:00"),
};

export const parcelInTransitRoadside: D.ParcelSummary = {
  ...parcelAwaiting,
  id: "parcel_4m8c",
  parcelCode: "PT-4M8C",
  status: "IN_TRANSIT",
  deliveryMode: "ROADSIDE",
  recipientName: "Dayo Alabi",
  roadsidePointName: owode.name,
  etaMinutes: 70,
  dropoffDeadline: null,
  createdAt: T("2026-11-21T07:02:00+00:00"),
  updatedAt: T("2026-11-21T08:40:00+00:00"),
};

export const parcelReady: D.ParcelSummary = {
  ...parcelAwaiting,
  id: "parcel_2h6v",
  parcelCode: "PT-2H6V",
  status: "ARRIVED",
  recipientName: "Ngozi Eze",
  bay: "C4",
  dropoffDeadline: null,
  updatedAt: T("2026-11-21T13:10:00+00:00"),
};

export const parcelCollected: D.ParcelSummary = {
  ...parcelAwaiting,
  id: "parcel_9x7a",
  parcelCode: "PT-9X7A",
  status: "COLLECTED",
  recipientName: "Ngozi Eze",
  podAmountKobo: 4_000_000,
  totalKobo: 315_000,
  dropoffDeadline: null,
  updatedAt: T("2026-11-14T10:32:00+00:00"),
};

export const myParcels = {
  parcels: [parcelAwaiting, parcelInTransitRoadside, parcelReady],
  vendor: {
    collectedThisMonthKobo: 11_500_000,
    awaitingCollectionKobo: 2_500_000,
  },
} satisfies { parcels: D.ParcelSummary[]; vendor: D.VendorTotals };

export const parcelDetailInTransit: D.ParcelDetail = {
  ...parcelInTransitRoadside,
  description: "2 bundles of ankara fabric",
  declaredValueKobo: 4_500_000,
  sender: { name: "Tolu Adeyemi", phone: "+2340000000101" },
  recipient: { name: "Dayo Alabi", phone: "+2340000000202" },
  roadsidePoint: owode,
  driver: musa,
  timeline: [
    {
      type: "PAID",
      title: "Booked and paid",
      sub: null,
      at: T("2026-11-21T07:02:00+00:00"),
      photoUrl: null,
    },
    {
      type: "DROPOFF",
      title: "Dropped off at Ogbomoso",
      sub: "Checked in by Bayo · photo taken",
      at: T("2026-11-21T08:14:00+00:00"),
      photoUrl: "https://example.test/photos/pt-4m8c-dropoff.jpg",
    },
    {
      type: "ACCEPT",
      title: "Load accepted by Musa",
      sub: null,
      at: T("2026-11-21T08:40:00+00:00"),
      photoUrl: null,
    },
  ],
  payments: [
    {
      txnRef: "ISW-PT-4M8CSHIP",
      purpose: "SHIPPING",
      amountKobo: 265_000,
      status: "VERIFIED",
      verifiedAt: T("2026-11-21T07:02:30+00:00"),
    },
    {
      txnRef: "ISW-PT-4M8CPOD1",
      purpose: "POD",
      amountKobo: 2_500_000,
      status: "VERIFIED",
      verifiedAt: T("2026-11-21T15:20:00+00:00"),
    },
  ],
  dropoffPhotoUrl: "https://example.test/photos/pt-4m8c-dropoff.jpg",
  releasePhotoUrl: null,
  collected: null,
  storageDueKobo: 0,
  freeUntil: null,
  live: { lat: 7.95, lng: 4.02, at: T("2026-11-21T09:30:00+00:00") },
  cancellable: false,
  settlement: null,
};

export const parcelDetailAwaiting: D.ParcelDetail = {
  ...parcelDetailInTransit,
  ...parcelAwaiting,
  publicId: BOOKING_PUBLIC_ID,
  recipient: { name: "Kemi Bakare", phone: "+2340000000201" },
  roadsidePoint: null,
  driver: null,
  timeline: [
    {
      type: "PAID",
      title: "Booked and paid",
      sub: null,
      at: T("2026-11-20T15:12:00+00:00"),
      photoUrl: null,
    },
  ],
  payments: [
    {
      txnRef: "ISW-PT-8F3KQ2",
      purpose: "SHIPPING",
      amountKobo: 265_000,
      status: "VERIFIED",
      verifiedAt: T("2026-11-20T15:12:40+00:00"),
    },
  ],
  dropoffPhotoUrl: null,
  live: null,
  cancellable: true,
};

export const parcelDetailCollected: D.ParcelDetail = {
  ...parcelDetailInTransit,
  ...parcelCollected,
  recipient: { name: "Ngozi Eze" },
  roadsidePoint: null,
  driver: adeLawal,
  timeline: [],
  payments: [],
  releasePhotoUrl: "https://example.test/photos/pt-9x7a-release.jpg",
  collected: {
    at: T("2026-11-14T10:32:00+00:00"),
    by: "Ngozi Eze",
    kind: "RECIPIENT",
    releasedBy: "Funmi A.",
    parkName: "Ojota Motor Park",
  },
  live: null,
  settlement: {
    podCollectedKobo: 4_000_000,
    podFeeKobo: 50_000,
    creditedKobo: 3_950_000,
  },
};

// ─── Recipient tracking (R01–R03) ───────────────────────────────────────────

const roadsideStops: D.TrackingStop[] = [
  {
    name: "Ogbomoso",
    kind: "origin",
    at: T("2026-11-21T15:05:00+00:00"),
    isYourStop: false,
    passed: true,
  },
  {
    name: "Owode jct.",
    kind: "roadside",
    at: T("2026-11-21T16:40:00+00:00"),
    isYourStop: true,
    passed: false,
  },
  {
    name: "Ibadan",
    kind: "destination",
    at: null,
    isYourStop: false,
    passed: false,
  },
];

export const trackingApproaching: D.TrackingView = {
  parcelCode: "PT-4M8C",
  status: "IN_TRANSIT",
  deliveryMode: "ROADSIDE",
  senderName: "Tolu Adeyemi",
  sizeClass: "M",
  category: "Clothing & fabric",
  sentAt: T("2026-11-21T08:14:00+00:00"),
  stops: roadsideStops,
  eta: { minutes: 20, at: T("2026-11-21T16:40:00+00:00") },
  approaching: true,
  driver: {
    name: musa.name,
    vehiclePlate: musa.vehiclePlate,
    vehicleType: musa.vehicleType,
  },
  dues: {
    podKobo: 2_500_000,
    podPayee: "Tolu's Fabrics",
    storageKobo: 0,
    totalKobo: 2_500_000,
    paid: false,
  },
  handoverCode: null,
  arrival: null,
  collected: null,
};

export const trackingHandoverCode: D.TrackingView = {
  ...trackingApproaching,
  eta: { minutes: 12, at: T("2026-11-21T16:40:00+00:00") },
  dues: { ...trackingApproaching.dues, paid: true },
  handoverCode: "715204",
};

export const trackingReady: D.TrackingView = {
  ...trackingApproaching,
  parcelCode: "PT-7K3Q",
  status: "ARRIVED",
  deliveryMode: "PARK",
  stops: [
    {
      name: "Ogbomoso",
      kind: "origin",
      at: T("2026-11-22T09:34:00+00:00"),
      isYourStop: false,
      passed: true,
    },
    {
      name: "Ibadan",
      kind: "destination",
      at: T("2026-11-22T13:10:00+00:00"),
      isYourStop: true,
      passed: true,
    },
  ],
  eta: null,
  approaching: false,
  dues: {
    podKobo: 2_500_000,
    podPayee: "Tolu's Fabrics",
    storageKobo: 0,
    totalKobo: 2_500_000,
    paid: false,
  },
  arrival: {
    parkName: "Iwo Road Park, Ibadan",
    parkSlug: "ibadan",
    bay: "C4",
    arrivedAt: T("2026-11-22T13:10:00+00:00"),
    freeUntil: T("2026-11-23T13:10:00+00:00"),
    dailyRateKobo: 30_000,
    maxHoldDays: 7,
    counterLocationText: "Gate 2",
    openingHoursText: "open 6 AM to 8 PM",
  },
};

// ─── Origin counter (A01–A07) ───────────────────────────────────────────────

export const handshakeView: D.HandshakeView = {
  parcelId: parcelAwaiting.id,
  parcelCode: "PT-7K3Q",
  status: "AWAITING_DROPOFF",
  createdBy: "SENDER",
  sender: { name: "Tolu Adeyemi", phone: "+2340000000101" },
  recipient: { name: "Kemi Bakare" },
  destinationPark: ibadan,
  deliveryMode: "PARK",
  roadsidePointName: null,
  category: "Clothing & fabric",
  description: "2 bundles of ankara fabric",
  sizeClass: "M",
  declaredValueKobo: 4_500_000,
  podAmountKobo: 2_500_000,
  paidKobo: 265_000,
  topUpIfKobo: { L: 150_000 },
  scannedAt: T("2026-11-22T08:12:00+00:00"),
};

export const counterToday: D.CounterToday = {
  park: ogbomoso,
  agentName: "Bayo Kareem",
  kpis: { expected: 12, checkedIn: 8, toAssign: 5 },
  notices: [
    {
      tone: "amber",
      message: "Musa hasn't accepted his load. Departs 10:30 AM.",
    },
  ],
  expected: [
    {
      parcelId: parcelAwaiting.id,
      parcelCode: "PT-7K3Q",
      senderName: "Tolu Adeyemi",
      destinationCity: "Ibadan",
      sizeClass: "M",
      status: "AWAITING_DROPOFF",
      note: "4:12 PM",
    },
    {
      parcelId: "parcel_7p9f",
      parcelCode: "PT-7P9F",
      senderName: "Chidi Okafor",
      destinationCity: "Lagos",
      sizeClass: "L",
      status: "AWAITING_DROPOFF",
      note: "Due in 2h",
    },
  ],
  checkedIn: [
    {
      parcelId: "parcel_5v2n",
      parcelCode: "PT-5V2N",
      senderName: "Rashidat Ajayi",
      destinationCity: "Ibadan",
      sizeClass: "S",
      status: "RECEIVED_AT_ORIGIN",
      note: "Yesterday",
    },
  ],
};

export const assignView: D.AssignView = {
  groups: [
    {
      destination: ibadan,
      parcels: [
        {
          parcelId: parcelAwaiting.id,
          parcelCode: "PT-7K3Q",
          recipientName: "Kemi Bakare",
          sizeClass: "M",
          deliveryMode: "PARK",
          roadsidePointName: null,
        },
        {
          parcelId: parcelInTransitRoadside.id,
          parcelCode: "PT-4M8C",
          recipientName: "Dayo Alabi",
          sizeClass: "M",
          deliveryMode: "ROADSIDE",
          roadsidePointName: owode.name,
        },
      ],
    },
  ],
  drivers: [
    {
      ...musa,
      departsAt: T("2026-11-22T09:30:00+00:00"),
      canTakeRoadside: true,
    },
    {
      ...adeLawal,
      departsAt: T("2026-11-22T11:00:00+00:00"),
      canTakeRoadside: true,
    },
    { ...suleBello, departsAt: null, canTakeRoadside: false },
  ],
};

const tripMusa: D.TripCard = {
  tripId: "trip_musa_1",
  status: "LOADING",
  driver: musa,
  destination: ibadan,
  scheduledDepartureAt: T("2026-11-22T09:30:00+00:00"),
  acceptedAt: null,
  departedAt: null,
  arrivedAt: null,
  parcelCodes: ["PT-7K3Q", "PT-4M8C", "PT-8N5D", "PT-2W7E"],
  alertAt: T("2026-11-22T09:15:00+00:00"),
};

export const loadsView: D.LoadsView = {
  notAccepted: [tripMusa],
  onTheRoad: [
    {
      ...tripMusa,
      tripId: "trip_ade_1",
      status: "IN_TRANSIT",
      driver: adeLawal,
      acceptedAt: T("2026-11-22T07:52:00+00:00"),
      parcelCodes: ["PT-6Q2Z"],
      alertAt: null,
    },
  ],
  departedToday: [],
  handedOver: [],
};

// ─── Driver (D01–D06) ───────────────────────────────────────────────────────

export const driverLoad: D.DriverLoad = {
  trip: {
    id: tripMusa.tripId,
    status: "LOADING",
    vehiclePlate: "OYO 482 KJ",
    origin: ogbomoso,
    destination: ibadan,
    assignedByName: "Bayo",
    assignedAt: T("2026-11-22T09:05:00+00:00"),
    scheduledDepartureAt: T("2026-11-22T09:30:00+00:00"),
    acceptedAt: null,
    departedAt: null,
    sharingLocation: false,
  },
  stops: [
    {
      kind: "roadside",
      name: "Owode junction, Oyo",
      order: 1,
      roadsidePointId: owode.id,
      parkId: null,
      etaAt: null,
      passed: false,
      parcels: [
        {
          parcelId: parcelInTransitRoadside.id,
          parcelCode: "PT-4M8C",
          sizeClass: "M",
          category: "Clothing & fabric",
          recipientName: "Dayo Alabi",
          status: "ASSIGNED",
          duesPaid: true,
        },
        {
          parcelId: "parcel_6q2z",
          parcelCode: "PT-6Q2Z",
          sizeClass: "S",
          category: "Documents",
          recipientName: "Sade Ojo",
          status: "ASSIGNED",
          duesPaid: false,
        },
      ],
    },
    {
      kind: "arrival",
      name: "Iwo Road Park, Ibadan",
      order: 2,
      roadsidePointId: null,
      parkId: ibadan.id,
      etaAt: null,
      passed: false,
      parcels: [
        {
          parcelId: parcelAwaiting.id,
          parcelCode: "PT-7K3Q",
          sizeClass: "M",
          category: "Clothing & fabric",
          recipientName: "Kemi Bakare",
          status: "ASSIGNED",
          duesPaid: true,
        },
        {
          parcelId: "parcel_8n5d",
          parcelCode: "PT-8N5D",
          sizeClass: "S",
          category: "Shoes & bags",
          recipientName: "Bisi Kola",
          status: "ASSIGNED",
          duesPaid: true,
        },
      ],
    },
  ],
  manifest: null,
};

export const earnings: D.EarningsView = {
  periodKobo: 3_840_000,
  changePct: 12,
  byDay: ["Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Wed"].map((day, i) => ({
    day,
    kobo: [480_000, 640_000, 400_000, 0, 720_000, 640_000, 960_000][i],
  })),
  trips: [
    {
      tripId: "trip_musa_1",
      label: "Ogbomoso → Ibadan",
      date: T("2026-11-22T09:30:00+00:00"),
      parcelCount: 6,
      kobo: 480_000,
      state: "in_progress",
    },
    {
      tripId: "trip_musa_0",
      label: "Ogbomoso → Ibadan",
      date: T("2026-11-19T09:30:00+00:00"),
      parcelCount: 8,
      kobo: 640_000,
      state: "credited",
    },
  ],
};

// ─── Arrival and collection (V01–V05, R04–R06) ──────────────────────────────

export const arrivalsView: D.ArrivalsView = {
  park: ibadan,
  agentName: "Funmi Adebayo",
  arriving: [
    {
      tripId: tripMusa.tripId,
      driver: { name: musa.name, vehiclePlate: musa.vehiclePlate },
      origin: ogbomoso,
      parcelCount: 4,
      etaAt: T("2026-11-22T11:10:00+00:00"),
    },
  ],
  store: { held: 9, feesDue: 2, over5Days: 1 },
};

export const manifestView: D.ManifestView = {
  manifestToken: MANIFEST_TOKEN,
  tripId: tripMusa.tripId,
  driver: musa,
  origin: ogbomoso,
  parcels: [
    {
      parcelId: parcelAwaiting.id,
      parcelCode: "PT-7K3Q",
      sizeClass: "M",
      recipientName: "Kemi Bakare",
      dropoffPhotoUrl: "https://example.test/photos/pt-7k3q-dropoff.jpg",
      tickedOff: true,
      bay: "C4",
      flag: null,
    },
    {
      parcelId: "parcel_8n5d",
      parcelCode: "PT-8N5D",
      sizeClass: "S",
      recipientName: "Bisi Kola",
      dropoffPhotoUrl: null,
      tickedOff: true,
      bay: "C4",
      flag: null,
    },
    {
      parcelId: "parcel_2w7e",
      parcelCode: "PT-2W7E",
      sizeClass: "L",
      recipientName: "Femi Ade",
      dropoffPhotoUrl: null,
      tickedOff: true,
      bay: "B2",
      flag: null,
    },
    {
      parcelId: "parcel_6t7r",
      parcelCode: "PT-6T7R",
      sizeClass: "M",
      recipientName: "Yemi Lawal",
      dropoffPhotoUrl: null,
      tickedOff: false,
      bay: null,
      flag: "MISSING",
    },
  ],
};

export const storeItems: D.StoreItem[] = [
  {
    parcelId: parcelAwaiting.id,
    parcelCode: "PT-7K3Q",
    recipientName: "Kemi Bakare",
    bay: "C4",
    sizeClass: "M",
    arrivedAt: T("2026-11-22T13:10:00+00:00"),
    freeUntil: T("2026-11-23T13:10:00+00:00"),
    daysHeld: 0,
    storageDueKobo: 0,
    locked: false,
    lastDay: false,
  },
  {
    parcelId: "parcel_2w7e",
    parcelCode: "PT-2W7E",
    recipientName: "Femi Ade",
    bay: "B2",
    sizeClass: "L",
    arrivedAt: T("2026-11-22T13:10:00+00:00"),
    freeUntil: T("2026-11-23T13:10:00+00:00"),
    daysHeld: 0,
    storageDueKobo: 0,
    locked: true,
    lastDay: false,
  },
  {
    parcelId: "parcel_3j8k",
    parcelCode: "PT-3J8K",
    recipientName: "Halima Musa",
    bay: "A1",
    sizeClass: "M",
    arrivedAt: T("2026-11-19T10:00:00+00:00"),
    freeUntil: T("2026-11-20T10:00:00+00:00"),
    daysHeld: 3,
    storageDueKobo: 60_000,
    locked: false,
    lastDay: false,
  },
  {
    parcelId: "parcel_4c6m",
    parcelCode: "PT-4C6M",
    recipientName: "Joy Uche",
    bay: "B1",
    sizeClass: "S",
    arrivedAt: T("2026-11-16T10:00:00+00:00"),
    freeUntil: T("2026-11-17T10:00:00+00:00"),
    daysHeld: 6,
    storageDueKobo: 150_000,
    locked: false,
    lastDay: true,
  },
];

const duesKemi: D.Dues = {
  podKobo: 2_500_000,
  podPayee: "Tolu's Fabrics",
  storageKobo: 0,
  totalKobo: 2_500_000,
  paid: false,
  verifiedAt: null,
};

export const collectView: D.CollectView = {
  park: { name: "Iwo Road Park counter", counterLocationText: "Gate 2" },
  collectingAs: "+234 000 *** 0201",
  parcels: [
    {
      parcelId: parcelAwaiting.id,
      parcelCode: "PT-7K3Q",
      senderName: "Tolu Adeyemi",
      sizeClass: "M",
      bay: "C4",
      dues: duesKemi,
      code: null,
    },
  ],
};

export const releaseView: D.ReleaseView = {
  parcelId: parcelAwaiting.id,
  parcelCode: "PT-7K3Q",
  bay: "C4",
  recipientName: "Kemi Bakare",
  recipientPhone: "+234 000 *** 0201",
  sizeClass: "M",
  dues: { ...duesKemi, paid: true, verifiedAt: T("2026-11-22T09:44:00+00:00") },
  code: {
    sentTo: "+234 000 *** 0201",
    validUntil: T("2026-11-22T09:52:00+00:00"),
  },
  attemptsLeft: 5,
  locked: false,
  dropoffPhotoUrl: "https://example.test/photos/pt-7k3q-dropoff.jpg",
};

// ─── Money and admin (S05/S06, P01–P03) ─────────────────────────────────────

export const paymentPending: D.PaymentStatusView = {
  txnRef: "ISW-PT-8F3KQ2",
  purpose: "SHIPPING",
  amountKobo: 265_000,
  status: "PENDING",
  responseCode: null,
  reason: null,
  parcelCode: "PT-7K3Q",
  returnTo: "/parcels/booked/PT-7K3Q",
};

export const paymentFailed: D.PaymentStatusView = {
  ...paymentPending,
  status: "FAILED",
  responseCode: "51",
  reason: "Card declined (51)",
};

export const ledgerEntries: D.LedgerEntryDto[] = [
  {
    id: "le_1",
    at: T("2026-11-21T09:47:00+00:00"),
    parcelCode: "PT-9X7A",
    account: "VENDOR",
    accountLabel: "Vendor · Tolu's Fabrics",
    reason: "Pay on delivery, less 1.25%",
    amountKobo: 3_950_000,
    paymentRef: "ISW-3QW81M",
  },
  {
    id: "le_2",
    at: T("2026-11-21T09:47:00+00:00"),
    parcelCode: "PT-9X7A",
    account: "PLATFORM",
    accountLabel: "Platform",
    reason: "Pay-on-delivery fee",
    amountKobo: 50_000,
    paymentRef: "ISW-3QW81M",
  },
  {
    id: "le_3",
    at: T("2026-11-21T09:47:00+00:00"),
    parcelCode: "PT-9X7A",
    account: "DRIVER",
    accountLabel: "Driver · Ade Lawal",
    reason: "Fare share",
    amountKobo: 180_000,
    paymentRef: "ISW-7HB20D",
  },
  {
    id: "le_4",
    at: T("2026-11-21T09:47:00+00:00"),
    parcelCode: "PT-9X7A",
    account: "PARK",
    accountLabel: "Park · Ogbomoso",
    reason: "Fare share",
    amountKobo: 120_000,
    paymentRef: "ISW-7HB20D",
  },
  {
    id: "le_5",
    at: T("2026-11-21T09:47:00+00:00"),
    parcelCode: "PT-9X7A",
    account: "PLATFORM",
    accountLabel: "Platform",
    reason: "Service fee",
    amountKobo: 15_000,
    paymentRef: "ISW-7HB20D",
  },
  {
    id: "le_6",
    at: T("2026-11-21T08:30:00+00:00"),
    parcelCode: "PT-8K7S",
    account: "SENDER",
    accountLabel: "Sender · Ruth Ade",
    reason: "Refund · expired booking",
    amountKobo: -165_000,
    paymentRef: "ISW-RF92LQ",
  },
];

export const ledgerView: D.LedgerView = {
  account: "PARK",
  balanceKobo: 41_260_000,
  totals: {
    parkShareKobo: 41_260_000,
    driverSharesKobo: 61_890_000,
    collectedForVendorsKobo: 240_000_000,
    refundsKobo: 1_815_000,
  },
  entries: ledgerEntries,
};

export const parkOverview: D.ParkOverview = {
  park: ogbomoso,
  kpis: {
    parcelsToday: 48,
    parcelsDelta: 8,
    onTheRoad: 17,
    busesOnRoad: 3,
    inStore: 9,
    withStorageFees: 2,
    revenueTodayKobo: 6_240_000,
    revenueDeltaPct: 14,
  },
  series: Array.from({ length: 14 }, (_, i) => ({
    date: `2026-11-${String(8 + i).padStart(2, "0")}`,
    count: [28, 31, 25, 33, 30, 36, 29, 34, 38, 32, 40, 37, 41, 48][i],
  })),
  needsAttention: [
    {
      kind: "load_not_accepted",
      title: "Load not accepted",
      detail: "Musa Ibrahim · 4 parcels · departs 10:30 AM",
    },
    {
      kind: "missing_at_tickoff",
      title: "Missing at tick-off",
      detail: "dispute opened · Iwo Road",
      parcelCode: "PT-6T7R",
    },
    {
      kind: "uncollected",
      title: "Uncollected for 6 days",
      detail: "becomes unclaimed tomorrow",
      parcelCode: "PT-4C6M",
    },
    {
      kind: "expiring_bookings",
      title: "3 bookings expire in 6h",
      detail: "Paid bookings not dropped off refund automatically",
    },
  ],
  liveTrips: [tripMusa],
};

export const disputeMissing: D.DisputeDto = {
  id: "dsp_6t7r",
  parcelCode: "PT-6T7R",
  type: "MISSING",
  status: "OPEN",
  previousStatus: "IN_TRANSIT",
  openedByName: "Funmi Adebayo",
  resolution: null,
  createdAt: T("2026-11-22T11:20:00+00:00"),
  resolvedAt: null,
};
