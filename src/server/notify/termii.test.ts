import { describe, expect, it, vi } from "vitest";
import {
  createTermiiAdapter,
  smsSafe,
  termiiFromEnv,
  termiiNumber,
} from "./termii";

const config = {
  apiKey: "test-key",
  senderId: "ParkTrack",
  baseUrl: "https://example.api.termii.test/",
  channel: "dnd" as const,
};

function fakeFetch(status: number, body: unknown) {
  // Typed like fetch so tests can read mock.calls[0] as [url, init].
  return vi.fn<
    (url: string | URL | Request, init?: RequestInit) => Promise<Response>
  >(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
  );
}

describe("Termii adapter", () => {
  it("posts the documented body to {base URL}/api/sms/send", async () => {
    const fetchImpl = fakeFetch(200, {
      code: "ok",
      message_id: "3017544054459083819856413",
      message: "Successfully Sent",
      balance: 1047.57,
      user: "ParkTrack",
    });
    await createTermiiAdapter({ ...config, fetchImpl }).send(
      "+2348035554471",
      "ParkTrack: payment received for PT-7K3Q (₦2,650).",
    );
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://example.api.termii.test/api/sms/send");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      api_key: "test-key",
      to: "2348035554471",
      from: "ParkTrack",
      sms: "ParkTrack: payment received for PT-7K3Q (N2,650).",
      type: "plain",
      channel: "dnd",
    });
  });

  it("throws with Termii's reason on an error status, without the key", async () => {
    const fetchImpl = fakeFetch(400, { message: "Invalid Sender Id" });
    const err = await createTermiiAdapter({ ...config, fetchImpl })
      .send("+2348035554471", "hi")
      .catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe("Termii 400: Invalid Sender Id");
    expect((err as Error).message).not.toContain("test-key");
  });

  it("treats a 200 that isn't ok as a failure", async () => {
    const fetchImpl = fakeFetch(200, {
      code: "error",
      message: "Insufficient balance",
    });
    await expect(
      createTermiiAdapter({ ...config, fetchImpl }).send(
        "+2348035554471",
        "hi",
      ),
    ).rejects.toThrow(/Insufficient balance/);
  });

  it("gives up after the timeout", async () => {
    const fetchImpl = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_, reject) =>
          init?.signal?.addEventListener("abort", () =>
            reject(new Error("timed out")),
          ),
        ),
    );
    await expect(
      createTermiiAdapter({ ...config, fetchImpl, timeoutMs: 20 }).send(
        "+2348035554471",
        "hi",
      ),
    ).rejects.toThrow(/timed out/);
  });
});

describe("SMS text", () => {
  it("keeps messages in the 160-character alphabet", () => {
    expect(smsSafe("₦300 a day · isn’t “ready” — yet…")).toBe(
      `N300 a day - isn't "ready" - yet...`,
    );
  });

  it("keeps Yoruba names readable", () => {
    expect(smsSafe("Adébáyọ̀ Ọlásùnkànmí")).toBe("Adebayo Olasunkanmi");
  });

  it("numbers go without the plus", () => {
    expect(termiiNumber("+2348035554471")).toBe("2348035554471");
  });
});

describe("settings", () => {
  it("names what's missing", () => {
    expect(
      termiiFromEnv({ TERMII_API_KEY: "k", TERMII_CHANNEL: "dnd" }),
    ).toEqual({ missing: ["TERMII_SENDER_ID", "TERMII_BASE_URL"] });
  });

  it("builds the adapter when everything is set", () => {
    const a = termiiFromEnv({
      TERMII_API_KEY: "k",
      TERMII_SENDER_ID: "ParkTrack",
      TERMII_BASE_URL: "https://x.api.termii.test",
      TERMII_CHANNEL: "dnd",
    });
    expect("send" in a).toBe(true);
  });
});
