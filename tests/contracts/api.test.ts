import { describe, expect, it } from "vitest";
import { api } from "@/contracts";

describe("API request schemas", () => {
  const booking = {
    destinationParkId: "park_ibadan",
    deliveryMode: "PARK",
    recipient: { name: "Kemi Bakare", phone: "0802 118 9034" },
    category: "Clothing & fabric",
    description: "2 bundles of ankara fabric",
    declaredValueKobo: 4_500_000,
    sizeClass: "M",
    podAmountKobo: 2_500_000,
  };

  it("accepts the S03/S04 booking from the designs", () => {
    const parsed = api.CreateParcel.body.parse(booking);
    expect(parsed.saveRecipient).toBe(false);
  });

  it("requires a drop point for roadside delivery", () => {
    const r = api.CreateParcel.body.safeParse({
      ...booking,
      deliveryMode: "ROADSIDE",
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["roadsidePointId"]);
    expect(
      api.CreateParcel.body.safeParse({
        ...booking,
        deliveryMode: "ROADSIDE",
        roadsidePointId: "rp_owode",
      }).success,
    ).toBe(true);
  });

  it("rejects float money and unknown categories", () => {
    expect(
      api.CreateParcel.body.safeParse({
        ...booking,
        declaredValueKobo: 45000.5,
      }).success,
    ).toBe(false);
    expect(
      api.CreateParcel.body.safeParse({ ...booking, category: "Guns" }).success,
    ).toBe(false);
  });

  it("never lets the client choose a payment amount", () => {
    const parsed = api.StartPayment.body.parse({
      purpose: "SHIPPING",
      amountKobo: 1,
    } as object);
    expect(parsed).not.toHaveProperty("amountKobo");
    expect(api.StartPayment.body.safeParse({ purpose: "REFUND" }).success).toBe(
      false,
    );
  });

  it("handshake confirm needs the right proof per method", () => {
    expect(
      api.ConfirmHandshake.body.safeParse({ method: "AGENT_SCAN" }).success,
    ).toBe(true);
    expect(
      api.ConfirmHandshake.body.safeParse({ method: "SMS_CODE" }).success,
    ).toBe(false);
    expect(
      api.ConfirmHandshake.body.safeParse({
        method: "SMS_CODE",
        code: "482913",
      }).success,
    ).toBe(true);
  });

  it("drop-off requires the code written and a photo", () => {
    expect(
      api.CompleteDropoff.body.safeParse({
        sizeClass: "M",
        codeWritten: false,
        photoUrl: "https://x.test/p.jpg",
      }).success,
    ).toBe(false);
    expect(
      api.CompleteDropoff.body.safeParse({ sizeClass: "M", codeWritten: true })
        .success,
    ).toBe(false);
  });

  it("roadside actions and tick-off marks are explicit", () => {
    expect(
      api.RoadsideAction.body.safeParse({ action: "handover", code: "715204" })
        .success,
    ).toBe(true);
    expect(
      api.RoadsideAction.body.safeParse({
        action: "missed",
        reason: "not_at_stop",
      }).success,
    ).toBe(true);
    expect(
      api.TickParcel.body.safeParse({ mark: "arrived", parcelId: "p1" })
        .success,
    ).toBe(false); // needs bay
  });

  it("every route declares a method and path", () => {
    for (const [name, def] of Object.entries(api)) {
      if (def && typeof def === "object" && "route" in def) {
        expect(def.route.path, name).toMatch(/^\/api\//);
      }
    }
  });
});
