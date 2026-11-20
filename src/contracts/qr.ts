/**
 * What goes inside each QR code (PRD §9 "QR content": random IDs only).
 * FROZEN: printed posters and issued QRs depend on this format.
 *
 * Two kinds:
 * - In-app QRs, read by ParkTrack's own scanner (agents): short prefixed
 *   tokens. They mean nothing to an ordinary camera app.
 *     booking QR  (sender shows, origin agent scans)   pt:b:<publicId>
 *     manifest QR (driver shows, arrival agent scans)  pt:m:<manifestToken>
 * - Phone-camera QRs, read by a person's normal camera: full URLs.
 *     agent handshake QR (sender scans at the counter)  https://app.<root>/h/<agentQrToken>
 *     counter poster QR  (recipient scans to collect)   https://<root>/collect/<parkToken>
 */

export type QrPayload =
  | { kind: "booking"; publicId: string }
  | { kind: "manifest"; token: string }
  | { kind: "handshake"; token: string }
  | { kind: "counter"; token: string };

const TOKEN = /^[A-Za-z0-9_-]{16,64}$/;

export function bookingQr(publicId: string): string {
  return `pt:b:${publicId}`;
}

export function manifestQr(token: string): string {
  return `pt:m:${token}`;
}

/** `root` is ROOT_DOMAIN, e.g. "parktrack.ng" or "localhost:3000". */
export function handshakeQrUrl(root: string, token: string): string {
  return `${root.startsWith("localhost") ? "http" : "https"}://app.${root}/h/${token}`;
}

export function counterQrUrl(root: string, token: string): string {
  return `${root.startsWith("localhost") ? "http" : "https"}://${root}/collect/${token}`;
}

/**
 * Reads any ParkTrack QR. Returns null for anything else (a random QR, a
 * malformed token), so scanners can show "This isn't a ParkTrack code".
 */
export function parseQr(raw: string): QrPayload | null {
  const text = raw.trim();
  const inApp = /^pt:([bm]):(.+)$/.exec(text);
  if (inApp) {
    const [, kind, token] = inApp;
    if (!TOKEN.test(token)) return null;
    return kind === "b"
      ? { kind: "booking", publicId: token }
      : { kind: "manifest", token };
  }
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length !== 2 || !TOKEN.test(parts[1])) return null;
  if (parts[0] === "h") return { kind: "handshake", token: parts[1] };
  if (parts[0] === "collect") return { kind: "counter", token: parts[1] };
  return null;
}
