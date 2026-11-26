/**
 * Reference seed: platform settings, the two hackathon parks, their routes,
 * roadside stop, storage rates and the staff/people from the designs.
 *
 *   npm run db:seed        (runs `prisma db seed` → tsx prisma/seed.ts)
 *
 * Idempotent: running it again changes nothing. Existing rows are left as
 * they are (e.g. a park's counter QR token is never regenerated).
 *
 * Phone numbers use the +234000… prefix, which no real subscriber has, so
 * seeded users can never receive real SMS/WhatsApp. The demo seed (Scope 09)
 * adds the team's real phones.
 */
import { randomBytes } from "node:crypto";
import { config } from "dotenv";
import type { Prisma, PrismaClient } from "../src/generated/prisma/client";
import { createPrismaClient } from "../src/lib/prisma";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const kobo = (naira: number) => Math.round(naira * 100);
const token = () => randomBytes(18).toString("base64url");

const OPENING_HOURS_OGBOMOSO: Prisma.InputJsonValue = {
  mon: ["06:00", "19:00"],
  tue: ["06:00", "19:00"],
  wed: ["06:00", "19:00"],
  thu: ["06:00", "19:00"],
  fri: ["06:00", "19:00"],
  sat: ["06:00", "19:00"],
  sun: ["08:00", "17:00"],
};

const OPENING_HOURS_IBADAN: Prisma.InputJsonValue = {
  mon: ["06:00", "20:00"],
  tue: ["06:00", "20:00"],
  wed: ["06:00", "20:00"],
  thu: ["06:00", "20:00"],
  fri: ["06:00", "20:00"],
  sat: ["06:00", "20:00"],
  sun: ["08:00", "18:00"],
};

async function seedSettings(db: PrismaClient) {
  await db.settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      platformFeeKobo: kobo(150),
      podFeeBps: 125,
      podLimitKobo: kobo(200_000),
    },
  });
}

async function seedParks(db: PrismaClient) {
  const ogbomoso = await db.park.upsert({
    where: { slug: "ogbomoso" },
    update: {},
    create: {
      slug: "ogbomoso",
      name: "Ogbomoso Motor Park",
      city: "Ogbomoso",
      state: "Oyo",
      address: "Takie, Ogbomoso, Oyo State",
      lat: 8.1335,
      lng: 4.2405,
      openingHours: OPENING_HOURS_OGBOMOSO,
      counterLocationText: "ParkTrack counter by the main loading bay",
      collectionQrToken: token(),
      status: "LIVE",
    },
  });

  const ibadan = await db.park.upsert({
    where: { slug: "ibadan" },
    update: {},
    create: {
      slug: "ibadan",
      name: "Iwo Road Park",
      city: "Ibadan",
      state: "Oyo",
      address: "Iwo Road, Ibadan, Oyo State",
      lat: 7.4041,
      lng: 3.9286,
      openingHours: OPENING_HOURS_IBADAN,
      counterLocationText: "Gate 2",
      collectionQrToken: token(),
      status: "LIVE",
    },
  });

  return { ogbomoso, ibadan };
}

async function seedRoute(
  db: PrismaClient,
  originParkId: string,
  destinationParkId: string,
  owodeMinutesFromOrigin: number,
) {
  const route = await db.route.upsert({
    where: {
      originParkId_destinationParkId: { originParkId, destinationParkId },
    },
    update: {},
    create: {
      originParkId,
      destinationParkId,
      typicalMinutes: 90,
      fareSmallKobo: kobo(1_500),
      fareMediumKobo: kobo(2_500),
      fareLargeKobo: kobo(4_000),
    },
  });

  const owode = await db.roadsidePoint.upsert({
    where: { routeId_order: { routeId: route.id, order: 1 } },
    update: {},
    create: {
      routeId: route.id,
      name: "Owode junction, Oyo",
      lat: 7.8526,
      lng: 3.931,
      order: 1,
      minutesFromOrigin: owodeMinutesFromOrigin,
    },
  });

  return { route, owode };
}

async function seedStorageRates(db: PrismaClient, parkId: string) {
  for (const sizeClass of ["S", "M", "L"] as const) {
    const existing = await db.storageRate.findFirst({
      where: { parkId, sizeClass },
    });
    if (!existing) {
      await db.storageRate.create({
        data: { parkId, sizeClass, dailyRateKobo: kobo(300) },
      });
    }
  }
}

async function upsertUser(
  db: PrismaClient,
  data: Prisma.UserUncheckedCreateInput,
) {
  return db.user.upsert({
    where: { phone: data.phone },
    update: {},
    create: data,
  });
}

