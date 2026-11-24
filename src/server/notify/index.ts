/**
 * Owned by Scope 03 (docs/scopes/03-parcel-engine.md). Exported names and
 * types are FINAL; callers never change. Real since Scope 03 sl5: PRD §11
 * templates, the `notifications` log and the console channel. The live
 * SMS (sl6) and WhatsApp (sl7) adapters plug into ./channels.ts.
 */
import "server-only";
import type { NotificationEvent } from "@/contracts/notifications";
import { NOTIFICATION_AUDIENCE } from "@/contracts/notifications";
import { db } from "@/lib/db";
import { serverEnv } from "@/lib/env";
import { deliver, type Attempt, type LiveChannel } from "./channels";
import { loadMessageContext } from "./context";
import { renderCodeMessage, renderMessage } from "./templates";

export const STUB = false;

/**
 * Sends the PRD §11 messages for an event to everyone in its audience
 * (WhatsApp, SMS fallback, or the server log when NOTIFY_MODE=console).
 * Each attempt is logged in `notifications` (who, channel, template,
 * status; never the text, which may hold a code). The recipient hears
 * nothing before the drop-off handshake (HS-7).
 * Never throws because a message failed to deliver.
 */
export async function notify(
  event: NotificationEvent,
  parcelId: string | null,
  extra: Record<string, string | number> = {},
): Promise<{ sent: number }> {
  let sent = 0;
  try {
    const audiences = NOTIFICATION_AUDIENCE[event];
    if (!parcelId || audiences.length === 0) return { sent };
    const env = serverEnv();
    const loaded = await loadMessageContext(parcelId, audiences, extra, {
      rootDomain: env.ROOT_DOMAIN,
    });
    if (!loaded) return { sent };

    for (const person of loaded.people) {
      const text = renderMessage(event, person.audience, loaded.context);
      if (!text) continue;
      const attempts = await deliver(person.phone, text, person.preferred, {
        mode: env.NOTIFY_MODE,
        production: env.NODE_ENV === "production",
      });
      await logAttempts(
        attempts,
        person.phone,
        `${event}.${person.audience}`,
        parcelId,
      );
      if (attempts.some((a) => a.ok)) sent++;
    }
  } catch (e) {
    console.error(`[notify] ${event} for ${parcelId ?? "-"} failed`, e);
  }
  return { sent };
}

/**
 * One-off code message (sign-in OTP, SMS handshake code). Returns the
 * channel that delivered it (CONSOLE counts as the asked-for channel in
 * development). Never throws; a failed send is logged.
 */
export async function sendCode(
  phone: string,
  code: string,
  channel: "WHATSAPP" | "SMS",
): Promise<{ channel: "WHATSAPP" | "SMS" }> {
  try {
    const env = serverEnv();
    const attempts = await deliver(phone, renderCodeMessage(code), channel, {
      mode: env.NOTIFY_MODE,
      production: env.NODE_ENV === "production",
    });
    await logAttempts(attempts, phone, "otp", null);
    const used = attempts.find((a) => a.ok)?.channel;
    return { channel: used === "SMS" || used === "WHATSAPP" ? used : channel };
  } catch (e) {
    console.error("[notify] code message failed", e);
    return { channel };
  }
}

async function logAttempts(
  attempts: Attempt[],
  phone: string,
  template: string,
  parcelId: string | null,
): Promise<void> {
  const now = new Date();
  await db.notification.createMany({
    data: attempts.map((a) => ({
      parcelId,
      phone,
      channel: a.channel satisfies LiveChannel | "CONSOLE",
      template,
      status: a.ok ? ("SENT" as const) : ("FAILED" as const),
      error: a.error?.slice(0, 500) ?? null,
      sentAt: a.ok ? now : null,
    })),
  });
}
