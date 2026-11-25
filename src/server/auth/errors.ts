import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import type { ApiError } from "@/contracts/primitives";

/**
 * The response for anything a route handler throws: errors that know their
 * own response (AuthError, ParcelError: anything with toResponse()) use it;
 * anything else (database down, missing setting, a bug) is logged and
 * becomes 500 server_error in the shared ApiError shape, so screens can show
 * a proper message instead of a blank failure.
 */
export function errorResponse(error: unknown): Response {
  // Let Next.js handle its own control-flow errors (prerender bail-out,
  // notFound, redirect) instead of turning them into a 500.
  unstable_rethrow(error);
  if (
    error &&
    typeof error === "object" &&
    "toResponse" in error &&
    typeof (error as { toResponse: unknown }).toResponse === "function"
  ) {
    return (error as { toResponse: () => Response }).toResponse();
  }
  console.error("[api] unexpected error", error);
  const body: ApiError = {
    error: {
      code: "server_error",
      message: "Something went wrong on our side. Try again in a moment.",
    },
  };
  return Response.json(body, {
    status: 500,
    headers: { "Cache-Control": "no-store" },
  });
}

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
