import type { ChannelAdapter } from "./channels";

/**
 * Termii SMS adapter (Scope 03 sl6). POST {base URL}/api/sms/send with
 * { api_key, to, from, sms, type: "plain", channel } (developers.termii.com,
 * Messaging API). The base URL is specific to each Termii account (shown
 * on the dashboard), so it comes from TERMII_BASE_URL.
 *
 * - `to`: international format without "+", e.g. 2348035554471.
 * - `channel`: "dnd" for transactional messages and codes (reaches numbers
 *   on Do-Not-Disturb; Termii activates it per account). "generic" is for
 *   promotions and must not carry codes.
 * - Text is made SMS-safe first: "₦" and curly punctuation would switch the
 *   whole message to Unicode (70 characters a page instead of 160).
 */

export type TermiiConfig = {
  apiKey: string;
  senderId: string;
  baseUrl: string;
  channel: "dnd" | "generic";
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

/** GSM-7 friendly text: keeps SMS at 160 characters a page. */
export function smsSafe(text: string): string {
  return (
    text
      .replace(/₦/g, "N")
      // Accented letters (Yoruba names: "Adébáyọ̀") → plain letters ("Adebayo").
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[–—]/g, "-")
      .replace(/·/g, "-")
      .replace(/…/g, "...")
      .replace(/[^\x20-\x7E\n]/g, "")
  );
}

/** "+2348035554471" → "2348035554471" */
export function termiiNumber(e164: string): string {
  return e164.replace(/^\+/, "");
}

export function createTermiiAdapter({
  apiKey,
  senderId,
  baseUrl,
  channel,
  fetchImpl = fetch,
  timeoutMs = 10_000,
}: TermiiConfig): ChannelAdapter {
  const url = `${baseUrl.replace(/\/+$/, "")}/api/sms/send`;
  return {
    async send(phone, text) {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          to: termiiNumber(phone),
          from: senderId,
          sms: smsSafe(text),
          type: "plain",
          channel,
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const body = (await res.json().catch(() => null)) as {
        code?: string;
        message?: string;
        message_id?: string;
      } | null;
      if (!res.ok || (body?.code && body.code !== "ok")) {
        // Never echo the request (it holds the API key and maybe a code).
        throw new Error(
          `Termii ${res.status}: ${body?.message ?? res.statusText ?? "send failed"}`,
        );
      }
    },
  };
}

/** The adapter from environment settings, or the reason it can't be built. */
export function termiiFromEnv(env: {
  TERMII_API_KEY?: string;
  TERMII_SENDER_ID?: string;
  TERMII_BASE_URL?: string;
  TERMII_CHANNEL: "dnd" | "generic";
}): ChannelAdapter | { missing: string[] } {
  const missing = (
    ["TERMII_API_KEY", "TERMII_SENDER_ID", "TERMII_BASE_URL"] as const
  ).filter((k) => !env[k]);
  if (missing.length) return { missing };
  return createTermiiAdapter({
    apiKey: env.TERMII_API_KEY!,
    senderId: env.TERMII_SENDER_ID!,
    baseUrl: env.TERMII_BASE_URL!,
    channel: env.TERMII_CHANNEL,
  });
}
