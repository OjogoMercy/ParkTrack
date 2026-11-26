/**
 * Realtime topic names for tracking pages, shared by the server (./live.ts
 * sends) and the browser (features/tracking/live-refresh.tsx listens). Each
 * is keyed by a random id the viewer already holds, and carries no data.
 */

export const TRACKING_EVENT = "changed";

/** The sender's page (S09–S11): keyed by the booking's publicId. */
export function senderTopic(publicId: string): string {
  return `sender:${publicId}`;
}

/** The recipient's link (R01–R03): keyed by the tracking-link id. */
export function recipientTopic(trackingLinkId: string): string {
  return `recipient:${trackingLinkId}`;
}
