import { describe, expect, it, vi } from "vitest";
import { deliver, type ChannelAdapter, type LiveChannel } from "./channels";
import {
  createWhatsAppAdapter,
  updateParameter,
  WHATSAPP_TEMPLATE_DEFINITIONS,
  whatsAppBody,
  whatsAppFromEnv,
} from "./whatsapp";

function fakeFetch(status: number, body: unknown) {
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
const accepted = {
  messaging_product: "whatsapp",
  contacts: [{ input: "+2348035554471", wa_id: "2348035554471" }],
  messages: [{ id: "wamid.HBgN", message_status: "accepted" }],
};
const config = { phoneNumberId: "1234567890", token: "secret-token" };

describe("WhatsApp request", () => {
  it("parcel updates use the utility template with the SMS text", () => {
    expect(
      whatsAppBody(
        "+2348035554471",
        "ParkTrack: your parcel PT-7K3Q is at Iwo Road Park. https://parktrack.ng/t/abc",
      ),
    ).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "+2348035554471",
      type: "template",
      template: {
        name: "parktrack_update",
        language: { code: "en" },
        components: [
          {
            type: "body",
            parameters: [
              {
                type: "text",
                text: "your parcel PT-7K3Q is at Iwo Road Park. https://parktrack.ng/t/abc",
              },
            ],
          },
        ],
      },
    });
  });

  it("codes use the authentication template, code in body and button", () => {
    const body = whatsAppBody("2348035554471", "ignored", { code: "482913" });
    expect(body.to).toBe("+2348035554471");
    expect(body.template).toEqual({
      name: "parktrack_code",
      language: { code: "en" },
      components: [
        { type: "body", parameters: [{ type: "text", text: "482913" }] },
        {
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [{ type: "text", text: "482913" }],
        },
      ],
    });
  });

  it("strips the prefix and stray whitespace from the update text", () => {
    expect(updateParameter("ParkTrack reminder: drop  PT-7K3Q\nsoon")).toBe(
      "drop PT-7K3Q soon",
    );
  });

  it("the template wording follows Meta's rules", () => {
    const update = WHATSAPP_TEMPLATE_DEFINITIONS[0].body;
    expect(update.startsWith("{{")).toBe(false); // no leading variable
    expect(update.endsWith("}}")).toBe(false); // no trailing variable
    expect(update.length).toBeLessThanOrEqual(1024);
  });
});

describe("WhatsApp adapter", () => {
  it("posts to the Graph API with the bearer token", async () => {
    const fetchImpl = fakeFetch(200, accepted);
    await createWhatsAppAdapter({ ...config, fetchImpl }).send(
      "+2348035554471",
      "ParkTrack: hi PT-7K3Q",
    );
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://graph.facebook.com/v27.0/1234567890/messages");
    expect((init?.headers as Record<string, string>).authorization).toBe(
      "Bearer secret-token",
    );
  });

  it("throws Meta's error code and details, never the token", async () => {
    const fetchImpl = fakeFetch(400, {
      error: {
        message: "(#132001) Template name does not exist in the translation",
        type: "OAuthException",
        code: 132001,
        error_data: {
          messaging_product: "whatsapp",
          details: "template name (parktrack_update) does not exist in en",
        },
        fbtrace_id: "Az8",
      },
    });
    const err = await createWhatsAppAdapter({ ...config, fetchImpl })
      .send("+2348035554471", "hi")
      .catch((e: Error) => e);
    expect((err as Error).message).toBe(
      "WhatsApp 132001: template name (parktrack_update) does not exist in en",
    );
    expect((err as Error).message).not.toContain("secret-token");
  });

  it("a paused template counts as a failure", async () => {
    const fetchImpl = fakeFetch(200, {
      ...accepted,
      messages: [{ id: "wamid.x", message_status: "paused" }],
    });
    await expect(
      createWhatsAppAdapter({ ...config, fetchImpl }).send("+234", "hi"),
    ).rejects.toThrow(/not accepted \(paused\)/);
  });

  it("names missing settings", () => {
    expect(whatsAppFromEnv({ WA_TOKEN: "t" })).toEqual({
      missing: ["WA_PHONE_NUMBER_ID"],
    });
  });
});

describe("fallback to SMS", () => {
  it("an unapproved WhatsApp template falls back to SMS, both logged, code passed on", async () => {
    const seen: { channel: string; code?: string }[] = [];
    const adapter = (channel: LiveChannel, fail?: string): ChannelAdapter => ({
      async send(_phone, _text, extra) {
        seen.push({ channel, code: extra?.code });
        if (fail) throw new Error(fail);
      },
    });
    const attempts = await deliver(
      "+2348035554471",
      "code 482913",
      "WHATSAPP",
      {
        mode: "live",
        production: true,
        extra: { code: "482913" },
        adapters: {
          WHATSAPP: adapter("WHATSAPP", "WhatsApp 132001: not approved"),
          SMS: adapter("SMS"),
        },
      },
    );
    expect(attempts).toEqual([
      {
        channel: "WHATSAPP",
        ok: false,
        error: "WhatsApp 132001: not approved",
      },
      { channel: "SMS", ok: true },
    ]);
    expect(seen).toEqual([
      { channel: "WHATSAPP", code: "482913" },
      { channel: "SMS", code: "482913" },
    ]);
  });
});
