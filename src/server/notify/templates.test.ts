import { describe, expect, it } from "vitest";
import {
  NOTIFICATION_AUDIENCE,
  NOTIFICATION_EVENTS,
  type Audience,
} from "@/contracts/notifications";
import { messageLinks, siteUrl } from "./links";
import {
  renderCodeMessage,
  renderMessage,
  templateIds,
  type MessageContext,
} from "./templates";

const links = messageLinks({
  rootDomain: "parktrack.ng",
  originSlug: "ogbomoso",
  parcelCode: "PT-7K3Q",
  recipientToken: "trkLinkId.mxyz.sig",
});

const context = (over: Partial<MessageContext> = {}): MessageContext => ({
  parcelCode: "PT-7K3Q",
  recipientName: "Kemi Bakare",
  senderName: "Tolu Adeyemi",
  originPark: { name: "Ogbomoso Motor Park", city: "Ogbomoso" },
  destinationPark: {
    name: "Iwo Road Park",
    city: "Ibadan",
    counterLocationText: "Gate 2",
  },
  deliveryMode: "PARK",
  roadsidePointName: null,
  bay: "C4",
  dropoffDeadline: new Date("2026-11-24T13:00:00Z"),
  podAmountKobo: 2_500_000,
  totalKobo: 265_000,
  driver: { name: "Musa Ibrahim", plate: "KJA 482 XY" },
  storage: {
    freeUntil: new Date("2026-11-23T13:10:00Z"),
    dailyRateKobo: 30_000,
  },
  minutesToDestination: 90,
  links,
  now: new Date("2026-11-22T13:10:00Z"),
  extra: {
    code: "482913",
    purpose: "COUNTER",
    minutes: 20,
    amountKobo: 265_000,
    txnRef: "ISW-PT-8F3KQ2XA",
  },
  ...over,
});

/** The link each audience must get. */
const expectedLink: Record<Audience, string> = {
  sender: links.sender,
  recipient: links.recipient!,
  driver: links.driver,
  origin_agent: links.originCounter,
  arrival_agent: links.arrivals,
  park_admin: links.parkAdmin,
};

describe("every PRD §11 message", () => {
  const cases = NOTIFICATION_EVENTS.flatMap((event) =>
    NOTIFICATION_AUDIENCE[event].map((audience) => [event, audience] as const),
  );

  it("has a template for each event and audience in the matrix", () => {
    for (const [event, audience] of cases) {
      expect(
        renderMessage(event, audience, context()),
        `${event}.${audience}`,
      ).not.toBeNull();
    }
    expect(templateIds().length).toBe(cases.length);
  });

  for (const [event, audience] of cases) {
    it(`${event} → ${audience}: parcel code and the right link`, () => {
      const text = renderMessage(event, audience, context())!;
      expect(text).toContain("PT-7K3Q");
      if (
        audience === "sender" &&
        (event === "booking_paid" || event === "dropoff_deadline_near")
      ) {
        expect(text).toContain(links.booking);
      } else {
        expect(text).toContain(expectedLink[audience]);
      }
      expect(text.length, text).toBeLessThan(320); // two SMS parts at most
    });
  }

  it("never puts the recipient's tracking link in a message to someone else", () => {
    for (const [event, audience] of cases) {
      if (audience === "recipient") continue;
      expect(renderMessage(event, audience, context())!).not.toContain("/t/");
    }
  });
});

describe("message details", () => {
  it("arrived at park: bay, counter, free storage, daily rate, amount due", () => {
    const text = renderMessage("arrived_at_park", "recipient", context())!;
    expect(text).toContain("bay C4");
    expect(text).toContain("Gate 2");
    expect(text).toContain("₦300 a day");
    expect(text).toContain("₦25,000 to pay on collection");
    expect(text).toMatch(/Free storage until .*2:10 PM/);
  });

  it("roadside parcels name the drop point", () => {
    const roadside = context({
      deliveryMode: "ROADSIDE",
      roadsidePointName: "Owode junction",
    });
    expect(
      renderMessage("handshake_complete", "recipient", roadside),
    ).toContain("Meet the bus at Owode junction");
    expect(renderMessage("bus_approaching", "recipient", roadside)).toMatch(
      /20 minutes from Owode junction.*Pay ₦25,000 now/,
    );
  });

  it("load accepted names the driver and plate", () => {
    expect(renderMessage("load_accepted", "sender", context())).toContain(
      "Musa Ibrahim (KJA 482 XY)",
    );
  });

  it("collection codes: counter vs roadside wording", () => {
    expect(renderMessage("collection_started", "recipient", context())).toMatch(
      /collection code for PT-7K3Q is 482913\. Valid for 10 minutes/,
    );
    const roadside = context({
      extra: { code: "715204", purpose: "ROADSIDE" },
    });
    expect(renderMessage("collection_started", "recipient", roadside)).toMatch(
      /handover code for PT-7K3Q is 715204/,
    );
  });

  it("works without optional details", () => {
    const bare = context({
      driver: null,
      bay: null,
      dropoffDeadline: null,
      minutesToDestination: null,
      podAmountKobo: 0,
      destinationPark: {
        name: "Iwo Road Park",
        city: "Ibadan",
        counterLocationText: null,
      },
      extra: {},
    });
    for (const event of NOTIFICATION_EVENTS)
      for (const audience of NOTIFICATION_AUDIENCE[event])
        expect(renderMessage(event, audience, bare) ?? "").not.toMatch(
          /undefined|null|NaN/,
        );
  });

  it("sign-in code message", () => {
    expect(renderCodeMessage("123456")).toMatch(
      /^123456 is your ParkTrack code/,
    );
  });
});

describe("links", () => {
  it("uses http only for local roots", () => {
    expect(siteUrl("parktrack.ng", "ogbomoso", "/x")).toBe(
      "https://ogbomoso.parktrack.ng/x",
    );
    expect(siteUrl("localhost:3000", "app", "/driver")).toBe(
      "http://app.localhost:3000/driver",
    );
    expect(siteUrl("parktrack.localhost:3000", null, "/t/a")).toBe(
      "http://parktrack.localhost:3000/t/a",
    );
  });
});
