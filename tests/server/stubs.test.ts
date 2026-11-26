import { describe, expect, it } from "vitest";
import { z } from "zod";
import * as A from "@/contracts/api";
import * as D from "@/contracts/dto";
import { STUB_OWNER } from "@/mocks/stub";
import * as F from "@/mocks/fixtures";
import * as admin from "@/server/admin";
import * as arrival from "@/server/arrival";
import * as assignment from "@/server/assignment";
import * as auth from "@/server/auth";
import * as booking from "@/server/booking";
import * as collection from "@/server/collection";
import * as disputes from "@/server/disputes";
import * as dropoff from "@/server/dropoff";
import * as handshake from "@/server/handshake";
import * as jobs from "@/server/jobs";
import * as ledger from "@/server/ledger";
import * as notify from "@/server/notify";
import * as parcels from "@/server/parcels";
import * as parks from "@/server/parks";
import * as payments from "@/server/payments";
import * as recipients from "@/server/recipients";
import * as roadside from "@/server/roadside";
import * as tracking from "@/server/tracking";
import * as trips from "@/server/trips";
import * as uploads from "@/server/uploads";
import * as vendors from "@/server/vendors";

const modules = {
  admin,
  arrival,
  assignment,
  auth,
  booking,
  collection,
  disputes,
  dropoff,
  handshake,
  jobs,
  ledger,
  notify,
  parcels,
  parks,
  payments,
  recipients,
  roadside,
  tracking,
  trips,
  uploads,
  vendors,
};

function valid(schema: z.ZodType, value: unknown) {
  const r = schema.safeParse(value);
  if (!r.success) throw new Error(z.prettifyError(r.error));
}

describe("service stubs", () => {
  it("exist for every module in the ownership table, and are marked STUB", () => {
    expect(Object.keys(modules).sort()).toEqual(Object.keys(STUB_OWNER).sort());
    // Each module exports STUB: true while it is the Scope 01 stub, false
    // once its owning scope has replaced it with the real implementation.
    for (const [name, mod] of Object.entries(modules))
      expect(typeof mod.STUB, name).toBe("boolean");
  });

  it("return data that satisfies the contracts", async () => {
    // auth is real since Scope 02 (STUB = false); its tests are in
    // src/server/auth/*.test.ts. parkScope needs no request or database:
    expect(auth.parkScope(F.bayoSession)).toHaveProperty("OR");

    if (parks.STUB) {
      valid(D.ParkPublic, await parks.currentPark());
      valid(z.array(D.ParkRef), await parks.listLiveParks());
    }

    // parcels.transition / changeDeliveryMode (Scope 03 sl1) and createDraft
    // / quote (sl2) are real and need a database; see
    // src/server/parcels/*.test.ts. Collection codes too (sl3).

    // notify is real since Scope 03 sl5; see src/server/notify/*.test.ts.
    expect(notify.STUB).toBe(false);
    // uploads is real since Scope 03 sl8 (Supabase Storage); see
    // src/server/uploads/*.test.ts.
    expect(uploads.STUB).toBe(false);

    // payments is real since Scope 04 (sl2–sl9; needs a database and
    // Interswitch); see src/server/payments/*.test.ts.
    expect(payments.STUB).toBe(false);
    // ledger is real since Scope 04 sl7 (needs a database); see
    // src/server/ledger/*.test.ts.
    expect(ledger.STUB).toBe(false);

    valid(
      A.CreateParcel.response,
      await booking.createBooking({} as A.BookingInput, {
        originParkId: "o",
        senderId: "s",
        createdBy: "SENDER",
        createdByUserId: "s",
      }),
    );
    valid(A.ListMyParcels.response, await booking.listMyParcels("u", "active"));
    valid(z.array(D.SavedRecipientDto), await recipients.listRecipients("u"));
    valid(D.Profile, await vendors.getProfile("u"));

    valid(D.HandshakeView, await handshake.getForAgent("x", "a"));
    valid(
      A.CompleteDropoff.response,
      await dropoff.completeDropoff(
        "p",
        { sizeClass: "M", codeWritten: true, photoUrl: "https://x.test/a.jpg" },
        "a",
      ),
    );
    valid(
      A.CompleteDropoff.response,
      await dropoff.completeDropoff(
        "p",
        { sizeClass: "L", codeWritten: true, photoUrl: "https://x.test/a.jpg" },
        "a",
      ),
    );
    valid(D.CounterToday, await assignment.counterTodayFor("park"));
    valid(D.AssignView, await assignment.assignViewFor("park"));
    valid(D.LoadsView, await assignment.loadsFor("park"));
    valid(
      A.WalkInBooking.response,
      await assignment.walkIn({
        sender: { phone: "x", name: "y" },
        booking: {} as A.BookingInput,
        agentId: "a",
        parkId: "p",
      }),
    );

    // trips.driverLoadFor is real since Scope 07 sl1 (needs a database);
    // its grouping is tested in src/server/trips/load.test.ts.
    valid(D.DriverLoad, await trips.acceptLoad("t", "d"));
    valid(
      A.RoadsideAction.response,
      await roadside.handover("p", "715204", "d"),
    );
    valid(
      A.RoadsideAction.response,
      await roadside.handover("p", "111111", "d"),
    );
    valid(
      A.RoadsideAction.response,
      await roadside.markMissed("p", "not_at_stop", "d"),
    );
    valid(D.TrackingView, await tracking.trackingForLink(F.TRACKING_LINK));
    expect(await tracking.trackingForLink("forged")).toBeNull();
    valid(D.ParcelDetail, await tracking.parcelDetailFor("PT-7K3Q", "u"));

    valid(D.ArrivalsView, await arrival.arrivalsFor("park"));
    valid(D.ManifestView, await arrival.manifestFor(F.MANIFEST_TOKEN, "a"));
    valid(z.array(D.StoreItem), await arrival.storeFor("park", "fees_due"));
    valid(D.ReleaseView, await arrival.releaseViewFor("PT-7K3Q", "a"));
    valid(
      D.CollectView,
      await collection.collectViewFor(F.COUNTER_TOKEN, {
        kind: "link",
        token: F.TRACKING_LINK,
      }),
    );
    valid(
      A.ReleaseParcel.response,
      await collection.release(
        "p",
        { code: "482913", collector: { kind: "RECIPIENT" } },
        "a",
      ),
    );

    valid(D.ParkOverview, await admin.parkOverviewFor("park"));
    valid(
      D.DisputeDto,
      await disputes.openDispute(
        { parcelId: "p", type: "DAMAGED", note: "Crushed box" },
        { actor: "RECIPIENT" },
      ),
    );
    expect((await jobs.runBookingExpiry()).processed).toBe(0);
  });

  it("never hands out shared fixture objects (callers can't corrupt them)", async () => {
    // Uses the stub helper directly, so it keeps working as modules go real.
    const { stub } = await import("@/mocks/stub");
    const a = await stub(F.parkOgbomoso);
    a.name = "Changed";
    expect((await stub(F.parkOgbomoso)).name).toBe("Ogbomoso Motor Park");
  });
});
