import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseWebhook, verifySignature } from "./webhook";

const secret = "test-webhook-secret";
const sign = (body: string, key = secret) =>
  createHmac("sha512", key).update(body).digest("hex");

// The documented sample message, as raw text (spacing matters for the hash).
const body = `{"event": "TRANSACTION.COMPLETED", "uuid": "ISW-PT-8F3KQ2XA", "timestamp":1594646111460,"data":{"amount":265000,"merchantReference":"ISW-PT-8F3KQ2XA","responseCode":"00","responseDescription":"Approved by Financial Institution"}}`;

describe("signature (HMAC-SHA512 hex of the raw body)", () => {
  it("accepts the right signature, in either case", () => {
    expect(verifySignature(body, sign(body), secret)).toBe(true);
    expect(verifySignature(body, sign(body).toUpperCase(), secret)).toBe(true);
  });

  it("refuses a missing, malformed, wrong-key or tampered signature", () => {
    expect(verifySignature(body, null, secret)).toBe(false);
    expect(verifySignature(body, "", secret)).toBe(false);
    expect(verifySignature(body, "abc123", secret)).toBe(false);
    expect(verifySignature(body, sign(body, "other"), secret)).toBe(false);
    expect(verifySignature(body, sign(body), "")).toBe(false);
    // Re-serialised JSON is a different body: the raw text is what's signed.
    const reformatted = JSON.stringify(JSON.parse(body));
    expect(verifySignature(reformatted, sign(body), secret)).toBe(false);
    const tampered = body.replace("265000", "100");
    expect(verifySignature(tampered, sign(body), secret)).toBe(false);
  });
});

describe("parse", () => {
  it("reads our reference and keys each stage separately", () => {
    expect(parseWebhook(body)).toEqual({
      event: "TRANSACTION.COMPLETED",
      uuid: "ISW-PT-8F3KQ2XA",
      txnRef: "ISW-PT-8F3KQ2XA",
      responseCode: "00",
      providerRef: "TRANSACTION.COMPLETED:ISW-PT-8F3KQ2XA:00",
    });
    const created = parseWebhook(
      `{"event":"TRANSACTION.CREATED","uuid":"ISW-PT-8F3KQ2XA","data":{"merchantReference":"ISW-PT-8F3KQ2XA"}}`,
    );
    expect(created?.providerRef).toBe("TRANSACTION.CREATED:ISW-PT-8F3KQ2XA:-");
  });

  it("returns null for anything that isn't an event", () => {
    for (const raw of [
      "",
      "not json",
      "[]",
      "null",
      `{"uuid":"x"}`,
      `{"event":"X"}`,
    ]) {
      expect(parseWebhook(raw), raw).toBeNull();
    }
    expect(parseWebhook(`{"event":"INVOICES.X","uuid":7}`)?.txnRef).toBeNull();
  });
});