async function seedPeople(
  db: PrismaClient,
  parks: { ogbomoso: { id: string }; ibadan: { id: string } },
  owodeOutbound: { id: string },
) {
  const { ogbomoso, ibadan } = parks;

  // Sender / vendor (Senderv2 designs)
  const tolu = await upsertUser(db, {
    phone: "+2340000000101",
    name: "Tolu Adeyemi",
    role: "USER",
    signupParkId: ogbomoso.id,
  });
  await db.vendorProfile.upsert({
    where: { userId: tolu.id },
    update: {},
    create: {
      userId: tolu.id,
      businessName: "Tolu's Fabrics",
      payoutBank: "GTBank",
      payoutAccountName: "Tolu Adeyemi",
      payoutAccountLast4: "4021",
    },
  });
  const recipients = [
    {
      name: "Kemi Bakare",
      phone: "+2340000000201",
      preferredParkId: ibadan.id,
    },
    {
      name: "Dayo Alabi",
      phone: "+2340000000202",
      preferredRoadsidePointId: owodeOutbound.id,
    },
  ];
  for (const r of recipients) {
    const exists = await db.savedRecipient.findFirst({
      where: { userId: tolu.id, phone: r.phone },
    });
    if (!exists)
      await db.savedRecipient.create({ data: { userId: tolu.id, ...r } });
  }

  // Park staff
  await upsertUser(db, {
    phone: "+2340000000301",
    name: "Bayo Kareem",
    role: "AGENT",
    parkId: ogbomoso.id,
  });
  await upsertUser(db, {
    phone: "+2340000000302",
    name: "Funmi Adebayo",
    role: "AGENT",
    parkId: ibadan.id,
  });
  await upsertUser(db, {
    phone: "+2340000000401",
    name: "Adewale Ojo",
    role: "PARK_ADMIN",
    parkId: ogbomoso.id,
  });
  await upsertUser(db, {
    phone: "+2340000000402",
    name: "Iwo Road Admin",
    role: "PARK_ADMIN",
    parkId: ibadan.id,
  });
  await upsertUser(db, {
    phone: "+2340000000901",
    name: "ParkTrack Admin",
    role: "PLATFORM_ADMIN",
  });

  // Drivers (Origin agent A06 / Driver designs)
  const drivers = [
    {
      phone: "+2340000000501",
      name: "Musa Ibrahim",
      vehiclePlate: "OYO 482 KJ",
      vehicleType: "Toyota Hiace",
      usesApp: true,
    },
    {
      phone: "+2340000000502",
      name: "Ade Lawal",
      vehiclePlate: "OYO 903 GH",
      vehicleType: "Toyota Hiace",
      usesApp: true,
    },
    {
      phone: "+2340000000503",
      name: "Sule Bello",
      vehiclePlate: "KWR 115 AA",
      vehicleType: "Nissan Urvan",
      usesApp: false,
    },
  ];
  for (const d of drivers) {
    const user = await upsertUser(db, {
      phone: d.phone,
      name: d.name,
      role: "DRIVER",
      parkId: ogbomoso.id,
    });
    await db.driver.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        vehiclePlate: d.vehiclePlate,
        vehicleType: d.vehicleType,
        usesApp: d.usesApp,
        verifiedAt: new Date("2026-11-01T09:00:00+01:00"),
      },
    });
  }
}

export async function seed(db: PrismaClient) {
  await seedSettings(db);
  const parks = await seedParks(db);
  // Ogbomoso → Ibadan: Owode ~31 min out (D02: departed 10:34, Owode 11:05).
  const outbound = await seedRoute(db, parks.ogbomoso.id, parks.ibadan.id, 31);
  // Ibadan → Ogbomoso: Owode is near the far end of the trip.
  await seedRoute(db, parks.ibadan.id, parks.ogbomoso.id, 59);
  await seedStorageRates(db, parks.ogbomoso.id);
  await seedStorageRates(db, parks.ibadan.id);
  await seedPeople(db, parks, outbound.owode);
}

async function main() {
  const db = createPrismaClient();
  try {
    await seed(db);
    const counts = {
      parks: await db.park.count(),
      routes: await db.route.count(),
      roadsidePoints: await db.roadsidePoint.count(),
      storageRates: await db.storageRate.count(),
      users: await db.user.count(),
      drivers: await db.driver.count(),
      savedRecipients: await db.savedRecipient.count(),
    };
    console.log("Seeded:", counts);
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
