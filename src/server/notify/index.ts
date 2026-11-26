/**
 * Owned by Scope 03 (docs/scopes/03-parcel-engine.md). Exported names and
 * types are FINAL; callers never change. Real since Scope 03 sl5: PRD §11
 * templates, the `notifications` log and the console channel; live sends
 * through WhatsApp Cloud API (sl7) with Termii SMS (sl6) as fallback.
 */
import "server-only";
import type { NotificationEvent } from "@/contracts/notifications";
import {
  NOTIFICATION_AUDIENCE,
  type Audience,
} from "@/contracts/notifications";
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
): Promise<{ sent: number; reached: Audience[] }> {
  let sent = 0;
  const reached: Audience[] = [];
  try {
    const audiences = NOTIFICATION_AUDIENCE[event];
    if (!parcelId || audiences.length === 0) return { sent, reached };
    const env = serverEnv();
    const loaded = await loadMessageContext(parcelId, audiences, extra, {
      rootDomain: env.ROOT_DOMAIN,
    });
    if (!loaded) return { sent, reached };

    for (const person of loaded.people) {
      const text = renderMessage(
        event,
        person.audience,
        loaded.context,
        person.language,
      );
      if (!text) continue;
      const attempts = await deliver(person.phone, text, person.preferred, {
        mode: env.NOTIFY_MODE,
        production: env.NODE_ENV === "production",
        // Code messages use the WhatsApp code template (Meta policy).
        extra:
          event === "collection_started" && typeof extra.code === "string"
            ? { code: extra.code }
            : {},
      });
      await logAttempts(
        attempts,
        person.phone,
        `${event}.${person.audience}`,
        parcelId,
      );
      if (attempts.some((a) => a.ok)) {
        sent++;
        reached.push(person.audience);
      }
    }
  } catch (e) {
    console.error(`[notify] ${event} for ${parcelId ?? "-"} failed`, e);
  }
  return { sent, reached };
}

/**
 * One-off code message (sign-in OTP, SMS handshake code). Returns the
 * channel that delivered it (CONSOLE counts as the asked-for channel in
 * development) and whether anything was delivered at all. Never throws; a
 * failed send is logged.
 */
export async function sendCode(
  phone: string,
  code: string,
  channel: "WHATSAPP" | "SMS",
): Promise<{ channel: "WHATSAPP" | "SMS"; delivered: boolean }> {
  try {
    const env = serverEnv();
    // Pidgin if this phone belongs to someone who chose it.
    const user = await db.user.findUnique({
      where: { phone },
      select: { language: true },
    });
    const text = renderCodeMessage(
      code,
      user?.language === "PCM" ? "PCM" : "EN",
    );
    const attempts = await deliver(phone, text, channel, {
      mode: env.NOTIFY_MODE,
      production: env.NODE_ENV === "production",
      extra: { code },
    });
    await logAttempts(attempts, phone, "otp", null);
    const ok = attempts.find((a) => a.ok);
    const used = ok?.channel;
    return {
      channel: used === "SMS" || used === "WHATSAPP" ? used : channel,
      delivered: !!ok,
    };
  } catch (e) {
    console.error("[notify] code message failed", e);
    return { channel, delivered: false };
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
