import type { ChannelAdapter, OutboundExtra } from "./channels";

/**
 * WhatsApp Cloud API adapter (Scope 03 sl7).
 *
 * POST https://graph.facebook.com/{version}/{WA_PHONE_NUMBER_ID}/messages
 * with "Authorization: Bearer {WA_TOKEN}". ParkTrack writes first, so
 * every message is an approved TEMPLATE (free-form text only works inside a
 * 24-hour reply window). Two templates, created once in WhatsApp Manager:
 *
 *   parktrack_update  UTILITY, English
 *     "Update from ParkTrack: {{1}} Thanks for using ParkTrack."
 *     {{1}} is the same message the SMS carries (without "ParkTrack: ").
 *     Meta rejects templates that start or end with a variable, hence the
 *     fixed words around it.
 *   parktrack_code    AUTHENTICATION, English, copy-code button
 *     "{{1}} is your verification code." + security note + 10-minute
 *     expiry. Meta only allows one-time codes in AUTHENTICATION templates,
 *     which can't hold links or other text, so sign-in and collection
 *     codes use this one.
 *
 * Any error (template not approved 132001, not on WhatsApp 131026, bad
 * token 190, rate limits, timeout) throws, and ./channels.ts falls back to
 * SMS. "Accepted" means Meta took the message, not that it was delivered.
 */

export const WHATSAPP_API_VERSION = "v27.0";
export const WHATSAPP_TEMPLATES = {
  update: { name: "parktrack_update", language: "en" },
  code: { name: "parktrack_code", language: "en" },
} as const;

/** Wording to submit in WhatsApp Manager (see the scope doc). */
export const WHATSAPP_TEMPLATE_DEFINITIONS = [
  {
    name: WHATSAPP_TEMPLATES.update.name,
    category: "UTILITY",
    language: WHATSAPP_TEMPLATES.update.language,
    body: "Update from ParkTrack: {{1}} Thanks for using ParkTrack.",
    example:
      "Update from ParkTrack: your parcel PT-7K3Q is at Iwo Road Park, bay C4. Free storage until Mon 23 Nov, 2:10 PM, then ₦300 a day. https://parktrack.ng/t/abc Thanks for using ParkTrack.",
  },
  {
    name: WHATSAPP_TEMPLATES.code.name,
    category: "AUTHENTICATION",
    language: WHATSAPP_TEMPLATES.code.language,
    body: "{{1}} is your verification code. For your security, do not share this code. This code expires in 10 minutes.",
    button: "Copy code (OTP, copy_code)",
  },
] as const;

export type WhatsAppConfig = {
  phoneNumberId: string;
  token: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

/** The template parameter for an update: the SMS text without its prefix. */
export function updateParameter(text: string): string {
  return text
    .replace(/^ParkTrack( reminder)?:\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** The request body for one message (exported for tests). */
export function whatsAppBody(
  phone: string,
  text: string,
  extra: OutboundExtra = {},
): Record<string, unknown> {
  const base = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    // Meta recommends the + and country code (no + risks misdelivery).
    to: phone.startsWith("+") ? phone : `+${phone}`,
    type: "template",
  };
  if (extra.code) {
    const { name, language } = WHATSAPP_TEMPLATES.code;
    return {
      ...base,
      template: {
        name,
        language: { code: language },
        components: [
          { type: "body", parameters: [{ type: "text", text: extra.code }] },
          {
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [{ type: "text", text: extra.code }],
          },
        ],
      },
    };
  }
  const { name, language } = WHATSAPP_TEMPLATES.update;
  return {
    ...base,
    template: {
      name,
      language: { code: language },
      components: [
        {
          type: "body",
          parameters: [{ type: "text", text: updateParameter(text) }],
        },
      ],
    },
  };
}

type GraphError = {
  error?: {
    message?: string;
    code?: number;
    error_data?: { details?: string };
  };
};
type GraphSuccess = {
  messages?: { id?: string; message_status?: string }[];
};

export function createWhatsAppAdapter({
  phoneNumberId,
  token,
  fetchImpl = fetch,
  timeoutMs = 10_000,
}: WhatsAppConfig): ChannelAdapter {
  const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${phoneNumberId}/messages`;
  return {
    async send(phone, text, extra) {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(whatsAppBody(phone, text, extra)),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const body = (await res.json().catch(() => null)) as
        (GraphError & GraphSuccess) | null;
      if (!res.ok || body?.error) {
        const e = body?.error;
        // Never echo the request (token, codes).
        throw new Error(
          `WhatsApp ${e?.code ?? res.status}: ${e?.error_data?.details ?? e?.message ?? "send failed"}`,
        );
      }
      const status = body?.messages?.[0]?.message_status;
      if (!body?.messages?.[0]?.id || status === "paused") {
        throw new Error(
          `WhatsApp: message not accepted (${status ?? "no id"})`,
        );
      }
    },
  };
}

/** The adapter from environment settings, or the keys that are missing. */
export function whatsAppFromEnv(env: {
  WA_PHONE_NUMBER_ID?: string;
  WA_TOKEN?: string;
}): ChannelAdapter | { missing: string[] } {
  const missing = (["WA_PHONE_NUMBER_ID", "WA_TOKEN"] as const).filter(
    (k) => !env[k],
  );
  if (missing.length) return { missing };
  return createWhatsAppAdapter({
    phoneNumberId: env.WA_PHONE_NUMBER_ID!,
    token: env.WA_TOKEN!,
  });
}
