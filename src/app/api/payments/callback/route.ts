import { serverEnv } from "@/lib/env";
import { siteUrl } from "@/server/notify/links";
import { handleCallback } from "@/server/payments";

/**
 * GET /api/payments/callback — where Interswitch sends the browser after
 * checkout (site_redirect_url, query parameters). Only `txnref` is read:
 * resp, desc and amount in the redirect are NOT trusted. We ask Interswitch
 * ourselves (requery), record the result, apply a verified payment, then
 * send the browser to /pay/{ref} to see where it stands.
 */
export async function GET(request: Request): Promise<Response> {
  const query = new URL(request.url).searchParams;
  const ref = query.get("txnref") ?? query.get("txnRef") ?? "";
  try {
    await handleCallback(query);
  } catch (e) {
    // Unknown reference or Interswitch unreachable: the status page and
    // the background re-check take it from here.
    console.error("[payments] callback", e);
  }
  const target = siteUrl(
    serverEnv().ROOT_DOMAIN,
    `/pay/${encodeURIComponent(ref)}`,
  );
  return new Response(null, {
    status: 303,
    headers: { Location: target, "Cache-Control": "no-store" },
  });
}
