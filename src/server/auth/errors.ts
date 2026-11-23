import type { z } from "zod";
import type { ApiError } from "@/contracts/primitives";

/** 400 invalid_input with the first message per field, for bad request bodies. */
export function invalidInputResponse(
  error: z.ZodError,
  message = "Check what you entered and try again.",
): Response {
  const fields: Record<string, string> = {};
  for (const issue of error.issues)
    fields[issue.path.join(".") || "body"] ??= issue.message;
  const body: ApiError = { error: { code: "invalid_input", message, fields } };
  return Response.json(body, { status: 400 });
}

/**
 * A sign-in or access failure with a stable `code` the screens can react to,
 * an HTTP status, and a message written for the person using the app.
 */
export class AuthError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details: {
      retryInSeconds?: number;
      attemptsLeft?: number;
      fields?: Record<string, string>;
    } = {},
  ) {
    super(message);
    this.name = "AuthError";
  }

  /** JSON response in the shared ApiError shape. */
  toResponse(): Response {
    const body: ApiError & {
      retryInSeconds?: number;
      attemptsLeft?: number;
    } = {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details.fields ? { fields: this.details.fields } : {}),
      },
      ...(this.details.retryInSeconds !== undefined
        ? { retryInSeconds: this.details.retryInSeconds }
        : {}),
      ...(this.details.attemptsLeft !== undefined
        ? { attemptsLeft: this.details.attemptsLeft }
        : {}),
    };
    const headers: Record<string, string> = {};
    if (this.details.retryInSeconds !== undefined)
      headers["Retry-After"] = String(this.details.retryInSeconds);
    return Response.json(body, { status: this.status, headers });
  }
}
