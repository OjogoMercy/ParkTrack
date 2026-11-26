import { serverEnv } from "@/lib/env";
import { recheckDuePayments } from "@/server/payments";
import {
  QSTASH_SIGNATURE_HEADER,
  verifyQStash,
} from "@/server/payments/qstash";

/**
 * Up to 20 payments, 4 at a time: 5 rounds of status checks (≤ 15 s each),
 * and a refund re-send can take a token call (15 s) plus the request
 * (20 s). Worst case is well over 60 s when Interswitch hangs, so allow the
 * platform default of 300 s instead of being cut off mid-run.
 */
export const maxDuration = 300;

const PATH = "/api/jobs/requery";

/**
 * POST /api/jobs/requery — called by a QStash schedule (every 5 minutes).
 * The Upstash-Signature must verify with QSTASH_CURRENT_SIGNING_KEY or
 * QSTASH_NEXT_SIGNING_KEY. Re-checks payments that are due (pending, or
 * declined but still retryable, or verified but not yet applied) and
 * returns counts. 401 unsigned, 503 when the keys aren't set.
 */
export async function POST(request: Request): Promise<Response> {
  const body = await request.text();
  const env = serverEnv();
  const keys = {
    current: env.QSTASH_CURRENT_SIGNING_KEY,
    next: env.QSTASH_NEXT_SIGNING_KEY,
  };
  if (!keys.current && !keys.next) {
    console.error("[payments] re-check job called but QStash keys are not set");
    return error(503, "jobs_unavailable", "QStash signing keys aren't set.");
  }
  const signed = await verifyQStash(
    {
      signature: request.headers.get(QSTASH_SIGNATURE_HEADER),
      body,
      path: PATH,
    },
    keys,
  );
  if (!signed) return error(401, "bad_signature", "Not signed by QStash.");
  const result = await recheckDuePayments();
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}

function error(status: number, code: string, message: string): Response {
  return Response.json(
    { error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
