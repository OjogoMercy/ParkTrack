/**
 * Interswitch refunds (docs.interswitchgroup.com/docs/refunds):
 *   1. Passport token: POST {passport}/passport/oauth/token, Basic
 *      base64(ISW_CLIENT_ID:ISW_SECRET), body grant_type=client_credentials
 *      (the grant type goes in the body only; seen live in the sandbox).
 *   2. POST {apiBase}/paymentgateway/api/v1/refunds with Bearer token and
 *      { refundReference, parentPaymentId, refundType: "FULL" }.
 * Interswitch then settles it the next working day: PENDING / SUCCESS /
 * PROCESSING while in flight, COMPLETE or COMPLETE_MANUAL when done,
 * FAILED when final. Errors: 400 with code 10400 (refused, says why) or
 * 500 / 10500 (unknown: check before retrying).
 *
 * Server-side only: the client id and secret never leave the server.
 */
import type { IswConfig, IswEnvironment } from "./interswitch";

export const PASSPORT_BASE: Record<IswEnvironment, string> = {
  sandbox: "https://passport-sandbox.interswitchng.com",
  live: "https://passport.interswitchng.com",
};

export type IswCredentials = { clientId: string; secret: string };

type Fetch = typeof fetch;

let cachedToken: { key: string; token: string; until: number } | null = null;

/** A Passport access token, reused until a minute before it expires. */
export async function passportToken(
  config: IswConfig,
  creds: IswCredentials,
  {
    fetchImpl = fetch,
    now = Date.now(),
  }: { fetchImpl?: Fetch; now?: number } = {},
): Promise<string> {
  const key = `${config.environment}:${creds.clientId}`;
  if (cachedToken && cachedToken.key === key && cachedToken.until > now) {
    return cachedToken.token;
  }
  const res = await fetchImpl(
    `${PASSPORT_BASE[config.environment]}/passport/oauth/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${creds.clientId}:${creds.secret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(15_000),
    },
  );
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!res.ok || !body.access_token) {
    throw new Error(`Interswitch token request failed (HTTP ${res.status})`);
  }
  cachedToken = {
    key,
    token: body.access_token,
    until: now + Math.max(0, (body.expires_in ?? 600) - 60) * 1000,
  };
  return body.access_token;
}

/** For tests: forget the cached token. */
export function clearTokenCache(): void {
  cachedToken = null;
}

export type RefundRequest = {
  /** Ours, unique per refund, e.g. ISW-RF-8F3KQ2XA. */
  refundReference: string;
  /** Interswitch's PaymentId of the payment being refunded. */
  parentPaymentId: string;
  /**
   * The whole payment, in kobo. The docs say only partial refunds need it,
   * but the sandbox refuses a FULL refund without it ("Refund amount
   * cannot be less: 1000"), so it is always sent.
   */
  amountKobo: number;
};

export type RefundAnswer =
  | { ok: true; providerId: string | null; status: string }
  /** retryable: we don't know whether Interswitch created it. */
  | { ok: false; code: string; description: string; retryable: boolean };

/** Asks Interswitch to refund a whole payment. Never throws. */
export async function requestRefund(
  config: IswConfig,
  creds: IswCredentials,
  request: RefundRequest,
  { fetchImpl = fetch }: { fetchImpl?: Fetch } = {},
): Promise<RefundAnswer> {
  try {
    const token = await passportToken(config, creds, { fetchImpl });
    const res = await fetchImpl(
      `${config.apiBase}/paymentgateway/api/v1/refunds`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          refundReference: request.refundReference,
          parentPaymentId: request.parentPaymentId,
          refundType: "FULL",
          refundAmount: request.amountKobo,
        }),
        signal: AbortSignal.timeout(20_000),
      },
    );
    const body = (await res.json().catch(() => ({}))) as {
      id?: number | string;
      refundStatus?: string;
      code?: string;
      description?: string;
    };
    if (res.ok && body.refundStatus) {
      return {
        ok: true,
        providerId: body.id != null ? String(body.id) : null,
        status: body.refundStatus,
      };
    }
    return {
      ok: false,
      code: body.code ?? `HTTP ${res.status}`,
      description:
        body.description?.trim() ??
        `Refund request failed (HTTP ${res.status})`,
      // 10400 / 4xx: refused, and it says why. Anything else is unknown.
      retryable: !(res.status >= 400 && res.status < 500),
    };
  } catch (e) {
    return {
      ok: false,
      code: "network",
      description: e instanceof Error ? e.message : String(e),
      retryable: true,
    };
  }
}

/** Interswitch's refund status → our payment status for the refund row. */
export function refundState(status: string): "PENDING" | "VERIFIED" | "FAILED" {
  const s = status.toUpperCase();
  if (s === "COMPLETE" || s === "COMPLETE_MANUAL") return "VERIFIED";
  if (s === "FAILED") return "FAILED";
  return "PENDING"; // PENDING, SUCCESS (queued for next day), PROCESSING
}

/** ISW-PT-8F3KQ2XA → ISW-RF-8F3KQ2XA */
export function refundRefFor(txnRef: string): string {
  return txnRef.startsWith("ISW-PT-")
    ? `ISW-RF-${txnRef.slice("ISW-PT-".length)}`
    : `ISW-RF-${txnRef.replace(/^ISW-/, "")}`.slice(0, 44);
}
