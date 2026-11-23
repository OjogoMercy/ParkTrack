import type { ApiError } from "@/contracts/primitives";

export type ParcelErrorCode =
  | "parcel_not_found"
  | "transition_not_allowed"
  | "actor_not_allowed"
  | "status_changed"
  | "route_not_found"
  | "invalid_booking"
  | "pod_too_high"
  | "prohibited_item"
  | "code_not_allowed"
  | "code_resend_too_soon"
  | "code_missing"
  | "code_used"
  | "code_expired";

/**
 * A refused parcel operation with a stable `code`, an HTTP status and a
 * message for the person using the app; `fields` says which form field is
 * wrong. Route handlers return `error.toResponse()`.
 */
export class ParcelError extends Error {
  constructor(
    readonly code: ParcelErrorCode,
    message: string,
    readonly status: number,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "ParcelError";
  }

  toResponse(): Response {
    const body: ApiError = {
      error: {
        code: this.code,
        message: this.message,
        ...(this.fields ? { fields: this.fields } : {}),
      },
    };
    return Response.json(body, { status: this.status });
  }
}
