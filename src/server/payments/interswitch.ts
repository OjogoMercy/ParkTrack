/**
 * Interswitch Web Checkout client (Scope 04 sl1). Flow: Web Redirect
 * ("Path B" in Interswitch's QuickStart):
 *
 *  1. Our server creates a txn_ref and the form fields (checkoutForm).
 *  2. The browser POSTs that form to the Interswitch payment page.
 *  3. Interswitch sends the browser back to our site_redirect_url with
 *     txnref/resp/amount. Those values are NEVER trusted.
 *  4. Our server asks Interswitch for the transaction (requeryTransaction)
 *     and only a ResponseCode "00" with the exact kobo amount and our own
 *     reference counts as paid (classifyRequery).
 *
 * Authentication: none for this flow. The form and the status check use
 * merchant code + pay item id only. ISW_CLIENT_ID / ISW_SECRET (Passport
 * tokens) are kept server-side for APIs that need them (e.g. refunds).
 *
 * Sandbox and live are separate configurations (iswConfig): endpoints come
 * from ISW_ENVIRONMENT, and live refuses sandbox hosts and the shared
 * sandbox merchant.
 */

export type IswEnvironment = "sandbox" | "live";

export const ISW_ENDPOINTS: Record<
  IswEnvironment,
  { checkoutUrl: string; apiBase: string }
> = {
  sandbox: {
    checkoutUrl:
      "https://newwebpay-sandbox.interswitchng.com/collections/w/pay",
    apiBase: "https://sandbox.interswitchng.com",
  },
  live: {
    checkoutUrl: "https://newwebpay.interswitchng.com/collections/w/pay",
    apiBase: "https://webpay.interswitchng.com",
  },
};

/** The shared sandbox merchant from Interswitch's QuickStart (test only). */
export const SHARED_SANDBOX_MERCHANT = "MX6072";
/** NGN, ISO 4217 numeric. */
export const NGN = "566";
/** Interswitch drops unfinished transactions after this long. */
export const CHECKOUT_TTL_MINUTES = 30;

export type IswConfig = {
  environment: IswEnvironment;
  merchantCode: string;
  payItemId: string;
  checkoutUrl: string;
  apiBase: string;
};

/** Validated configuration, or an error naming what's wrong. */
export function iswConfig(env: {
  ISW_ENVIRONMENT: IswEnvironment;
  ISW_BASE_URL?: string;
  ISW_MERCHANT_CODE?: string;
  ISW_PAY_ITEM_ID?: string;
}): IswConfig {
  const missing = (["ISW_MERCHANT_CODE", "ISW_PAY_ITEM_ID"] as const).filter(
    (k) => !env[k],
  );
  if (missing.length) {
    throw new Error(`Interswitch isn't set up: add ${missing.join(", ")}.`);
  }
  const environment = env.ISW_ENVIRONMENT;
  const endpoints = ISW_ENDPOINTS[environment];
  const apiBase = (env.ISW_BASE_URL ?? endpoints.apiBase).replace(/\/+$/, "");

  if (environment === "live") {
    if (/sandbox|qa\./i.test(apiBase)) {
      throw new Error(
        "ISW_ENVIRONMENT=live but ISW_BASE_URL is a sandbox URL.",
      );
    }
    if (env.ISW_MERCHANT_CODE === SHARED_SANDBOX_MERCHANT) {
      throw new Error(
        "ISW_ENVIRONMENT=live can't use the shared sandbox merchant; use your own credentials.",
      );
    }
  } else if (!/sandbox|qa\./i.test(apiBase)) {
    throw new Error(
      "ISW_ENVIRONMENT=sandbox but ISW_BASE_URL is not a sandbox URL.",
    );
  }
  return {
    environment,
    merchantCode: env.ISW_MERCHANT_CODE!,
    payItemId: env.ISW_PAY_ITEM_ID!,
    checkoutUrl: endpoints.checkoutUrl,
    apiBase,
  };
}

export type CheckoutInput = {
  txnRef: string;
  /** Integer kobo, computed on the server (never from the browser). */
  amountKobo: number;
  /** Where Interswitch sends the browser back (our callback route). */
  redirectUrl: string;
  customer: { id: string; name?: string | null; email: string; phone?: string };
  /** Shown on the Interswitch page, e.g. "ParkTrack PT-7K3Q shipping". */
  itemName: string;
};

/**
 * Form fields for the Web Redirect checkout (POST to `url`). The result
 * comes back to `redirectUrl` as query parameters (payment_response_type
 * GET), which the callback only uses to find the reference.
 */
export function checkoutForm(
  config: IswConfig,
  input: CheckoutInput,
): { url: string; fields: Record<string, string> } {
  if (!Number.isInteger(input.amountKobo) || input.amountKobo <= 0) {
    throw new Error("Checkout amount must be a positive whole number of kobo.");
  }
  const fields: Record<string, string> = {
    merchant_code: config.merchantCode,
    pay_item_id: config.payItemId,
    txn_ref: input.txnRef,
    amount: String(input.amountKobo),
    currency: NGN,
    site_redirect_url: input.redirectUrl,
    payment_response_type: "GET",
    cust_id: input.customer.id,
    cust_email: input.customer.email,
    pay_item_name: input.itemName.slice(0, 60),
  };
  if (input.customer.name) fields.cust_name = input.customer.name;
  if (input.customer.phone) fields.cust_mobile_no = input.customer.phone;
  return { url: config.checkoutUrl, fields };
}

