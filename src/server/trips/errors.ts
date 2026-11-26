import type { ApiError } from "@/contracts/primitives";

export type TripErrorCode =
  "trip_not_found" | "not_your_trip" | "trip_closed" | "nothing_to_accept";

/**
 * A refused trip operation with a stable `code`, an HTTP status and a
 * message for the driver. Route handlers return `error.toResponse()`
 * (errorResponse in @/server/auth does this).
 */
export class TripError extends Error {
  constructor(
    readonly code: TripErrorCode,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "TripError";
  }

  toResponse(): Response {
    const body: ApiError = {
      error: { code: this.code, message: this.message },
    };
    return Response.json(body, { status: this.status });
  }
}
