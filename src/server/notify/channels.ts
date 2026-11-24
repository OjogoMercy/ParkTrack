/**
 * How a message leaves the server.
 *
 *   NOTIFY_MODE=console  printed to the server log (development default);
 *                        logged as channel CONSOLE. In production any
 *                        6-digit code is blanked out of the printed text.
 *   NOTIFY_MODE=live     the person's preferred channel first (WhatsApp or
 *                        SMS), then the other one if it fails: WhatsApp
 *                        Cloud API (./whatsapp.ts) and Termii SMS
 *                        (./termii.ts). A WhatsApp template that isn't
 *                        approved, a number not on WhatsApp, a bad token or
 *                        a timeout all fall back to SMS.
 *
 * Each attempt is reported so ./index.ts can log it in `notifications`.
 */

import { serverEnv } from "@/lib/env";
import { termiiFromEnv } from "./termii";
import { whatsAppFromEnv } from "./whatsapp";

export type LiveChannel = "WHATSAPP" | "SMS";

/** Extra facts a channel may need beyond the text. */
export type OutboundExtra = {
  /** One-time code in the message: WhatsApp must use its code template. */
  code?: string;
};

export interface ChannelAdapter {
  /** Resolves when the provider accepted the message; throws otherwise. */
  send(phone: string, text: string, extra?: OutboundExtra): Promise<void>;
}

export type Attempt = {
  channel: LiveChannel | "CONSOLE";
  ok: boolean;
  error?: string;
};

/** Adapters are built from the environment on each send (keys can change). */
export const liveAdapters: Record<LiveChannel, ChannelAdapter> = {
  WHATSAPP: {
    async send(phone, text, extra) {
      const adapter = whatsAppFromEnv(serverEnv());
      if ("missing" in adapter) {
        throw new Error(
          `WhatsApp isn't set up: add ${adapter.missing.join(", ")}`,
        );
      }
      await adapter.send(phone, text, extra);
    },
  },
  SMS: {
    async send(phone, text, extra) {
      const adapter = termiiFromEnv(serverEnv());
      if ("missing" in adapter) {
        throw new Error(`SMS isn't set up: add ${adapter.missing.join(", ")}`);
      }
      await adapter.send(phone, text, extra);
    },
  },
};

function printable(text: string, production: boolean): string {
  return production ? text.replace(/\b\d{6}\b/g, "******") : text;
}

export async function deliver(
  phone: string,
  text: string,
  preferred: LiveChannel,
  {
    mode,
    production,
    extra = {},
    adapters = liveAdapters,
  }: {
    mode: "console" | "live";
    production: boolean;
    extra?: OutboundExtra;
    adapters?: Record<LiveChannel, ChannelAdapter>;
  },
): Promise<Attempt[]> {
  if (mode === "console") {
    console.info(
      `[notify] to ${phone} (${preferred}): ${printable(text, production)}`,
    );
    return [{ channel: "CONSOLE", ok: true }];
  }
  const order: LiveChannel[] =
    preferred === "WHATSAPP" ? ["WHATSAPP", "SMS"] : ["SMS", "WHATSAPP"];
  const attempts: Attempt[] = [];
  for (const channel of order) {
    try {
      await adapters[channel].send(phone, text, extra);
      attempts.push({ channel, ok: true });
      break;
    } catch (e) {
      attempts.push({
        channel,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return attempts;
}
