import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthError, errorResponse } from "./errors";

describe("errorResponse", () => {
  afterEach(() => vi.restoreAllMocks());

  it("uses the error's own response when it has one", async () => {
    const res = errorResponse(
      new AuthError("signed_out", "Sign in to continue.", 401),
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: { code: "signed_out", message: "Sign in to continue." },
    });
  });

  it("turns anything else into a logged JSON 500 without its details", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = errorResponse(
      new Error("connect ECONNREFUSED 10.0.0.5:6543 password=hunter2"),
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({
      error: {
        code: "server_error",
        message: "Something went wrong on our side. Try again in a moment.",
      },
    });
    expect(JSON.stringify(body)).not.toContain("ECONNREFUSED");
    expect(log).toHaveBeenCalled();
  });
});
