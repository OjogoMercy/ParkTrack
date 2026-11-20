-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SENDER', 'AGENT', 'DRIVER', 'PARK_ADMIN', 'PLATFORM_ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INVITED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "ParkStatus" AS ENUM ('ONBOARDING', 'LIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('EN', 'PCM');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('WHATSAPP', 'SMS', 'CONSOLE');

-- CreateEnum
CREATE TYPE "SizeClass" AS ENUM ('S', 'M', 'L');

-- CreateEnum
CREATE TYPE "DeliveryMode" AS ENUM ('ROADSIDE', 'PARK');

-- CreateEnum
CREATE TYPE "ParcelStatus" AS ENUM ('DRAFT', 'AWAITING_DROPOFF', 'RECEIVED_AT_ORIGIN', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED_ROADSIDE', 'ARRIVED', 'COLLECTED', 'SETTLED', 'UNCLAIMED', 'RETURNED', 'DISPUTED', 'RESOLVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CreatedBy" AS ENUM ('SENDER', 'AGENT');

-- CreateEnum
CREATE TYPE "HandshakeMethod" AS ENUM ('AGENT_SCAN', 'SENDER_SCAN', 'SMS_CODE');

-- CreateEnum
CREATE TYPE "ParcelEventType" AS ENUM ('CREATED', 'PAID', 'HANDSHAKE', 'PHOTO', 'DROPOFF', 'ASSIGN', 'UNASSIGN', 'ACCEPT', 'ROADSIDE_DELIVERED', 'ROADSIDE_MISSED', 'MANIFEST_RECEIVED', 'TICK_OFF', 'MISSING', 'DAMAGED', 'COLLECTION_CODE_ISSUED', 'COLLECTED', 'SETTLED', 'UNCLAIMED', 'RETURNED', 'DISPUTED', 'RESOLVED', 'CANCELLED', 'NOTE');

-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('LOADING', 'IN_TRANSIT', 'ARRIVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "CodePurpose" AS ENUM ('ROADSIDE', 'COUNTER');

-- CreateEnum
CREATE TYPE "CollectorKind" AS ENUM ('RECIPIENT', 'DELEGATE');

-- CreateEnum
CREATE TYPE "PaymentPurpose" AS ENUM ('SHIPPING', 'TOP_UP', 'INSURANCE', 'POD', 'STORAGE', 'REFUND');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED');

-- CreateEnum
CREATE TYPE "LedgerAccount" AS ENUM ('HELD', 'VENDOR', 'DRIVER', 'PARK', 'PLATFORM', 'INSURER', 'SENDER');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "DisputeType" AS ENUM ('DAMAGED', 'MISSING', 'WRONG_ITEM', 'OVERCHARGED');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED');

-- CreateTable
CREATE TABLE "settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "platformFeeKobo" INTEGER NOT NULL DEFAULT 15000,
    "podFeeBps" INTEGER NOT NULL DEFAULT 125,
    "podLimitKobo" INTEGER NOT NULL DEFAULT 20000000,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parks" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "openingHours" JSONB NOT NULL,
    "counterLocationText" TEXT,
    "storageWindowHours" INTEGER NOT NULL DEFAULT 24,
    "maxHoldDays" INTEGER NOT NULL DEFAULT 7,
    "dropoffDeadlineHours" INTEGER NOT NULL DEFAULT 48,
    "collectionQrToken" TEXT NOT NULL,
    "driverShareBps" INTEGER NOT NULL DEFAULT 6000,
    "storageParkShareBps" INTEGER NOT NULL DEFAULT 8000,
    "status" "ParkStatus" NOT NULL DEFAULT 'ONBOARDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routes" (
    "id" TEXT NOT NULL,
    "originParkId" TEXT NOT NULL,
    "destinationParkId" TEXT NOT NULL,
    "typicalMinutes" INTEGER NOT NULL,
    "fareSmallKobo" INTEGER NOT NULL,
    "fareMediumKobo" INTEGER NOT NULL,
    "fareLargeKobo" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roadside_points" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "order" INTEGER NOT NULL,
    "minutesFromOrigin" INTEGER NOT NULL,

    CONSTRAINT "roadside_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_rates" (
    "id" TEXT NOT NULL,
    "parkId" TEXT NOT NULL,
    "sizeClass" "SizeClass" NOT NULL,
    "dailyRateKobo" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "storage_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'SENDER',
    "photoUrl" TEXT,
    "parkId" TEXT,
    "signupParkId" TEXT,
    "language" "Language" NOT NULL DEFAULT 'EN',
    "notifyChannel" "NotificationChannel" NOT NULL DEFAULT 'WHATSAPP',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_codes" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "channel" "NotificationChannel" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_invites" (
    "id" TEXT NOT NULL,
    "parkId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "invitedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_profiles" (
    "userId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "payoutBank" TEXT,
    "payoutAccountName" TEXT,
    "payoutAccountLast4" TEXT,

    CONSTRAINT "vendor_profiles_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "saved_recipients" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "preferredParkId" TEXT,
    "preferredRoadsidePointId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drivers" (
    "userId" TEXT NOT NULL,
    "vehiclePlate" TEXT NOT NULL,
    "vehicleType" TEXT NOT NULL,
    "usesApp" BOOLEAN NOT NULL DEFAULT true,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "drivers_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "parcels" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "parcelCode" TEXT NOT NULL,
    "senderId" TEXT,
    "originParkId" TEXT NOT NULL,
    "destinationParkId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "deliveryMode" "DeliveryMode" NOT NULL,
    "roadsidePointId" TEXT,
    "recipientName" TEXT NOT NULL,
    "recipientPhone" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "declaredValueKobo" INTEGER NOT NULL,
    "sizeClass" "SizeClass" NOT NULL,
    "podAmountKobo" INTEGER NOT NULL DEFAULT 0,
    "insured" BOOLEAN NOT NULL DEFAULT false,
    "fareKobo" INTEGER NOT NULL,
    "platformFeeKobo" INTEGER NOT NULL,
    "insuranceKobo" INTEGER NOT NULL DEFAULT 0,
    "totalKobo" INTEGER NOT NULL,
    "status" "ParcelStatus" NOT NULL DEFAULT 'DRAFT',
    "createdBy" "CreatedBy" NOT NULL,
    "createdByUserId" TEXT,
    "draftExpiresAt" TIMESTAMP(3),
    "dropoffDeadline" TIMESTAMP(3),
    "topUpRequiredKobo" INTEGER NOT NULL DEFAULT 0,
    "trackingLinkId" TEXT,
    "bay" TEXT,
    "damaged" BOOLEAN NOT NULL DEFAULT false,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "refusedReason" TEXT,
    "arrivalNotifiedAt" TIMESTAMP(3),
    "podPaidAt" TIMESTAMP(3),
    "storagePaidUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parcels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "handshakes" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "method" "HandshakeMethod" NOT NULL,
    "agentId" TEXT,
    "agentQrToken" TEXT,
    "smsCodeHash" TEXT,
    "smsAttempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "handshakes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parcel_events" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "type" "ParcelEventType" NOT NULL,
    "fromStatus" "ParcelStatus",
    "toStatus" "ParcelStatus",
    "actorId" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "photoUrl" TEXT,
    "note" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parcel_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trips" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "originParkId" TEXT NOT NULL,
    "destinationParkId" TEXT NOT NULL,
    "vehiclePlate" TEXT NOT NULL,
    "status" "TripStatus" NOT NULL DEFAULT 'LOADING',
    "scheduledDepartureAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "departedAt" TIMESTAMP(3),
    "arrivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_parcels" (
    "tripId" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tickedOffAt" TIMESTAMP(3),
    "bay" TEXT,

    CONSTRAINT "trip_parcels_pkey" PRIMARY KEY ("tripId","parcelId")
);

-- CreateTable
CREATE TABLE "manifests" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "destinationParkId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "scannedById" TEXT,
    "scannedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manifests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_points" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "location_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_codes" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "purpose" "CodePurpose" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sentToPhone" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "collectorKind" "CollectorKind",
    "collectorName" TEXT,
    "collectorPhotoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "purpose" "PaymentPurpose" NOT NULL,
    "amountKobo" INTEGER NOT NULL,
    "txnRef" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "responseCode" TEXT,
    "payerPhone" TEXT,
    "checkoutUrl" TEXT,
    "requeryCount" INTEGER NOT NULL DEFAULT 0,
    "nextRequeryAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "rawResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "providerRef" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT,
    "paymentId" TEXT,
    "account" "LedgerAccount" NOT NULL,
    "accountRefId" TEXT,
    "amountKobo" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payouts" (
    "id" TEXT NOT NULL,
    "account" "LedgerAccount" NOT NULL,
    "accountRefId" TEXT NOT NULL,
    "amountKobo" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "providerRef" TEXT,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT,
    "phone" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "template" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "openedById" TEXT,
    "type" "DisputeType" NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "previousStatus" "ParcelStatus" NOT NULL,
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "parks_slug_key" ON "parks"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "parks_collectionQrToken_key" ON "parks"("collectionQrToken");

-- CreateIndex
CREATE UNIQUE INDEX "routes_originParkId_destinationParkId_key" ON "routes"("originParkId", "destinationParkId");

-- CreateIndex
CREATE UNIQUE INDEX "roadside_points_routeId_order_key" ON "roadside_points"("routeId", "order");

-- CreateIndex
CREATE INDEX "storage_rates_parkId_sizeClass_effectiveFrom_idx" ON "storage_rates"("parkId", "sizeClass", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_parkId_role_idx" ON "users"("parkId", "role");

-- CreateIndex
CREATE INDEX "otp_codes_phone_createdAt_idx" ON "otp_codes"("phone", "createdAt");

-- CreateIndex
CREATE INDEX "staff_invites_parkId_status_idx" ON "staff_invites"("parkId", "status");

-- CreateIndex
CREATE INDEX "saved_recipients_userId_idx" ON "saved_recipients"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "parcels_publicId_key" ON "parcels"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "parcels_parcelCode_key" ON "parcels"("parcelCode");

-- CreateIndex
CREATE UNIQUE INDEX "parcels_trackingLinkId_key" ON "parcels"("trackingLinkId");

-- CreateIndex
CREATE INDEX "parcels_originParkId_status_idx" ON "parcels"("originParkId", "status");

-- CreateIndex
CREATE INDEX "parcels_destinationParkId_status_idx" ON "parcels"("destinationParkId", "status");

-- CreateIndex
CREATE INDEX "parcels_senderId_createdAt_idx" ON "parcels"("senderId", "createdAt");

-- CreateIndex
CREATE INDEX "parcels_recipientPhone_idx" ON "parcels"("recipientPhone");

-- CreateIndex
CREATE UNIQUE INDEX "handshakes_agentQrToken_key" ON "handshakes"("agentQrToken");

-- CreateIndex
CREATE INDEX "handshakes_parcelId_idx" ON "handshakes"("parcelId");

-- CreateIndex
CREATE INDEX "parcel_events_parcelId_createdAt_idx" ON "parcel_events"("parcelId", "createdAt");

-- CreateIndex
CREATE INDEX "trips_driverId_status_idx" ON "trips"("driverId", "status");

-- CreateIndex
CREATE INDEX "trips_originParkId_status_idx" ON "trips"("originParkId", "status");

-- CreateIndex
CREATE INDEX "trip_parcels_parcelId_idx" ON "trip_parcels"("parcelId");

-- CreateIndex
CREATE UNIQUE INDEX "manifests_token_key" ON "manifests"("token");

-- CreateIndex
CREATE UNIQUE INDEX "manifests_tripId_destinationParkId_key" ON "manifests"("tripId", "destinationParkId");

-- CreateIndex
CREATE INDEX "location_points_tripId_recordedAt_idx" ON "location_points"("tripId", "recordedAt");

-- CreateIndex
CREATE INDEX "collection_codes_parcelId_purpose_createdAt_idx" ON "collection_codes"("parcelId", "purpose", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "payments_txnRef_key" ON "payments"("txnRef");

-- CreateIndex
CREATE INDEX "payments_parcelId_purpose_idx" ON "payments"("parcelId", "purpose");

-- CreateIndex
CREATE INDEX "payments_status_nextRequeryAt_idx" ON "payments"("status", "nextRequeryAt");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_providerRef_key" ON "webhook_events"("providerRef");

-- CreateIndex
CREATE INDEX "ledger_entries_account_accountRefId_createdAt_idx" ON "ledger_entries"("account", "accountRefId", "createdAt");

-- CreateIndex
CREATE INDEX "ledger_entries_parcelId_idx" ON "ledger_entries"("parcelId");

-- CreateIndex
CREATE INDEX "payouts_account_accountRefId_idx" ON "payouts"("account", "accountRefId");

-- CreateIndex
CREATE INDEX "notifications_parcelId_idx" ON "notifications"("parcelId");

-- CreateIndex
CREATE INDEX "notifications_phone_createdAt_idx" ON "notifications"("phone", "createdAt");

-- CreateIndex
CREATE INDEX "disputes_parcelId_idx" ON "disputes"("parcelId");

-- CreateIndex
CREATE INDEX "disputes_status_idx" ON "disputes"("status");

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_originParkId_fkey" FOREIGN KEY ("originParkId") REFERENCES "parks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_destinationParkId_fkey" FOREIGN KEY ("destinationParkId") REFERENCES "parks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roadside_points" ADD CONSTRAINT "roadside_points_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_rates" ADD CONSTRAINT "storage_rates_parkId_fkey" FOREIGN KEY ("parkId") REFERENCES "parks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_parkId_fkey" FOREIGN KEY ("parkId") REFERENCES "parks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_signupParkId_fkey" FOREIGN KEY ("signupParkId") REFERENCES "parks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_invites" ADD CONSTRAINT "staff_invites_parkId_fkey" FOREIGN KEY ("parkId") REFERENCES "parks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_invites" ADD CONSTRAINT "staff_invites_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_profiles" ADD CONSTRAINT "vendor_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_recipients" ADD CONSTRAINT "saved_recipients_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_recipients" ADD CONSTRAINT "saved_recipients_preferredParkId_fkey" FOREIGN KEY ("preferredParkId") REFERENCES "parks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_recipients" ADD CONSTRAINT "saved_recipients_preferredRoadsidePointId_fkey" FOREIGN KEY ("preferredRoadsidePointId") REFERENCES "roadside_points"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_originParkId_fkey" FOREIGN KEY ("originParkId") REFERENCES "parks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_destinationParkId_fkey" FOREIGN KEY ("destinationParkId") REFERENCES "parks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_roadsidePointId_fkey" FOREIGN KEY ("roadsidePointId") REFERENCES "roadside_points"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handshakes" ADD CONSTRAINT "handshakes_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "parcels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handshakes" ADD CONSTRAINT "handshakes_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcel_events" ADD CONSTRAINT "parcel_events_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "parcels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcel_events" ADD CONSTRAINT "parcel_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_originParkId_fkey" FOREIGN KEY ("originParkId") REFERENCES "parks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_destinationParkId_fkey" FOREIGN KEY ("destinationParkId") REFERENCES "parks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_parcels" ADD CONSTRAINT "trip_parcels_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_parcels" ADD CONSTRAINT "trip_parcels_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "parcels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_parcels" ADD CONSTRAINT "trip_parcels_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manifests" ADD CONSTRAINT "manifests_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manifests" ADD CONSTRAINT "manifests_destinationParkId_fkey" FOREIGN KEY ("destinationParkId") REFERENCES "parks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manifests" ADD CONSTRAINT "manifests_scannedById_fkey" FOREIGN KEY ("scannedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_points" ADD CONSTRAINT "location_points_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_codes" ADD CONSTRAINT "collection_codes_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "parcels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "parcels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "parcels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "parcels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "parcels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ─── ParkTrack additions (hand-written, keep when regenerating) ─────────────

-- Append-only tables (PRD §12): the ledger and the custody/event log can only
-- be inserted into. Corrections are new rows (e.g. a negative ledger entry).
CREATE OR REPLACE FUNCTION "parktrack_forbid_update_delete"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: % is not allowed', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ledger_entries_append_only"
  BEFORE UPDATE OR DELETE ON "ledger_entries"
  FOR EACH ROW EXECUTE FUNCTION "parktrack_forbid_update_delete"();

CREATE TRIGGER "parcel_events_append_only"
  BEFORE UPDATE OR DELETE ON "parcel_events"
  FOR EACH ROW EXECUTE FUNCTION "parktrack_forbid_update_delete"();

-- Row-level security on every table, with no policies. Supabase exposes the
-- public schema through its REST API to anyone with the anon key (which ships
-- to browsers for Realtime). With RLS on and no policies, those roles see
-- nothing. Prisma connects as the database owner, which bypasses RLS.
-- Scopes that need browser access (e.g. Realtime in Scope 07) add narrow
-- policies in their own migration.
ALTER TABLE "settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "parks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "routes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "roadside_points" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "storage_rates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "otp_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "staff_invites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vendor_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "saved_recipients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "drivers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "parcels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "handshakes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "parcel_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "trips" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "trip_parcels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "manifests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "location_points" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "collection_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "webhook_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ledger_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payouts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "disputes" ENABLE ROW LEVEL SECURITY;