/** What Interswitch's status check returned (fields we use). */
export type IswTransaction = {
  responseCode: string;
  description: string;
  amountKobo: number;
  merchantReference: string | null;
  paymentReference: string | null;
  transactionDate: string | null;
  cancelled: boolean;
};

/**
 * GET {apiBase}/collections/api/v1/gettransaction.json?merchantcode&
 * transactionreference&amount. No auth header (per Interswitch's docs).
 * Throws on network errors, timeouts and non-JSON replies; the caller
 * treats those as "still pending".
 */
export async function requeryTransaction(
  config: IswConfig,
  txnRef: string,
  amountKobo: number,
  {
    fetchImpl = fetch,
    timeoutMs = 15_000,
  }: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<IswTransaction> {
  const url = new URL(
    `${config.apiBase}/collections/api/v1/gettransaction.json`,
  );
  url.searchParams.set("merchantcode", config.merchantCode);
  url.searchParams.set("transactionreference", txnRef);
  url.searchParams.set("amount", String(amountKobo));
  const res = await fetchImpl(url, {
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Interswitch status check HTTP ${res.status}`);
  const body = (await res.json()) as Record<string, unknown>;
  if (typeof body.ResponseCode !== "string") {
    throw new Error("Interswitch status check returned no ResponseCode");
  }
  return {
    responseCode: body.ResponseCode,
    description: String(body.ResponseDescription ?? ""),
    amountKobo: Number(body.Amount ?? 0),
    merchantReference:
      typeof body.MerchantReference === "string"
        ? body.MerchantReference
        : null,
    paymentReference:
      typeof body.PaymentReference === "string" ? body.PaymentReference : null,
    transactionDate:
      typeof body.TransactionDate === "string" ? body.TransactionDate : null,
    cancelled: body.PaymentCancelled === true,
  };
}

/**
 * Codes meaning "not finished yet; ask again later". Z1 "Transaction Not
 * Completed" is what the sandbox returns while the customer is still on
 * the payment page (seen live; the docs only list Z0).
 */
const IN_PROGRESS = new Set(["09", "S0", "Z0", "Z1"]);
/** "Transaction not found": nothing paid yet (customer may still be paying). */
const NOT_FOUND = "Z25";

export type Verdict =
  | { status: "VERIFIED"; responseCode: "00"; paymentReference: string | null }
  | { status: "PENDING"; responseCode: string | null; reason: string }
  | {
      status: "FAILED";
      responseCode: string | null;
      reason: string;
      /**
       * false: the customer can still retry on the same Interswitch page
       * (a decline inside the 30-minute window can turn into "00"; seen
       * live in the sandbox), so keep re-checking. true: settled for good.
       */
      final: boolean;
      /**
       * Interswitch says it was paid, but not what we charged or not our
       * reference: never applied, a person must look (sl3).
       */
      needsReview?: boolean;
    };

/**
 * The only place a payment becomes VERIFIED: ResponseCode "00", the exact
 * kobo amount we charged, and (when Interswitch echoes it) our own
 * reference. Anything else is FAILED with a reason, or PENDING while it can
 * still complete. `startedAt` lets an unfinished checkout expire after
 * Interswitch's 30-minute window.
 */
export function classifyRequery(
  result: IswTransaction | { error: string },
  expected: { txnRef: string; amountKobo: number; startedAt: Date },
  now: Date = new Date(),
): Verdict {
  if ("error" in result) {
    return { status: "PENDING", responseCode: null, reason: result.error };
  }
  const code = result.responseCode;
  if (code === "00") {
    if (result.amountKobo !== expected.amountKobo) {
      return {
        status: "FAILED",
        responseCode: code,
        reason: `Amount mismatch: paid ${result.amountKobo} kobo, expected ${expected.amountKobo}`,
        final: true, // money moved but not what we charged: a person must look
        needsReview: true,
      };
    }
    if (
      result.merchantReference &&
      result.merchantReference !== expected.txnRef
    ) {
      return {
        status: "FAILED",
        responseCode: code,
        reason: "Reference mismatch",
        final: true,
        needsReview: true,
      };
    }
    return {
      status: "VERIFIED",
      responseCode: "00",
      paymentReference: result.paymentReference,
    };
  }
  const expired =
    now.getTime() - expected.startedAt.getTime() >
    CHECKOUT_TTL_MINUTES * 60 * 1000;
  if (result.cancelled) {
    return {
      status: "FAILED",
      responseCode: code,
      reason: "Payment was cancelled",
      final: true,
    };
  }
  if (code === NOT_FOUND || IN_PROGRESS.has(code)) {
    return expired
      ? {
          status: "FAILED",
          responseCode: code,
          reason: "Payment wasn't completed",
          final: true,
        }
      : {
          status: "PENDING",
          responseCode: code,
          reason: result.description || "Waiting for the payment",
        };
  }
  return {
    status: "FAILED",
    responseCode: code,
    reason: result.description || `Declined (${code})`,
    final: expired,
  };
}
