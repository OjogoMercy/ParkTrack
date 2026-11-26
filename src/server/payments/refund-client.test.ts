import { beforeEach, describe, expect, it, vi } from "vitest";
import { iswConfig } from "./interswitch";
import {
  clearTokenCache,
  getRefund,
  passportToken,
  refundRefFor,
  refundState,
  requestRefund,
} from "./refund-client";

const config = iswConfig({
  ISW_ENVIRONMENT: "sandbox",
  ISW_MERCHANT_CODE: "MX6072",
  ISW_PAY_ITEM_ID: "9405967",
});
const creds = { clientId: "IKIA-TEST", secret: "secret" };
type Call = [string, RequestInit | undefined];

function fakeFetch(...replies: Response[]) {
  const calls: Call[] = [];
  const impl = vi.fn(
    async (url: string | URL | Request, init?: RequestInit) => {
      calls.push([String(url), init]);
      return replies.shift() ?? new Response("{}", { status: 500 });
    },
  );
  return { impl: impl as unknown as typeof fetch, calls };
}
const token = () =>
  Response.json({
    access_token: "tok",
    token_type: "bearer",
    expires_in: 3600,
  });

beforeEach(() => clearTokenCache());

describe("Passport token", () => {
  it("Basic client:secret, grant type in the body only, cached", async () => {
    const f = fakeFetch(token());
    expect(await passportToken(config, creds, { fetchImpl: f.impl })).toBe(
      "tok",
    );
    expect(await passportToken(config, creds, { fetchImpl: f.impl })).toBe(
      "tok",
    );
    expect(f.calls).toHaveLength(1);
    const [url, init] = f.calls[0];
    expect(url).toBe(
      "https://passport-sandbox.interswitchng.com/passport/oauth/token",
    );
    expect(init?.body).toBe("grant_type=client_credentials");
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from("IKIA-TEST:secret").toString("base64")}`,
    );
  });
});

describe("refund request", () => {
  it("FULL refund of Interswitch's PaymentId with our reference", async () => {
    const f = fakeFetch(
      token(),
      Response.json({ id: 10174, refundStatus: "PENDING" }),
    );
    expect(
      await requestRefund(
        config,
        creds,
        {
          refundReference: "ISW-RF-8F3KQ2XA",
          parentPaymentId: "475054882",
          amountKobo: 265_000,
        },
        { fetchImpl: f.impl },
      ),
    ).toEqual({ ok: true, providerId: "10174", status: "PENDING" });
    const [url, init] = f.calls[1];
    expect(url).toBe(
      "https://sandbox.interswitchng.com/paymentgateway/api/v1/refunds",
    );
    expect(JSON.parse(String(init?.body))).toEqual({
      refundReference: "ISW-RF-8F3KQ2XA",
      parentPaymentId: "475054882",
      refundType: "FULL",
      refundAmount: 265_000,
    });
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      "Bearer tok",
    );
  });

  it("a refusal (10400) is final; a server error or no network is unknown", async () => {
    const refused = fakeFetch(
      token(),
      Response.json(
        { code: "10400", description: "Refund account number not found" },
        { status: 400 },
      ),
    );
    expect(
      await requestRefund(
        config,
        creds,
        { refundReference: "r", parentPaymentId: "1", amountKobo: 100_000 },
        { fetchImpl: refused.impl },
      ),
    ).toEqual({
      ok: false,
      code: "10400",
      description: "Refund account number not found",
      retryable: false,
    });
    clearTokenCache();
    const broken = fakeFetch(
      token(),
      Response.json(
        { code: "10500", description: "Error creating refund" },
        { status: 500 },
      ),
    );
    expect(
      await requestRefund(
        config,
        creds,
        { refundReference: "r", parentPaymentId: "1", amountKobo: 100_000 },
        { fetchImpl: broken.impl },
      ),
    ).toMatchObject({ ok: false, code: "10500", retryable: true });
    clearTokenCache();
    const offline = (async () => {
      throw new Error("ECONNRESET");
    }) as unknown as typeof fetch;
    expect(
      await requestRefund(
        config,
        creds,
        { refundReference: "r", parentPaymentId: "1", amountKobo: 100_000 },
        { fetchImpl: offline },
      ),
    ).toMatchObject({ ok: false, code: "network", retryable: true });
  });

  it("maps Interswitch's statuses and derives refund references", () => {
    expect(refundState("PENDING")).toBe("PENDING");
    expect(refundState("SUCCESS")).toBe("PENDING");
    expect(refundState("PROCESSING")).toBe("PENDING");
    expect(refundState("COMPLETE")).toBe("VERIFIED");
    expect(refundState("COMPLETE_MANUAL")).toBe("VERIFIED");
    expect(refundState("FAILED")).toBe("FAILED");
    expect(refundRefFor("ISW-PT-8F3KQ2XA")).toBe("ISW-RF-8F3KQ2XA");
  });
});

describe("refund status", () => {
  it("GET by our refund reference with the Passport token", async () => {
    const f = fakeFetch(
      token(),
      Response.json({
        id: 12,
        refundReference: "ISW-RF-PPZG8HEM",
        refundStatus: "COMPLETE",
      }),
    );
    const answer = await getRefund(config, creds, "ISW-RF-PPZG8HEM", {
      fetchImpl: f.impl,
    });
    expect(answer).toEqual({ ok: true, providerId: "12", status: "COMPLETE" });
    const [url, init] = f.calls[1];
    expect(url).toBe(
      "https://sandbox.interswitchng.com/paymentgateway/api/v1/refunds?refundReference=ISW-RF-PPZG8HEM",
    );
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      "Bearer tok",
    );
  });

  it("an empty 200 means Interswitch has no such refund", async () => {
    const f = fakeFetch(token(), new Response("", { status: 200 }));
    const answer = await getRefund(config, creds, "ISW-RF-X", {
      fetchImpl: f.impl,
    });
    expect(answer.ok).toBe(false);
  });

  it("never throws on a network error", async () => {
    const impl = vi.fn(async () => {
      throw new Error("timeout");
    }) as unknown as typeof fetch;
    const answer = await getRefund(config, creds, "ISW-RF-X", {
      fetchImpl: impl,
    });
    expect(answer).toEqual({ ok: false, description: "timeout" });
  });
});
