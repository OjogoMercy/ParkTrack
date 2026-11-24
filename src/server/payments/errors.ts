import type { ApiError } from "@/contracts/primitives";

export type PaymentErrorCode =
  | "parcel_not_found"
  | "payment_not_found"
  | "payment_not_allowed"
  | "payer_not_allowed"
  | "payments_unavailable";

/** A refused payment step, with a message for the person paying. */
export class PaymentError extends Error {
  constructor(
    readonly code: PaymentErrorCode,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PaymentError";
  }

  toResponse(): Response {
    const body: ApiError = {
      error: { code: this.code, message: this.message },
    };
    return Response.json(body, {
      status: this.status,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
