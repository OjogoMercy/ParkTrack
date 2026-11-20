import { describe, expect, it } from "vitest";
import { z } from "zod";
import * as D from "@/contracts/dto";
import * as F from "@/mocks/fixtures";

// Every fixture must satisfy its contract schema, so UI built on fixtures
// keeps working when real services replace the stubs.
const cases: [string, z.ZodType, unknown][] = [
  ["ParkRef", D.ParkRef, F.ogbomoso],
  ["RoadsidePointDto", D.RoadsidePointDto, F.owode],
  ["DriverRef", D.DriverRef, F.musa],
  ["Quote", D.Quote, F.quoteMedium],
  ["SessionUser (sender)", D.SessionUser, F.toluSession],
  ["SessionUser (agent)", D.SessionUser, F.bayoSession],
  ["Profile", D.Profile, F.toluProfile],
  ["SavedRecipientDto[]", z.array(D.SavedRecipientDto), F.savedRecipients],
  ["ParkPublic", D.ParkPublic, F.parkOgbomoso],
  ["ParcelSummary (awaiting)", D.ParcelSummary, F.parcelAwaiting],
  ["ParcelSummary (roadside)", D.ParcelSummary, F.parcelInTransitRoadside],
  ["ParcelSummary (ready)", D.ParcelSummary, F.parcelReady],
  ["ParcelSummary (collected)", D.ParcelSummary, F.parcelCollected],
  ["VendorTotals", D.VendorTotals, F.myParcels.vendor],
  ["ParcelDetail (awaiting)", D.ParcelDetail, F.parcelDetailAwaiting],
  ["ParcelDetail (in transit)", D.ParcelDetail, F.parcelDetailInTransit],
  ["ParcelDetail (collected)", D.ParcelDetail, F.parcelDetailCollected],
  ["TrackingView (approaching)", D.TrackingView, F.trackingApproaching],
  ["TrackingView (handover code)", D.TrackingView, F.trackingHandoverCode],
  ["TrackingView (ready)", D.TrackingView, F.trackingReady],
  ["HandshakeView", D.HandshakeView, F.handshakeView],
  ["CounterToday", D.CounterToday, F.counterToday],
  ["AssignView", D.AssignView, F.assignView],
  ["LoadsView", D.LoadsView, F.loadsView],
  ["DriverLoad", D.DriverLoad, F.driverLoad],
  ["EarningsView", D.EarningsView, F.earnings],
  ["ArrivalsView", D.ArrivalsView, F.arrivalsView],
  ["ManifestView", D.ManifestView, F.manifestView],
  ["StoreItem[]", z.array(D.StoreItem), F.storeItems],
  ["CollectView", D.CollectView, F.collectView],
  ["ReleaseView", D.ReleaseView, F.releaseView],
  ["PaymentStatusView (pending)", D.PaymentStatusView, F.paymentPending],
  ["PaymentStatusView (failed)", D.PaymentStatusView, F.paymentFailed],
  ["LedgerView", D.LedgerView, F.ledgerView],
  ["ParkOverview", D.ParkOverview, F.parkOverview],
  ["DisputeDto", D.DisputeDto, F.disputeMissing],
];

describe("fixtures match their contracts", () => {
  it.each(cases)("%s", (_name, schema, value) => {
    const r = schema.safeParse(value);
    if (!r.success) throw new Error(z.prettifyError(r.error));
    expect(r.success).toBe(true);
  });

  it("money adds up like the designs", () => {
    expect(F.quoteMedium.fareKobo + F.quoteMedium.platformFeeKobo).toBe(
      F.quoteMedium.totalKobo,
    );
    // P03: shipping ₦3,150 settles as driver 60% + park 40% of the ₦3,000 fare + ₦150 fee.
    const ship = F.ledgerEntries.filter((e) => e.paymentRef === "ISW-7HB20D");
    expect(ship.reduce((s, e) => s + e.amountKobo, 0)).toBe(315_000);
    // S11: ₦40,000 POD less 1.25% = ₦39,500 credited.
    expect(F.parcelDetailCollected.settlement?.creditedKobo).toBe(
      4_000_000 - 50_000,
    );
  });
});
