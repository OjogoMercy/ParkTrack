/**
 * STUB (Scope 01) — owned by Scope 09 (docs/scopes/09-admin-jobs-launch.md).
 * Exported names and types are FINAL. Scope 09 replaces the bodies;
 * callers never change. Until then each job reports it processed nothing.
 *
 * Each job is called by a QStash-signed route under /api/jobs/* and must be
 * safe to run repeatedly (idempotent).
 */
import { stub } from "@/mocks/stub";

export const STUB = true;

export type JobResult = { processed: number };

/** AWAITING_DROPOFF past the deadline → CANCELLED + refund (BOOK-7). */
export async function runBookingExpiry(now = new Date()): Promise<JobResult> {
  void now;
  return stub({ processed: 0 });
}

/** DRAFT older than 24 hours → CANCELLED. */
export async function runDraftExpiry(now = new Date()): Promise<JobResult> {
  void now;
  return stub({ processed: 0 });
}

/** Loads not accepted 15 min before departure → alert agent + park admin (DRV-5). */
export async function runLoadNotAccepted(now = new Date()): Promise<JobResult> {
  void now;
  return stub({ processed: 0 });
}

/** Before the free window ends, then daily (PRD §11). */
export async function runStorageReminders(
  now = new Date(),
): Promise<JobResult> {
  void now;
  return stub({ processed: 0 });
}

/** ARRIVED past the maximum hold → UNCLAIMED, contact sender. */
export async function runUnclaimed(now = new Date()): Promise<JobResult> {
  void now;
  return stub({ processed: 0 });
}
