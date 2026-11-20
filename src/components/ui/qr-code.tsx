import QRCode from "qrcode";
import { cn } from "@/lib/utils";

/**
 * Renders a QR code as a single SVG path. Synchronous, so it works in server
 * and client components and needs no canvas.
 *
 * PRD rule: a QR carries only a random ID (booking publicId, manifest token,
 * agent handshake token) or a URL built from one. Never names, phones or
 * amounts. Details load from the server when a signed-in user scans.
 */
export function QRCodeView({
  value,
  size = 200,
  label,
  className,
}: {
  value: string;
  /** Rendered width/height in CSS pixels. */
  size?: number;
  /** Accessible description, e.g. "Booking QR for PT-7K3Q". */
  label: string;
  className?: string;
}) {
  const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const quiet = 4; // quiet zone in modules, required for reliable scanning
  const total = n + quiet * 2;

  let d = "";
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (qr.modules.get(row, col))
        d += `M${col + quiet} ${row + quiet}h1v1h-1z`;
    }
  }

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${total} ${total}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={cn("rounded-control bg-white", className)}
    >
      <rect width={total} height={total} fill="#ffffff" />
      <path d={d} fill="#09090b" />
    </svg>
  );
}
