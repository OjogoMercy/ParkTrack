import { PaymentError, handleWebhook } from "@/server/payments";

/**
 * POST /api/webhooks/interswitch — Interswitch event notifications
 * (Quickteller Business → Developer Tools → Webhooks, TRANSACTION events).
 * Signed with X-Interswitch-Signature; the payment itself is decided by
 * our own status check. Interswitch wants a bare 200 (any body is
 * discarded) and retries anything else up to 5 times, so: 200 for
 * processed and duplicate events, 401/400 for messages that aren't
 * Interswitch's, 503/500 when we couldn't process it (they retry).
 */
export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();
  try {
    await handleWebhook(rawBody, request.headers);
    return empty(200);
  } catch (e) {
    if (e instanceof PaymentError) {
      if (e.status >= 500) console.error("[payments] webhook", e.message);
      return empty(e.status);
    }
    console.error("[payments] webhook", e);
    return empty(500);
  }
}

function empty(status: number): Response {
  return new Response(null, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
