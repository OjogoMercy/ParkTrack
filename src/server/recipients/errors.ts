import type { ApiError } from "@/contracts/primitives";

export type RecipientErrorCode =
  | "recipient_not_found"
  | "recipient_exists"
  | "too_many_recipients"
  | "invalid_input";

/** A refused change to saved recipients, with a message for the sender. */
export class RecipientError extends Error {
  constructor(
    readonly code: RecipientErrorCode,
    message: string,
    readonly status: number,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "RecipientError";
  }

  toResponse(): Response {
    const body: ApiError = {
      error: {
        code: this.code,
        message: this.message,
        ...(this.fields ? { fields: this.fields } : {}),
      },
    };
    return Response.json(body, {
      status: this.status,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
