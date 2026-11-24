/**
 * How a message leaves the server.
 *
 *   NOTIFY_MODE=console  printed to the server log (development default);
 *                        logged as channel CONSOLE. In production any
 *                        6-digit code is blanked out of the printed text.
 *   NOTIFY_MODE=live     the person's preferred channel first (WhatsApp or
 *                        SMS), then the other one if it fails. The adapters
 *                        arrive in sl6 (Termii SMS) and sl7 (WhatsApp Cloud
 *                        API); until then they report "not connected".
 *
 * Each attempt is reported so ./index.ts can log it in `notifications`.
 */

export type LiveChannel = "WHATSAPP" | "SMS";

export interface ChannelAdapter {
  /** Resolves when the provider accepted the message; throws otherwise. */
  send(phone: string, text: string): Promise<void>;
}

export type Attempt = {
  channel: LiveChannel | "CONSOLE";
  ok: boolean;
  error?: string;
};

const notConnected = (name: string): ChannelAdapter => ({
  async send() {
    throw new Error(`${name} isn't connected yet`);
  },
});

/** Live adapters by channel. sl6/sl7 replace these. */
export const liveAdapters: Record<LiveChannel, ChannelAdapter> = {
  WHATSAPP: notConnected("WhatsApp"),
  SMS: notConnected("SMS"),
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
    adapters = liveAdapters,
  }: {
    mode: "console" | "live";
    production: boolean;
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
      await adapters[channel].send(phone, text);
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
