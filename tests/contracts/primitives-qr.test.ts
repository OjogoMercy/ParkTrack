import { describe, expect, it } from "vitest";
import {
  ParcelCode,
  ParkSlug,
  Phone,
  SixDigitCode,
  bookingQr,
  counterQrUrl,
  handshakeQrUrl,
  manifestQr,
  parseQr,
} from "@/contracts";

const TOKEN = "7f3kQ2xN9mVw4cLs8RtYuA";

describe("primitives", () => {
  it("parcel codes are PT- plus 4 unambiguous characters", () => {
    expect(ParcelCode.safeParse("PT-7K3Q").success).toBe(true);
    expect(ParcelCode.safeParse("PT-7K3O").success).toBe(false); // O
    expect(ParcelCode.safeParse("PT-1K3Q").success).toBe(false); // 1
    expect(ParcelCode.safeParse("pt-7k3q").success).toBe(false);
  });

  it("phones are Nigerian E.164", () => {
    expect(Phone.safeParse("+2348035554471").success).toBe(true);
    expect(Phone.safeParse("08035554471").success).toBe(false);
    expect(Phone.safeParse("+23480355544").success).toBe(false);
  });

  it("codes are six digits", () => {
    expect(SixDigitCode.safeParse("482913").success).toBe(true);
    expect(SixDigitCode.safeParse("4829").success).toBe(false);
  });

  it("park slugs reject reserved names", () => {
    expect(ParkSlug.safeParse("ogbomoso").success).toBe(true);
    for (const s of ["www", "app", "admin", "api"])
      expect(ParkSlug.safeParse(s).success).toBe(false);
  });
});

describe("QR payloads (random IDs only)", () => {
  it("round-trips every kind", () => {
    expect(parseQr(bookingQr(TOKEN))).toEqual({
      kind: "booking",
      publicId: TOKEN,
    });
    expect(parseQr(manifestQr(TOKEN))).toEqual({
      kind: "manifest",
      token: TOKEN,
    });
    expect(parseQr(handshakeQrUrl("parktrack.ng", TOKEN))).toEqual({
      kind: "handshake",
      token: TOKEN,
    });
    expect(parseQr(counterQrUrl("parktrack.ng", TOKEN))).toEqual({
      kind: "counter",
      token: TOKEN,
    });
  });

  it("builds https in production and http on localhost", () => {
    expect(counterQrUrl("parktrack.ng", TOKEN)).toBe(
      `https://parktrack.ng/collect/${TOKEN}`,
    );
    expect(handshakeQrUrl("localhost:3000", TOKEN)).toBe(
      `http://localhost:3000/h/${TOKEN}`,
    );
  });

  it("rejects anything that isn't a ParkTrack code", () => {
    for (const raw of [
      "",
      "hello",
      "pt:b:short",
      "pt:x:" + TOKEN,
      "https://example.com/other/" + TOKEN,
      "https://parktrack.ng/collect/a b",
    ])
      expect(parseQr(raw), raw).toBeNull();
  });
});
