/**
 * Shared contracts for every scope (Scope 01, FROZEN). Browser-safe: no
 * server or database imports. Change only through a contract/* PR
 * (docs/WORKFLOW.md §7), and only additively.
 */
export * from "./enums";
export * from "./primitives";
export * from "./states";
export * from "./qr";
export * from "./notifications";
export * as dto from "./dto";
export * as api from "./api";
export type * from "./dto";
