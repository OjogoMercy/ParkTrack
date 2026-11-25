/**
 * Payer-facing payment messages shared by the server (stored as the
 * payment's reason) and the /pay screens (which pick a layout by them).
 * No server-only imports: client components read these.
 */

/** A payment that needs a person to check it (money may have moved). */
export const REVIEW_MESSAGE =
  "We couldn't confirm this payment. Our team will check it and contact you; don't pay again";

/** An open checkout closed because a newer one started. */
export const REPLACED_REASON = "Replaced by a newer checkout";
