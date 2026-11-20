/**
 * Nigerian phone numbers. Stored as E.164 (+2348035554471); shown as
 * "+234 803 555 4471"; masked for people who shouldn't see the whole number
 * ("+234 802 *** 9034", as on the collection screens).
 */

/**
 * Accepts what people type: "0803 555 4471", "08035554471", "803-555-4471",
 * "2348035554471", "+234 803 555 4471". Returns E.164 or null.
 */
export function normalizeNgPhone(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, "");
  let national: string | null = null;
  if (/^\+234\d{10}$/.test(digits)) national = digits.slice(4);
  else if (/^234\d{10}$/.test(digits)) national = digits.slice(3);
  else if (/^0\d{10}$/.test(digits)) national = digits.slice(1);
  else if (/^\d{10}$/.test(digits)) national = digits;
  if (!national) return null;
  // Real subscriber numbers start 7, 8 or 9; +234000… is reserved for test data.
  if (!/^[789]\d{9}$/.test(national) && !/^000\d{7}$/.test(national))
    return null;
  return `+234${national}`;
}

function parts(e164: string): [string, string, string] {
  const n = e164.replace(/^\+234/, "");
  return [n.slice(0, 3), n.slice(3, 6), n.slice(6)];
}

/** "+2348035554471" → "+234 803 555 4471" */
export function formatPhone(e164: string): string {
  const [a, b, c] = parts(e164);
  return `+234 ${a} ${b} ${c}`;
}

/** "+2348035554471" → "0803 555 4471" */
export function formatPhoneNational(e164: string): string {
  const [a, b, c] = parts(e164);
  return `0${a} ${b} ${c}`;
}

/** "+2348021189034" → "+234 802 *** 9034" */
export function maskPhone(e164: string): string {
  const n = e164.replace(/^\+234/, "");
  return `+234 ${n.slice(0, 3)} *** ${n.slice(-4)}`;
}
