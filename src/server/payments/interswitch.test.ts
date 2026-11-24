import { describe, expect, it, vi } from "vitest";
import {
  checkoutForm,
  classifyRequery,
  iswConfig,
  requeryTransaction,
  type IswTransaction,
} from "./interswitch";

const sandboxEnv = {
  ISW_ENVIRONMENT: "sandbox" as const,
  ISW_MERCHANT_CODE: "MX6072",
  ISW_PAY_ITEM_ID: "9405967",
};
const config = iswConfig(sandboxEnv);

describe("configuration", () => {
  it("sandbox uses the sandbox checkout page and API", () => {
    expect(config).toEqual({
      environment: "sandbox",
      merchantCode: "MX6072",
      payItemId: "9405967",
      checkoutUrl:
        "https://newwebpay-sandbox.interswitchng.com/collections/w/pay",
      apiBase: "https://sandbox.interswitchng.com",
    });
  });

  it("live uses live endpoints and refuses sandbox values", () => {
    expect(
      iswConfig({
        ISW_ENVIRONMENT: "live",
        ISW_MERCHANT_CODE: "MX99999",
        ISW_PAY_ITEM_ID: "123",
      }),
    ).toMatchObject({
      checkoutUrl: "https://newwebpay.interswitchng.com/collections/w/pay",
      apiBase: "https://webpay.interswitchng.com",
    });
    expect(() => iswConfig({ ...sandboxEnv, ISW_ENVIRONMENT: "live" })).toThrow(
      /shared sandbox merchant/,
    );
    expect(() =>
      iswConfig({
        ISW_ENVIRONMENT: "live",
        ISW_MERCHANT_CODE: "MX99999",
        ISW_PAY_ITEM_ID: "123",
        ISW_BASE_URL: "https://sandbox.interswitchng.com",
      }),
    ).toThrow(/sandbox URL/);
  });

  it("sandbox refuses a live API base, and names missing keys", () => {
    expect(() =>
      iswConfig({
        ...sandboxEnv,
        ISW_BASE_URL: "https://webpay.interswitchng.com",
      }),
    ).toThrow(/not a sandbox URL/);
    expect(() => iswConfig({ ISW_ENVIRONMENT: "sandbox" })).toThrow(
      /ISW_MERCHANT_CODE, ISW_PAY_ITEM_ID/,
    );
  });
});

describe("checkout form", () => {
  it("has the documented Web Redirect fields, amount in kobo", () => {
    expect(
      checkoutForm(config, {
        txnRef: "ISW-PT-8F3KQ2XA",
        amountKobo: 265_000,
        redirectUrl: "https://parktrack.ng/api/payments/callback",
        customer: {
          id: "u_tolu",
          name: "Tolu Adeyemi",
          email: "tolu@example.com",
        },
        itemName: "ParkTrack PT-7K3Q shipping",
      }),
    ).toEqual({
      url: "https://newwebpay-sandbox.interswitchng.com/collections/w/pay",
      fields: {
        merchant_code: "MX6072",
        pay_item_id: "9405967",
        txn_ref: "ISW-PT-8F3KQ2XA",
        amount: "265000",
        currency: "566",
        site_redirect_url: "https://parktrack.ng/api/payments/callback",
        payment_response_type: "GET",
        cust_id: "u_tolu",
        cust_email: "tolu@example.com",
        cust_name: "Tolu Adeyemi",
        pay_item_name: "ParkTrack PT-7K3Q shipping",
      },
    });
  });

  it("refuses a non-kobo amount", () => {
    for (const amountKobo of [0, -100, 2650.5]) {
      expect(() =>
        checkoutForm(config, {
          txnRef: "ISW-PT-X",
          amountKobo,
          redirectUrl: "https://x",
          customer: { id: "u", email: "e@x.com" },
          itemName: "x",
        }),
      ).toThrow(/kobo/);
    }
  });
});

