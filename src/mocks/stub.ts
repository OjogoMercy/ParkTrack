/**
 * Helpers for the Scope 01 service stubs in src/server/<module>/index.ts.
 * A stub keeps the module's final exported signature and returns fixture
 * data, so callers can be built before the owning scope lands. The owning
 * scope replaces the function bodies; nothing outside changes.
 */

/** Deep copy so callers can't mutate shared fixtures. */
export function fixture<T>(value: T): T {
  return structuredClone(value);
}

/** Resolve after a tick, like a real service call. */
export async function stub<T>(value: T): Promise<T> {
  return fixture(value);
}

/** Marks a module as still stubbed (checked by tests/server/stubs.test.ts). */
export const STUB_OWNER = {
  auth: "02",
  parks: "02",
  parcels: "03",
  notify: "03",
  uploads: "03",
  payments: "04",
  ledger: "04",
  booking: "05",
  recipients: "05",
  vendors: "05",
  handshake: "06",
  dropoff: "06",
  assignment: "06",
  trips: "07",
  roadside: "07",
  tracking: "07",
  arrival: "08",
  collection: "08",
  admin: "09",
  jobs: "09",
  disputes: "09",
} as const;
export type StubModule = keyof typeof STUB_OWNER;
