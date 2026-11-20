/**
 * Money is always an integer number of kobo (₦1 = 100 kobo). Never floats.
 * These helpers only format for display; arithmetic stays in kobo.
 * (Scope 01 sl9 adds parsing helpers alongside these.)
 */

const MINUS = "−"; // "−", as in the ledger designs

function assertKobo(kobo: number): void {
  if (!Number.isSafeInteger(kobo)) {
    throw new TypeError(`Expected an integer amount in kobo, got ${kobo}`);
  }
}

/**
 * 265000 → "₦2,650"; 265050 → "₦2,650.50"; -165000 → "−₦1,650".
 * `sign: true` adds "+" to positive amounts (ledger rows: "+₦39,500").
 */
export function formatNaira(
  kobo: number,
  { sign = false }: { sign?: boolean } = {},
): string {
  assertKobo(kobo);
  const negative = kobo < 0;
  const abs = Math.abs(kobo);
  const naira = Math.trunc(abs / 100);
  const rest = abs % 100;
  const whole = naira.toLocaleString("en-NG");
  const body = rest === 0 ? whole : `${whole}.${String(rest).padStart(2, "0")}`;
  const prefix = negative ? MINUS : sign && kobo > 0 ? "+" : "";
  return `${prefix}₦${body}`;
}

/** Compact form for KPIs: 240000000 → "₦2.4M", 121000000 → "₦1.21M". */
export function formatNairaCompact(kobo: number): string {
  assertKobo(kobo);
  const naira = kobo / 100;
  const abs = Math.abs(naira);
  const prefix = naira < 0 ? MINUS : "";
  const fmt = (n: number, suffix: string) =>
    `${prefix}₦${Number(n.toFixed(2)).toString()}${suffix}`;
  if (abs >= 1_000_000) return fmt(abs / 1_000_000, "M");
  if (abs >= 1_000) return fmt(abs / 1_000, "k");
  return formatNaira(kobo);
}