describe("status check request", () => {
  it("calls gettransaction.json with merchant code, reference and amount, no auth", async () => {
    const fetchImpl = vi.fn<
      (url: string | URL | Request, init?: RequestInit) => Promise<Response>
    >(async () =>
      Response.json({
        Amount: 265000,
        MerchantReference: "ISW-PT-8F3KQ2XA",
        PaymentReference: "UBA|API|MX6072|25-07-2024|249510|719456",
        TransactionDate: "2026-11-24T10:57:24",
        ResponseCode: "00",
        ResponseDescription: "Approved by Financial Institution",
      }),
    );
    const result = await requeryTransaction(
      config,
      "ISW-PT-8F3KQ2XA",
      265_000,
      {
        fetchImpl,
      },
    );
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe(
      "https://sandbox.interswitchng.com/collections/api/v1/gettransaction.json?merchantcode=MX6072&transactionreference=ISW-PT-8F3KQ2XA&amount=265000",
    );
    expect(init?.headers).not.toHaveProperty("authorization");
    expect(result).toMatchObject({
      responseCode: "00",
      amountKobo: 265_000,
      merchantReference: "ISW-PT-8F3KQ2XA",
      cancelled: false,
    });
  });

  it("throws on HTTP errors and replies without a code", async () => {
    await expect(
      requeryTransaction(config, "r", 1, {
        fetchImpl: async () => new Response("down", { status: 503 }),
      }),
    ).rejects.toThrow(/503/);
    await expect(
      requeryTransaction(config, "r", 1, {
        fetchImpl: async () => Response.json({ hello: "world" }),
      }),
    ).rejects.toThrow(/no ResponseCode/);
  });
});

describe("verdict: only 00 + exact amount + our reference is paid", () => {
  const startedAt = new Date("2026-11-24T10:00:00Z");
  const expected = {
    txnRef: "ISW-PT-8F3KQ2XA",
    amountKobo: 265_000,
    startedAt,
  };
  const at = (minutes: number) =>
    new Date(startedAt.getTime() + minutes * 60_000);
  const txn = (over: Partial<IswTransaction>): IswTransaction => ({
    responseCode: "00",
    description: "Approved by Financial Institution",
    amountKobo: 265_000,
    merchantReference: "ISW-PT-8F3KQ2XA",
    paymentReference: "REF",
    transactionDate: null,
    cancelled: false,
    ...over,
  });

  it("verified", () => {
    expect(classifyRequery(txn({}), expected, at(2))).toEqual({
      status: "VERIFIED",
      responseCode: "00",
      paymentReference: "REF",
    });
  });

  it("00 with the wrong amount or reference is a failure", () => {
    expect(
      classifyRequery(txn({ amountKobo: 100 }), expected, at(2)),
    ).toMatchObject({
      status: "FAILED",
      reason: expect.stringMatching(/Amount mismatch/),
      final: true,
    });
    expect(
      classifyRequery(
        txn({ merchantReference: "ISW-PT-OTHER" }),
        expected,
        at(2),
      ),
    ).toMatchObject({
      status: "FAILED",
      reason: "Reference mismatch",
      final: true,
    });
  });

  it("declines fail with Interswitch's reason (e.g. 51 insufficient funds)", () => {
    const declined = txn({
      responseCode: "51",
      description: "Insufficient Funds",
      amountKobo: 0,
    });
    // Inside the window the customer can still retry on the same page
    // (in the sandbox a 51 turned into 00 after "Retry payment").
    expect(classifyRequery(declined, expected, at(2))).toEqual({
      status: "FAILED",
      responseCode: "51",
      reason: "Insufficient Funds",
      final: false,
    });
    expect(classifyRequery(declined, expected, at(31))).toMatchObject({
      status: "FAILED",
      final: true,
    });
  });

  it("not found / in progress is pending for 30 minutes, then failed", () => {
    for (const code of ["Z25", "Z0", "Z1", "09", "S0"]) {
      expect(
        classifyRequery(
          txn({ responseCode: code, amountKobo: 0 }),
          expected,
          at(5),
        ).status,
        code,
      ).toBe("PENDING");
      expect(
        classifyRequery(
          txn({ responseCode: code, amountKobo: 0 }),
          expected,
          at(31),
        ).status,
        code,
      ).toBe("FAILED");
    }
  });

  it("cancelled is a failure; network errors stay pending", () => {
    expect(
      classifyRequery(
        txn({ responseCode: "Z6", cancelled: true }),
        expected,
        at(1),
      ),
    ).toMatchObject({ status: "FAILED", reason: "Payment was cancelled" });
    expect(
      classifyRequery({ error: "timeout" }, expected, at(1)),
    ).toMatchObject({
      status: "PENDING",
    });
  });
});
