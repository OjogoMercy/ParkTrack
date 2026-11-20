/**
 * STUB (Scope 01) — owned by Scope 05 (docs/scopes/05-sender-app.md).
 * Exported names and types are FINAL. Scope 05 replaces the bodies;
 * callers never change. Until then everything returns fixture data.
 */
import type { SavedRecipientDto } from "@/contracts/dto";
import { savedRecipients } from "@/mocks/fixtures";
import { stub } from "@/mocks/stub";

export const STUB = true;

export type RecipientInput = {
  name: string;
  phone: string;
  preferredParkId?: string | null;
  preferredRoadsidePointId?: string | null;
};

export async function listRecipients(
  userId: string,
): Promise<SavedRecipientDto[]> {
  void userId;
  return stub(savedRecipients);
}

export async function createRecipient(
  userId: string,
  input: RecipientInput,
): Promise<SavedRecipientDto> {
  void userId;
  return stub({ ...savedRecipients[0], id: "rcp_new", name: input.name });
}

export async function updateRecipient(
  userId: string,
  id: string,
  input: Partial<RecipientInput>,
): Promise<SavedRecipientDto> {
  void userId;
  return stub({
    ...savedRecipients[0],
    id,
    ...(input.name ? { name: input.name } : {}),
  });
}

export async function deleteRecipient(
  userId: string,
  id: string,
): Promise<void> {
  void userId;
  void id;
}
