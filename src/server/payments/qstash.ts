/**
 * QStash request signatures (upstash.com/docs/qstash/howto/signature):
 * Upstash-Signature is an HS256 JWT signed with the current or the next
 * signing key (both are tried, so key rotation doesn't drop jobs), with
 * iss "Upstash", sub = the destination URL, exp/nbf, and body = SHA-256 of
 * the raw request body (base64url).
 *
 * Kept in Scope 04's folder for the requery job; Scope 09's jobs can move
 * it to src/lib when they need it.
 */
import { createHash } from "node:crypto";
import { jwtVerify } from "jose";

export const QSTASH_SIGNATURE_HEADER = "upstash-signature";

export type QStashKeys = { current?: string; next?: string };

/**
 * True when `signature` is a valid QStash JWT for this body and path.
 * `path` is checked against the sub claim's pathname (the host can differ
 * behind a proxy or a custom domain).
 */
export async function verifyQStash(
  {
    signature,
    body,
    path,
  }: { signature: string | null; body: string; path: string },
  keys: QStashKeys,
  now: Date = new Date(),
): Promise<boolean> {
  if (!signature) return false;
  for (const key of [keys.current, keys.next]) {
    if (!key) continue;
    try {
      const { payload } = await jwtVerify(
        signature,
        new TextEncoder().encode(key),
        {
          algorithms: ["HS256"],
          issuer: "Upstash",
          currentDate: now,
          clockTolerance: 5,
        },
      );
      if (typeof payload.sub !== "string") return false;
      let subPath: string;
      try {
        subPath = new URL(payload.sub).pathname;
      } catch {
        return false;
      }
      if (subPath.replace(/\/+$/, "") !== path.replace(/\/+$/, "")) {
        return false;
      }
      const bodyHash = createHash("sha256").update(body).digest("base64url");
      const claimed = String(payload.body ?? "").replace(/=+$/, "");
      return claimed === bodyHash;
    } catch {
      // Wrong key (or expired / malformed): try the next key.
    }
  }
  return false;
}
